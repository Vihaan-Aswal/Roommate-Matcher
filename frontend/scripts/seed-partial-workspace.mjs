/**
 * seed-partial-workspace.mjs — evidence fixture, dev only.
 *
 * 1. Creates a throwaway workspace with a roster and a room list but only two of
 *    four responses, so the dashboard's readiness states can be photographed
 *    with Missing / In progress / Risk next to Ready.
 * 2. Submits one of those responses through the real public form UI, which also
 *    proves the student form's submit path end to end.
 *
 * Seeding and photographing must share one demo session: every /api/auth/demo
 * call creates a new tenant, and a workspace is only readable from its own.
 *
 *   node scripts/seed-partial-workspace.mjs --app http://127.0.0.1:5175
 */
import path from "node:path";
import { chromium } from "@playwright/test";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const api = arg("api", process.env.CAPTURE_API_URL ?? "http://127.0.0.1:8000");
const app = arg("app", "http://127.0.0.1:5175");
const outDir = path.resolve(process.cwd(), "..", ".impeccable", "review", "app", "seams");
const tag = arg("tag", "partial");
// Where the directive must land for this state.
const expectPath = arg("expect", "/form-collection");

const STUDENTS = [
  ["PRT001", "Partial One", "9000000001"],
  ["PRT002", "Partial Two", "9000000002"],
  ["PRT003", "Partial Three", "9000000003"],
  ["PRT004", "Partial Four", "9000000004"],
];

const ANSWERS = {
  q1_raw: "Before 11 PM (early)",
  q2_raw: "Very tidy - I like things clean and organized",
  q3_raw: "Before 10 PM",
  q4a_raw: "Mainly for sleeping/studying, not for hanging out",
  q4b_raw: "Very uncomfortable",
  q5a_raw: "Almost never",
  q5b_raw: "Very uncomfortable",
  q6_raw: "I need a 100% smoke-free room",
  q7_raw: "I require an alcohol-free room",
  q8_raw: "I am strict vegetarian and require a meat-free room",
  q9_raw: "Budget-conscious - prefer to keep costs low",
  q10_raw: "I prefer someone very similar to me",
};

const demo = await (
  await fetch(`${api}/api/auth/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@example.com" }),
  })
).json();
const auth = { Authorization: `Bearer ${demo.token}` };

const workspace = await (
  await fetch(`${api}/api/workspaces`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Partial readiness workspace" }),
  })
).json();

const studentsCsv = [
  "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number",
  ...STUDENTS.map(
    ([id, name, phone], index) =>
      `${id},${name},F,1st_year,NonAC,3,2006-0${index + 4}-11,${phone}`,
  ),
].join("\n");

// Default: two 3-bed rooms for four students, so capacity is not the blocker and
// the segment lands in "Risk" (missing responses). Pass --rooms 1 to photograph
// the other blocker: one 3-bed room for four students is "Impossible".
const roomCount = Number(arg("rooms", "2"));
const roomsCsv = [
  "room_id,segment_key,capacity",
  ...Array.from({ length: roomCount }, (_, index) => `P-10${index + 1},F_1st_year_NonAC_3,3`),
].join("\n");

async function upload(route, csv, filename) {
  const form = new FormData();
  form.append("file", new Blob([csv], { type: "text/csv" }), filename);
  const response = await fetch(`${api}/api/workspaces/${workspace.id}${route}`, {
    method: "POST",
    headers: auth,
    body: form,
  });
  if (!response.ok) {
    throw new Error(`${route} -> ${response.status} ${await response.text()}`);
  }
  return response.json();
}

const studentsApply = await upload("/students/upload/apply", studentsCsv, "students.csv");
const roomsApply = await upload("/rooms/upload/apply", roomsCsv, "rooms.csv");
if (roomsApply.errors?.length) {
  throw new Error(`rooms rejected: ${JSON.stringify(roomsApply.errors)}`);
}

const link = await (
  await fetch(`${api}/api/workspaces/${workspace.id}/form-link`, { headers: auth })
).json();

const browser = await chromium.launch({ headless: true, args: ["--disable-web-security"] });

/** One response through the real form UI: identity, twelve first options, submit. */
async function submitThroughUi() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${app}/f/${link.token}`, { waitUntil: "networkidle", timeout: 45000 });

  await page.getByLabel("Admission Number").fill("PRT002");
  await page.getByLabel("Last 4 digits of Phone Number").fill("0002");
  await page.getByRole("button", { name: /continue to questions/i }).click();

  const questions = page.locator("fieldset.desk-question");
  const count = await questions.count();
  if (count !== 12) {
    throw new Error(`expected 12 questions, saw ${count}`);
  }
  for (let index = 0; index < count; index += 1) {
    await questions.nth(index).locator("input[type=radio]").first().check();
  }

  await page.getByRole("button", { name: /submit preferences/i }).click();
  const receipt = page.getByRole("heading", { name: /thank you/i });
  await receipt.waitFor({ timeout: 20000 });
  const message = await page.locator(".desk-body").first().innerText();
  await page.screenshot({ path: path.join(outDir, "student-form-receipt-390.png"), fullPage: true });
  await context.close();
  return message.trim();
}

const uiMessage = await submitThroughUi();

// A second response straight through the API, so the dashboard shows 2 of 4.
const submit = await fetch(`${api}/api/public/forms/${link.token}/submit`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    submitted_admission_number: "PRT001",
    submitted_phone_last4: "0001",
    answers: ANSWERS,
  }),
});
const submitBody = await submit.json();
if (!submit.ok || !submitBody.valid) {
  throw new Error(`api submit rejected: ${submit.status} ${JSON.stringify(submitBody)}`);
}

const files = [];
let ctaLabel = null;
let ctaLanded = null;
for (const width of [1280, 375]) {
  const context = await browser.newContext({
    viewport: { width, height: width === 1280 ? 900 : 812 },
  });
  await context.addInitScript(({ token }) => sessionStorage.setItem("demo_token", token), {
    token: demo.token,
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${app}/app/${workspace.id}/dashboard`, {
    waitUntil: "networkidle",
    timeout: 45000,
  });
  await page.getByRole("heading", { name: "Readiness", exact: true }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(400);
  const file = path.join(outDir, `${tag}-dashboard-${width}.png`);
  await page.screenshot({ path: file, fullPage: true });
  files.push(file);

  if (width === 1280) {
    // The blocker here is missing responses, so the directive must send the
    // warden to the form, not to a runs page where nothing can run.
    const noteActions = await page.locator(".desk-note .desk-btn").count();
    if (noteActions !== 0) {
      throw new Error(`expected no note action while the directive carries the blocker, saw ${noteActions}`);
    }
    const cta = page.locator(".desk-directive .desk-btn").first();
    ctaLabel = (await cta.innerText()).trim();
    await cta.click();
    await page.waitForLoadState("networkidle");
    ctaLanded = new URL(page.url()).pathname;
    if (!ctaLanded.endsWith(expectPath)) {
      throw new Error(`dashboard CTA landed on ${ctaLanded}, expected ${expectPath}`);
    }
  }

  await context.close();
}

await browser.close();

console.log(
  JSON.stringify(
    {
      workspace: workspace.id,
      studentsApplied: studentsApply.inserted,
      roomsApplied: roomsApply.inserted,
      uiSubmit: uiMessage,
      cta: { label: ctaLabel, landed: ctaLanded },
      files,
    },
    null,
    2,
  ),
);
