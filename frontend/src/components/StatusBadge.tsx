interface StatusBadgeProps {
  value: string;
}

type Tone = "mark" | "attention" | "quiet" | undefined;

/**
 * Status chip. Amber is the attention colour, so it is only used for states a
 * person must act on (poor, at risk, needs review, failed). Settled states get
 * the wax mark; everything in between stays quiet.
 */
function resolveTone(value: string): Tone {
  const normalized = value.toLowerCase();

  if (
    normalized === "ready" ||
    normalized === "completed" ||
    normalized === "excellent" ||
    normalized === "valid"
  ) {
    return "mark";
  }

  if (
    normalized === "risk" ||
    normalized === "at risk" ||
    normalized === "poor" ||
    normalized === "needs review" ||
    normalized === "failed" ||
    normalized === "invalid" ||
    normalized === "impossible"
  ) {
    return "attention";
  }

  if (normalized === "healthy") {
    return "quiet";
  }

  if (normalized === "okay" || normalized === "good") {
    return undefined;
  }

  return undefined;
}

export function StatusBadge({ value }: StatusBadgeProps): JSX.Element {
  const tone = resolveTone(value);

  return (
    <span className="desk-chip" data-tone={tone}>
      {tone === "attention" ? <span className="desk-dot" data-tone="attention" aria-hidden="true" /> : null}
      <span className="capitalize">{value}</span>
    </span>
  );
}
