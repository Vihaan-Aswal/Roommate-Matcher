import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
}

export function StatCard({ label, value, hint }: StatCardProps): JSX.Element {
  const testId = `stat-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <Card className="border-border/80 bg-white/90" data-testid={testId}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
