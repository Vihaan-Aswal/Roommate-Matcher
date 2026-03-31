import { Badge, type BadgeProps } from "./ui/badge";
import { cn } from "../lib/utils";

interface StatusBadgeProps {
  value: string;
}

function resolveTone(value: string): Pick<BadgeProps, "variant" | "className"> {
  const normalized = value.toLowerCase();

  if (
    normalized === "ready" ||
    normalized === "completed" ||
    normalized === "excellent" ||
    normalized === "valid" ||
    normalized === "healthy"
  ) {
    return {
      variant: "secondary",
      className: "border-emerald-200 bg-emerald-100 text-emerald-800",
    };
  }

  if (
    normalized === "risk" ||
    normalized === "running" ||
    normalized === "pending" ||
    normalized === "okay" ||
    normalized === "needs review"
  ) {
    return {
      variant: "secondary",
      className: "border-amber-200 bg-amber-100 text-amber-800",
    };
  }

  if (
    normalized === "impossible" ||
    normalized === "failed" ||
    normalized === "poor" ||
    normalized === "invalid"
  ) {
    return {
      variant: "destructive",
      className: "border-destructive/30 bg-destructive/20 text-destructive",
    };
  }

  if (normalized === "good") {
    return {
      variant: "secondary",
      className: "border-sky-200 bg-sky-100 text-sky-800",
    };
  }

  return {
    variant: "outline",
    className: "border-border/90 bg-white text-foreground",
  };
}

export function StatusBadge({ value }: StatusBadgeProps): JSX.Element {
  const tone = resolveTone(value);

  return (
    <Badge variant={tone.variant} className={cn("capitalize", tone.className)}>
      {value}
    </Badge>
  );
}
