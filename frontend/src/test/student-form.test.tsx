import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./renderWithProviders";
import { vi } from "vitest";

import { StudentForm } from "../pages/StudentForm";
import { Route, Routes } from "react-router-dom";

const { submitMock } = vi.hoisted(() => ({
  submitMock: vi.fn(),
}));

vi.mock("../hooks/useFormSubmit", () => ({
  useFormSubmit: () => ({
    submit: submitMock,
    submitting: false,
    submitError: null,
  }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: () => ({
      data: {
        token_valid: true,
        workspace_name: "Test Workspace",
        questions: [
          { id: "q1_raw", type: "single_choice", required: true, label: "Q1" },
          { id: "q2_raw", type: "single_choice", required: true, label: "Q2" },
          { id: "q3_raw", type: "single_choice", required: true, label: "Q3" },
          { id: "q4a_raw", type: "single_choice", required: true, label: "Q4a" },
          { id: "q4b_raw", type: "single_choice", required: true, label: "Q4b" },
          { id: "q5a_raw", type: "single_choice", required: true, label: "Q5a" },
          { id: "q5b_raw", type: "single_choice", required: true, label: "Q5b" },
          { id: "q6_raw", type: "single_choice", required: true, label: "Q6" },
          { id: "q7_raw", type: "single_choice", required: true, label: "Q7" },
          { id: "q8_raw", type: "single_choice", required: true, label: "Q8" },
          { id: "q9_raw", type: "single_choice", required: true, label: "Q9" },
          { id: "q10_raw", type: "single_choice", required: true, label: "Q10" }
        ]
      },
      isLoading: false,
      isError: false,
    }),
  };
});

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

describe("StudentForm", () => {
  beforeEach(() => {
    submitMock.mockReset();
  });

  it("shows identity validation errors", () => {
    renderWithProviders(
      <Routes>
        <Route path="/:token" element={<StudentForm />} />
      </Routes>,
      { initialEntries: ["/test-token"] },
    );

    fireEvent.click(
      screen.getByRole("button", { name: /continue to questions/i }),
    );

    expect(
      screen.getByText("Admission number is required."),
    ).toBeInTheDocument();
  });

  it("validates unanswered questions before submit", () => {
    renderWithProviders(
      <Routes>
        <Route path="/:token" element={<StudentForm />} />
      </Routes>,
      { initialEntries: ["/test-token"] },
    );

    fireEvent.change(screen.getByLabelText("Admission Number"), {
      target: { value: "ADM500" },
    });
    fireEvent.change(screen.getByLabelText("Last 4 digits of Phone Number"), {
      target: { value: "1234" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /continue to questions/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /submit preferences/i }),
    );

    expect(
      screen.getByText("Please answer all questions before submitting."),
    ).toBeInTheDocument();
  });

  it("submits successfully after all answers are selected", async () => {
    submitMock.mockResolvedValue({
      success: true,
      message: "Form response recorded successfully.",
      has_preferences: true,
    });

    const { container } = renderWithProviders(
      <Routes>
        <Route path="/:token" element={<StudentForm />} />
      </Routes>,
      { initialEntries: ["/test-token"] },
    );

    fireEvent.change(screen.getByLabelText("Admission Number"), {
      target: { value: "ADM501" },
    });
    fireEvent.change(screen.getByLabelText("Last 4 digits of Phone Number"), {
      target: { value: "1234" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /continue to questions/i }),
    );

    for (const questionId of QUESTION_IDS) {
      const firstOption = container.querySelector(
        `input[name="${questionId}"]`,
      ) as HTMLInputElement | null;
      expect(firstOption).not.toBeNull();
      if (firstOption) {
        fireEvent.click(firstOption);
      }
    }

    fireEvent.click(
      screen.getByRole("button", { name: /submit preferences/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Thank you")).toBeInTheDocument();
    });

    expect(submitMock).toHaveBeenCalledOnce();
  });
});
