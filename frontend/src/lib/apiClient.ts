export interface FormSubmissionPayload {
  admission_number: string;
  dob: string;
  q1_raw: string;
  q2_raw: string;
  q3_raw: string;
  q4a_raw: string;
  q4b_raw: string;
  q5a_raw: string;
  q5b_raw: string;
  q6_raw: string;
  q7_raw: string;
  q8_raw: string;
  q9_raw: string;
  q10_raw: string;
}

export interface FormSubmissionResult {
  success: boolean;
  message: string;
  code?: string;
  has_preferences?: boolean;
}

function getApiBaseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return value ? value.replace(/\/$/, "") : "";
}

export async function submitStudentForm(
  payload: FormSubmissionPayload,
): Promise<FormSubmissionResult> {
  const response = await fetch(`${getApiBaseUrl()}/api/form/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as
    | FormSubmissionResult
    | { detail?: string | { code?: string; message?: string } };

  if (!response.ok) {
    const detail = "detail" in data ? data.detail : undefined;
    if (typeof detail === "object" && detail?.message) {
      throw new Error(detail.message);
    }
    if (typeof detail === "string") {
      throw new Error(detail);
    }
    throw new Error("Submission failed. Please try again.");
  }

  return data as FormSubmissionResult;
}
