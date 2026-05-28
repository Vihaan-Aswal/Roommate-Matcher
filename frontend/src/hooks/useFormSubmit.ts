import { useState } from "react";

import {
  type FormSubmissionPayload,
  type FormSubmissionResult,
  submitPublicForm,
} from "../lib/apiClient";

interface UseFormSubmitResult {
  submit: (token: string, payload: FormSubmissionPayload) => Promise<FormSubmissionResult>;
  submitting: boolean;
  submitError: string | null;
}

export function useFormSubmit(): UseFormSubmitResult {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async (
    token: string,
    payload: FormSubmissionPayload,
  ): Promise<FormSubmissionResult> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitPublicForm(token, payload);
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit.";
      setSubmitError(message);
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  return { submit, submitting, submitError };
}
