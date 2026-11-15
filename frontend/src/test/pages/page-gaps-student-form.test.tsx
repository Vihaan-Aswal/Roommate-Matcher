import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";

import { StudentForm } from "../../pages/StudentForm";
import { renderWithProviders } from "../renderWithProviders";

const { getPublicFormConfigMock, submitPublicFormMock } = vi.hoisted(() => ({
  getPublicFormConfigMock: vi.fn(),
  submitPublicFormMock: vi.fn(),
}));

vi.mock("../../lib/apiClient", () => ({
  getPublicFormConfig: getPublicFormConfigMock,
  submitPublicForm: submitPublicFormMock,
}));

const QUESTION_IDS = [
  "q1_raw",
  "q2_raw",
  "q3_raw",
  "q4a_raw",
  "q4b_raw",
  "q5a_raw",
  "q5b_raw",
  "q6_raw",
  "q7_raw",
  "q8_raw",
  "q9_raw",
  "q10_raw",
] as const;

const VALID_CONFIG = {
  token_valid: true,
  workspace_name: "Test Workspace",
  questions: [],
};

function renderForm(initialEntry = "/f/test-token") {
  return renderWithProviders(
    <Routes>
      <Route path="/f/:token" element={<StudentForm />} />
    </Routes>,
    { initialEntries: [initialEntry] },
  );
}

async function answerIdentity(admission = "ADM501", phone = "1234") {
  fireEvent.change(await screen.findByLabelText("Admission Number"), {
    target: { value: admission },
  });
  fireEvent.change(screen.getByLabelText("Last 4 digits of Phone Number"), {
    target: { value: phone },
  });
  fireEvent.click(screen.getByRole("button", { name: /continue to questions/i }));
}

function answerEveryQuestion(container: HTMLElement) {
  for (const questionId of QUESTION_IDS) {
    const firstOption = container.querySelector(
      `input[name="${questionId}"]`,
    ) as HTMLInputElement | null;
    expect(firstOption).not.toBeNull();
    if (firstOption) {
      fireEvent.click(firstOption);
    }
  }
}

describe("StudentForm states", () => {
  beforeEach(() => {
    getPublicFormConfigMock.mockReset();
    submitPublicFormMock.mockReset();
    getPublicFormConfigMock.mockResolvedValue(VALID_CONFIG);
  });

  it("shows a loading note while the form config is read", () => {
    getPublicFormConfigMock.mockReturnValue(new Promise(() => {}));

    renderForm();

    expect(screen.getByText("Loading the form")).toBeInTheDocument();
  });

  it("explains a link that is no longer valid", async () => {
    getPublicFormConfigMock.mockResolvedValue({ token_valid: false });

    renderForm();

    expect(await screen.findByText("This link is not valid")).toBeInTheDocument();
    expect(screen.getByText("Nothing was submitted.")).toBeInTheDocument();
  });

  it("explains a link whose config could not be read", async () => {
    getPublicFormConfigMock.mockRejectedValue(new Error("expired"));

    renderForm();

    expect(await screen.findByText("This link is not valid")).toBeInTheDocument();
  });

  it("validates the four-digit phone suffix and strips non-digits as they are typed", async () => {
    renderForm();

    fireEvent.change(await screen.findByLabelText("Admission Number"), {
      target: { value: "ADM501" },
    });
    fireEvent.change(screen.getByLabelText("Last 4 digits of Phone Number"), {
      target: { value: "12ab34" },
    });

    expect(screen.getByLabelText("Last 4 digits of Phone Number")).toHaveValue("1234");

    fireEvent.change(screen.getByLabelText("Last 4 digits of Phone Number"), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue to questions/i }));

    expect(
      screen.getByText("Please enter the last 4 digits of your phone number."),
    ).toBeInTheDocument();
  });

  it("reports a response the backend rejected without moving to success", async () => {
    submitPublicFormMock.mockResolvedValue({ success: false, message: "" });

    const { container } = renderForm();

    await answerIdentity();
    answerEveryQuestion(container);
    fireEvent.click(screen.getByRole("button", { name: /submit preferences/i }));

    expect(
      await screen.findByText("Invalid identity verification."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Thank you")).not.toBeInTheDocument();
  });

  it("reports a submission that failed at the network boundary", async () => {
    submitPublicFormMock.mockRejectedValue(new Error("network down"));

    const { container } = renderForm();

    await answerIdentity();
    answerEveryQuestion(container);
    fireEvent.click(screen.getByRole("button", { name: /submit preferences/i }));

    expect(await screen.findByText("network down")).toBeInTheDocument();
    expect(screen.queryByText("Thank you")).not.toBeInTheDocument();
  });

  it("records the response and shows the backend message", async () => {
    submitPublicFormMock.mockResolvedValue({
      success: true,
      message: "Your response has been recorded.",
      has_preferences: true,
    });

    const { container } = renderForm();

    await answerIdentity("ADM777", "9876");
    answerEveryQuestion(container);
    fireEvent.click(screen.getByRole("button", { name: /submit preferences/i }));

    expect(await screen.findByText("Response recorded.")).toBeInTheDocument();
    expect(screen.getByText("Your response has been recorded.")).toBeInTheDocument();
    expect(submitPublicFormMock).toHaveBeenCalledWith("test-token", {
      admission_number: "ADM777",
      phone_last4: "9876",
      q1_raw: expect.any(String),
      q2_raw: expect.any(String),
      q3_raw: expect.any(String),
      q4a_raw: expect.any(String),
      q4b_raw: expect.any(String),
      q5a_raw: expect.any(String),
      q5b_raw: expect.any(String),
      q6_raw: expect.any(String),
      q7_raw: expect.any(String),
      q8_raw: expect.any(String),
      q9_raw: expect.any(String),
      q10_raw: expect.any(String),
    });
  });

  it("counts answers and can go back to the identity step", async () => {
    renderForm();

    await answerIdentity();

    expect(screen.getByText("0 of 12 answered. Answers are saved only when you submit.")).toBeInTheDocument();

    const firstOption = document.querySelector('input[name="q1_raw"]') as HTMLInputElement;
    fireEvent.click(firstOption);
    expect(screen.getByText("1 of 12 answered")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByText("Who is answering")).toBeInTheDocument();
    expect(screen.getByLabelText("Admission Number")).toHaveValue("ADM501");
  });

  it("falls back to the product name when the workspace is unknown", async () => {
    getPublicFormConfigMock.mockResolvedValue({
      token_valid: true,
      workspace_name: null,
      questions: [],
    });

    renderForm();

    await waitFor(() =>
      expect(screen.getByText("Roommate Matcher")).toBeInTheDocument(),
    );
    expect(screen.getByText("Roommate preferences.")).toBeInTheDocument();
  });
});
