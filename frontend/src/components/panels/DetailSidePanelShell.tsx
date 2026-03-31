import type { ReactNode } from "react";

import { Button } from "../ui/button";
import { Sheet, SheetContent } from "../ui/sheet";

interface DetailSidePanelShellProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

export function DetailSidePanelShell({
  open,
  title,
  description,
  onClose,
  children,
}: DetailSidePanelShellProps): JSX.Element {
  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent>
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-serif text-2xl font-semibold">{title}</h3>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
