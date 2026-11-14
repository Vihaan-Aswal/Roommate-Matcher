import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface DetailSidePanelShellProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A paper drawer for one record. Escape closes it, focus moves into it on open,
 * and the scrim is a real control rather than a decorative div.
 */
export function DetailSidePanelShell({
  open,
  title,
  description,
  onClose,
  children,
}: DetailSidePanelShellProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="desk-drawer">
      <button
        aria-label="Close the detail panel"
        className="desk-drawer-scrim"
        type="button"
        onClick={onClose}
      />
      <div
        aria-labelledby="desk-drawer-title"
        aria-modal="true"
        className="desk-drawer-panel"
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="desk-drawer-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="desk-drawer-title" id="desk-drawer-title">
              {title}
            </h2>
            {description ? <p className="desk-dateline">{description}</p> : null}
          </div>
          <button
            aria-label="Close"
            className="desk-btn desk-btn-ghost desk-btn-sm"
            ref={closeRef}
            type="button"
            onClick={onClose}
          >
            <X size={14} strokeWidth={1.8} aria-hidden="true" />
            Close
          </button>
        </div>
        <div className="desk-drawer-body">{children}</div>
      </div>
    </div>
  );
}
