import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { StudentForm } from "../pages/StudentForm";

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
    render(<StudentForm />);

    fireEvent.click(
      screen.getByRole("button", { name: /continue to questions/i }),
    );

    expect(
      screen.getByText("Admission number is required."),
    ).toBeInTheDocument();
  });

  it("validates unanswered questions before submit", () => {
    render(<StudentForm />);

    fireEvent.change(screen.getByLabelText("Admission Number"), {
      target: { value: "ADM500" },
    });
    fireEvent.change(screen.getByLabelText("Date of Birth"), {
      target: { value: "2005-01-01" },
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

    const { container } = render(<StudentForm />);

    fireEvent.change(screen.getByLabelText("Admission Number"), {
      target: { value: "ADM501" },
    });
    fireEvent.change(screen.getByLabelText("Date of Birth"), {
      target: { value: "2005-01-01" },
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
