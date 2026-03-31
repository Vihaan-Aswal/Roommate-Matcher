import type { ReactNode } from "react";

interface AdminPageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: AdminPageHeaderProps): JSX.Element {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1">
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
