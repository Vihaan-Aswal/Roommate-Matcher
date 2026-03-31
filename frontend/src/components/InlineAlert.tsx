import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

interface InlineAlertProps {
  title: string;
  message: string;
  tone?: "info" | "success" | "error";
  actions?: ReactNode;
}

export function InlineAlert({
  title,
  message,
  tone = "info",
  actions,
}: InlineAlertProps): JSX.Element {
  const classNameByTone = {
    info: "border-border bg-secondary/40",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-destructive/30 bg-destructive/10",
  };

  return (
    <Alert className={classNameByTone[tone]}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      {actions ? <div className="mt-3">{actions}</div> : null}
    </Alert>
  );
}
