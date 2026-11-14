import type { ReactNode } from "react";

interface InlineAlertProps {
  title: string;
  message: string;
  tone?: "info" | "success" | "error";
  actions?: ReactNode;
}

const TONE_MAP = {
  info: undefined,
  success: "success",
  error: "error",
} as const;

export function InlineAlert({
  title,
  message,
  tone = "info",
  actions,
}: InlineAlertProps): JSX.Element {
  return (
    <div className="desk-note" data-tone={TONE_MAP[tone]} role={tone === "error" ? "alert" : undefined}>
      <div>
        <p className="desk-note-title">{title}</p>
        <p className="desk-note-body">{message}</p>
        {actions ? <div className="desk-note-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
