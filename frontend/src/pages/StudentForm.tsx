import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

import { FormQuestion } from "../components/FormQuestion";
import { useFormSubmit } from "../hooks/useFormSubmit";
import { QUESTION_CONFIGS, type QuestionConfig } from "../lib/formQuestions";
import { getPublicFormConfig } from "../lib/apiClient";

type Step = "identity" | "questions" | "success";

type AnswerMap = Record<QuestionConfig["id"], string>;

const EMPTY_ANSWERS: AnswerMap = {
  q1_raw: "",
  q2_raw: "",
  q3_raw: "",
  q4a_raw: "",
  q4b_raw: "",
  q5a_raw: "",
  q5b_raw: "",
  q6_raw: "",
  q7_raw: "",
  q8_raw: "",
  q9_raw: "",
  q10_raw: "",
};

export function StudentForm(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>("identity");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [answers, setAnswers] = useState<AnswerMap>(EMPTY_ANSWERS);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [questionErrors, setQuestionErrors] = useState<Partial<AnswerMap>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const { submit, submitting, submitError } = useFormSubmit();

  const { data: config, isLoading, isError } = useQuery({
    queryKey: ["publicForm", token],
    queryFn: () => getPublicFormConfig(token ?? ""),
    enabled: !!token,
    retry: false,
  });

  const completedCount = useMemo(
    () => Object.values(answers).filter(Boolean).length,
    [answers],
  );

  if (isLoading) {
    return (
      <div className="desk desk-canvas">
        <div className="desk-canvas-inner" style={{ maxWidth: 700 }}>
          <p className="desk-mono" style={{ color: "var(--ink-faint)" }}>
            Loading the form
          </p>
          <div className="desk-skel" style={{ height: 220, marginTop: 14 }} />
        </div>
      </div>
    );
  }

  if (isError || !config || !config.token_valid) {
    return (
      <div className="desk desk-canvas">
        <div className="desk-canvas-inner" style={{ maxWidth: 620 }}>
          <p className="desk-canvas-mark">Roommate Matcher</p>
          <div className="desk-sheet" style={{ marginTop: 22, padding: "28px 26px" }}>
            <h1 style={{ fontSize: "1.5rem", lineHeight: 1.15 }}>This link is not valid</h1>
            <p className="desk-help" style={{ marginTop: 10 }}>
              It may have expired, or it may have been replaced by a newer link. Ask the hostel office
              for the current link — you do not need an account to use it.
            </p>
            <p className="desk-mono" style={{ marginTop: 16, color: "var(--paper-mid)" }}>
              Nothing was submitted.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const validateIdentity = (): boolean => {
    if (!admissionNumber.trim()) {
      setIdentityError("Admission number is required.");
      return false;
    }
    if (!phoneLast4.trim() || phoneLast4.trim().length !== 4) {
      setIdentityError("Please enter the last 4 digits of your phone number.");
      return false;
    }

    setIdentityError(null);
    return true;
  };

  const goToQuestions = (): void => {
    if (!validateIdentity()) {
      return;
    }
    setStep("questions");
  };

  const handleAnswerChange = (id: QuestionConfig["id"], value: string): void => {
    setAnswers((previous) => ({ ...previous, [id]: value }));
    setQuestionErrors((previous) => ({ ...previous, [id]: undefined }));
    setStatusMessage(null);
  };

  const validateQuestions = (): boolean => {
    const nextErrors: Partial<AnswerMap> = {};
    for (const question of QUESTION_CONFIGS) {
      if (!answers[question.id]) {
        nextErrors[question.id] = "Please select one option.";
      }
    }

    setQuestionErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (): Promise<void> => {
    if (!validateQuestions()) {
      setStatusMessage("Please answer all questions before submitting.");
      return;
    }

    try {
      if (!token) return;
      const response = await submit(token, {
        admission_number: admissionNumber.trim(),
        phone_last4: phoneLast4.trim(),
        ...answers,
      });

      if (response.success) {
        setStep("success");
        setStatusMessage(response.message);
      } else {
        setStatusMessage(response.message || "Invalid identity verification.");
      }
    } catch {
      // Rendered from submitError.
    }
  };

  const workspaceLabel = config.workspace_name ?? null;

  return (
    <div className="desk desk-canvas desk-form">
      <div className="desk-canvas-inner" style={{ maxWidth: 720 }}>
        <header className="desk-stack-sm" style={{ gap: 6, marginBottom: 20 }}>
          <p className="desk-mono" style={{ color: "var(--ink-faint)" }}>
            {workspaceLabel ? `${workspaceLabel} · Roommate Matcher` : "Roommate Matcher"}
          </p>
          <h1
            style={{
              color: "var(--ink)",
              fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
              lineHeight: 1.05,
              fontWeight: 800,
            }}
          >
            {step === "success" ? "Response recorded." : "Roommate preferences."}
          </h1>
          <p className="desk-canvas-lede">
            {step === "questions"
              ? `${completedCount} of 12 answered. Answers are saved only when you submit.`
              : "Twelve questions, one sitting. You verify yourself against the roster first."}
          </p>
        </header>

        <main className="desk-sheet" style={{ padding: "22px 22px 24px" }}>
          {step === "identity" ? (
            <div className="desk-stack">
              <div className="desk-stack-sm" style={{ gap: 4 }}>
                <p className="desk-overline">Step 1 of 2</p>
                <h2 style={{ fontSize: "1.3rem" }}>Who is answering</h2>
                <p className="desk-help">
                  We match these two fields against the roster. They are not shared with anyone.
                </p>
              </div>

              <div className="desk-stack-sm" style={{ gap: 14 }}>
                <label className="desk-field">
                  <span className="desk-label">Admission Number</span>
                  <input
                    className="desk-input"
                    type="text"
                    autoComplete="off"
                    value={admissionNumber}
                    aria-invalid={identityError ? true : undefined}
                    onChange={(event) => setAdmissionNumber(event.target.value)}
                    placeholder="e.g. ADM0241"
                  />
                </label>

                <label className="desk-field">
                  <span className="desk-label">Last 4 digits of Phone Number</span>
                  <input
                    className="desk-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    autoComplete="off"
                    value={phoneLast4}
                    aria-invalid={identityError ? true : undefined}
                    onChange={(event) => setPhoneLast4(event.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 1234"
                  />
                </label>

                <div aria-live="polite">
                  {identityError ? (
                    <p className="desk-error" role="alert">
                      {identityError}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="desk-row" style={{ justifyContent: "flex-end" }}>
                <button className="desk-btn desk-btn-lg" type="button" onClick={goToQuestions}>
                  Continue to Questions
                  <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}

          {step === "questions" ? (
            <div className="desk-stack">
              <div className="desk-stack-sm" style={{ gap: 4 }}>
                <p className="desk-overline">Step 2 of 2</p>
                <h2 style={{ fontSize: "1.3rem" }}>Twelve questions</h2>
                <p className="desk-help">
                  Answer every question. A missing answer is treated as “no preference”, which weakens
                  your score.
                </p>
              </div>

              <div className="desk-stack-sm" style={{ gap: 0 }}>
                {QUESTION_CONFIGS.map((question, index) => (
                  <FormQuestion
                    key={question.id}
                    id={question.id}
                    index={index}
                    title={question.title}
                    prompt={question.prompt}
                    options={question.options}
                    value={answers[question.id]}
                    error={questionErrors[question.id]}
                    onChange={(value) => handleAnswerChange(question.id, value)}
                  />
                ))}
              </div>

              <div aria-live="polite">
                {statusMessage ? (
                  <p className="desk-error" role="alert">
                    {statusMessage}
                  </p>
                ) : null}
                {submitError ? (
                  <p className="desk-error" role="alert">
                    {submitError}
                  </p>
                ) : null}
              </div>

              <div className="desk-form-bar">
                <p className="desk-mono" style={{ color: "var(--paper-mid)" }}>
                  {completedCount} of 12 answered
                </p>
                <div className="desk-row" style={{ gap: 8 }}>
                  <button
                    className="desk-btn desk-btn-ghost"
                    type="button"
                    onClick={() => setStep("identity")}
                  >
                    Back
                  </button>
                  <button
                    className="desk-btn desk-btn-lg"
                    type="button"
                    onClick={() => {
                      void handleSubmit();
                    }}
                    disabled={submitting}
                  >
                    {submitting ? "Submitting…" : "Submit Preferences"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {step === "success" ? (
            <div className="desk-stack m-stamp">
              <div className="desk-row" style={{ gap: 8, color: "var(--wax)" }}>
                <Check size={18} strokeWidth={2.2} aria-hidden="true" />
                <p className="desk-overline">Submitted</p>
              </div>
              <h2 style={{ fontSize: "1.5rem" }}>Thank you</h2>
              <p className="desk-body">
                {statusMessage ?? "Your response has been recorded successfully."}
              </p>
              <p className="desk-help">
                Your latest valid response is the one that counts. If you submit again, it replaces this
                one. You can close this page.
              </p>
            </div>
          ) : null}
        </main>

        <p className="desk-mono" style={{ marginTop: 18, color: "var(--ink-faint)", lineHeight: 1.6 }}>
          The hostel office reads the reasons for a placement, never your raw answers.
        </p>
      </div>
    </div>
  );
}
