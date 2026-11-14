interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
}

/**
 * A single figure in a run of figures. Kept API-compatible with the old card
 * (label/value/hint + the `stat-*` test id) but rendered as a ruled cell, so a
 * row of them reads as one instrument rather than four cards.
 */
export function StatCard({ label, value, hint }: StatCardProps): JSX.Element {
  const testId = `stat-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="desk-figure" data-testid={testId}>
      <p className="desk-figure-label">{label}</p>
      <p className="desk-figure-value">{value}</p>
      {hint ? <p className="desk-figure-hint">{hint}</p> : null}
    </div>
  );
}
