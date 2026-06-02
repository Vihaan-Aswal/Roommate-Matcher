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
  const hasBlockedTerm = BLOCKED_TERMS.some((term) => {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escapedTerm}\\b`, 'i');
    return pattern.test(normalized);
  });

  if (!hasBlockedTerm) {
    return { text: reason, wasRedacted: false };
  }

  return {
    text: "Lifestyle preference alignment affects compatibility in this group.",
    wasRedacted: true,
  };
}
