import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  line: string;
  action?: ReactNode;
  /** "good" for a settled state (nothing outstanding), default for a gap. */
  tone?: "good";
}

export function EmptyState({ title, line, action, tone }: EmptyStateProps): JSX.Element {
  return (
    <div className="desk-empty" data-tone={tone}>
      <p className="desk-empty-title">{title}</p>
      <p className="desk-empty-line">{line}</p>
      {action}
    </div>
  );
}
