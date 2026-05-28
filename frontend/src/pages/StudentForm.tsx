import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

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
      <main className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#f9f4de_0%,_#f4f8fc_38%,_#ecfaf3_100%)]">
        <p className="text-muted-foreground">Loading form...</p>
      </main>
    );
  }

  if (isError || !config || !config.token_valid) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#f9f4de_0%,_#f4f8fc_38%,_#ecfaf3_100%)]">
        <section className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-white/90 p-8 text-center shadow-xl backdrop-blur-sm">
          <h1 className="font-serif text-2xl font-semibold text-foreground">Form Unavailable</h1>
          <p className="mt-4 text-muted-foreground">This link has expired or is invalid.</p>
        </section>
      </main>
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

  const handleAnswerChange = (
    id: QuestionConfig["id"],
    value: string,
  ): void => {
    setAnswers((previous) => ({ ...previous, [id]: value }));
    setQuestionErrors((previous) => ({ ...previous, [id]: undefined }));
    setStatusMessage(null);
  };

  const validateQuestions = (): boolean => {
    const nextErrors: Partial<AnswerMap> = {};
    for (const config of QUESTION_CONFIGS) {
      if (!answers[config.id]) {
        nextErrors[config.id] = "Please select one option.";
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
      // Error state is rendered via submitError from the hook.
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f9f4de_0%,_#f4f8fc_38%,_#ecfaf3_100%)] px-4 py-8 sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-border/80 bg-white/90 shadow-xl backdrop-blur-sm">
        <header className="border-b border-border/70 bg-[linear-gradient(100deg,#fff6d8_0%,#f2f8ff_55%,#e6f8ef_100%)] px-5 py-6 sm:px-8">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {config.workspace_name ? `Submitting form for: ${config.workspace_name}` : "Student Preference Form"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Complete identity verification and answer all 12 preference prompts.
          </p>
          {step !== "success" ? (
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary sm:text-sm">
              {step === "identity"
                ? "Step 1 of 2 Identity"
                : `Step 2 of 2 Questions (${completedCount}/12 answered)`}
            </p>
          ) : null}
        </header>

        <div className="px-5 py-6 sm:px-8 sm:py-8">
          {step === "identity" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">
                  Admission Number
                </span>
                <input
                  type="text"
                  value={admissionNumber}
                  onChange={(event) => setAdmissionNumber(event.target.value)}
                  className="w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm text-foreground outline-none ring-0 transition focus:border-primary focus:shadow-[0_0_0_2px_rgba(227,108,27,0.18)]"
                  placeholder="e.g. ADM0241"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">
                  Last 4 digits of Phone Number
                </span>
                <input
                  type="text"
                  maxLength={4}
                  value={phoneLast4}
                  onChange={(event) => setPhoneLast4(event.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm text-foreground outline-none ring-0 transition focus:border-primary focus:shadow-[0_0_0_2px_rgba(227,108,27,0.18)]"
                  placeholder="e.g. 1234"
                />
              </label>

              {identityError ? (
                <p className="sm:col-span-2 text-sm text-destructive">
                  {identityError}
                </p>
              ) : null}

              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={goToQuestions}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Continue to Questions
                </button>
              </div>
            </div>
          ) : null}

          {step === "questions" ? (
            <div className="space-y-5">
              {QUESTION_CONFIGS.map((question) => (
                <FormQuestion
                  key={question.id}
                  id={question.id}
                  title={question.title}
                  prompt={question.prompt}
                  options={question.options}
                  value={answers[question.id]}
                  error={questionErrors[question.id]}
                  onChange={(value) => handleAnswerChange(question.id, value)}
                />
              ))}

              {statusMessage ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {statusMessage}
                </p>
              ) : null}

              {submitError ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {submitError}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep("identity")}
                  className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleSubmit();
                  }}
                  disabled={submitting}
                  className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? "Submitting..." : "Submit Preferences"}
                </button>
              </div>
            </div>
          ) : null}

          {step === "success" ? (
            <section className="rounded-2xl border border-accent/35 bg-accent/10 p-6 text-center">
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                Thank you
              </h2>
              <p className="mt-2 text-sm text-foreground sm:text-base">
                {statusMessage ??
                  "Your response has been recorded successfully."}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                You may close this page now.
              </p>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
