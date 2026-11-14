import type { ReactNode } from "react";

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  /** The workspace this page belongs to; set in mono under the title. */
  workspace?: string;
  /** Mono dateline under the title: the evidence a reader needs (run, segment, mode). */
  meta?: ReactNode;
  actions?: ReactNode;
}

export function AdminPageHeader({
  title,
  description,
  workspace,
  meta,
  actions,
}: AdminPageHeaderProps): JSX.Element {
  const dateline = workspace || meta;

  return (
    <header className="desk-mast">
      <div className="desk-mast-main">
        <h1 className="desk-mast-title">{title}</h1>
        {dateline ? (
          <p className="desk-dateline">
            {workspace ? <span className="desk-dateline-ws">{workspace}</span> : null}
            {workspace && meta ? <span className="desk-sep desk-dateline-ws">·</span> : null}
            {meta}
          </p>
        ) : null}
        {description ? <p className="desk-mast-lede">{description}</p> : null}
      </div>
      {actions ? <div className="desk-mast-actions">{actions}</div> : null}
    </header>
  );
}
