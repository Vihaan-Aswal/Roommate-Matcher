const BLOCKED_TERMS = [
  "smoke",
  "smoking",
  "alcohol",
  "drinking",
  "drink",
  "vegetarian",
  "non-vegetarian",
  "non vegetarian",
  "meat",
  "diet",
];

export function sanitizeReasonText(reason: string): {
  text: string;
  wasRedacted: boolean;
} {
  const normalized = reason.toLowerCase();
  const hasBlockedTerm = BLOCKED_TERMS.some((term) =>
    normalized.includes(term),
  );

  if (!hasBlockedTerm) {
    return { text: reason, wasRedacted: false };
  }

  return {
    text: "Lifestyle preference alignment affects compatibility in this group.",
    wasRedacted: true,
  };
}
