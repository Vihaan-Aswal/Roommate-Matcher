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
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
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
