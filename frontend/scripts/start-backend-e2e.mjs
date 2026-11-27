import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePythonRuntime } from "./python-runtime.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const backendDir = path.join(repoRoot, "backend");
const seedScript = path.join(repoRoot, "demo-data", "seed.py");
const python = resolvePythonRuntime(repoRoot);

execFileSync(
  python.command,
  [...python.prefixArgs, seedScript, "--reset", "--schema-only"],
  {
    cwd: repoRoot,
    stdio: "inherit",
  },
);

const server = spawn(
  python.command,
  [
    ...python.prefixArgs,
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8000",
  ],
  {
    cwd: backendDir,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: `sqlite:///${path.join(repoRoot, "data", "app.db").replace(/\\/g, "/")}`,
      // Deterministic E2E secrets so a clean clone needs no backend/.env.
      APP_JWT_SECRET: process.env.APP_JWT_SECRET || "e2e-app-jwt-secret-e2e-app-jwt-secret",
      SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || "e2e-supabase-secret-e2e-supabase-secret",
      SUPABASE_JWT_ISSUER: process.env.SUPABASE_JWT_ISSUER || "https://e2e.supabase.co/auth/v1",
      SUPABASE_JWT_AUDIENCE: process.env.SUPABASE_JWT_AUDIENCE || "authenticated",
      ADMIN_EMAILS: process.env.ADMIN_EMAILS || "e2e-admin@example.com",
      DEMO_RATE_LIMIT: process.env.DEMO_RATE_LIMIT || "100000/minute",
      DEMO_GLOBAL_CAP_PER_HOUR: process.env.DEMO_GLOBAL_CAP_PER_HOUR || "100000",
    },
  },
);

const shutdown = () => {
  if (!server.killed) {
    server.kill("SIGTERM");
  }
};

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, shutdown);
}

server.on("exit", (code) => {
  process.exit(code ?? 0);
});
