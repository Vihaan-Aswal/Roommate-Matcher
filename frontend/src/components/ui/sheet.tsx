import * as React from "react";

import { cn } from "../../lib/utils";

interface SheetContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheetContext(): SheetContextValue {
  const value = React.useContext(SheetContext);
  if (!value) {
    throw new Error("Sheet components must be used inside Sheet");
  }
  return value;
}

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Sheet({
  open,
  onOpenChange,
  children,
}: SheetProps): JSX.Element {
  return (
    <SheetContext.Provider value={{ open, onOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "left" | "right";
}

export const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, side = "right", children, ...props }, ref) => {
    const { open, onOpenChange } = useSheetContext();

    if (!open) {
      return null;
    }

    return (
      <div className="fixed inset-0 z-50">
        <button
          aria-label="Close details panel"
          className="absolute inset-0 bg-black/30"
          type="button"
          onClick={() => onOpenChange(false)}
        />
        <div
          ref={ref}
          className={cn(
            "absolute top-0 h-full w-full max-w-xl border-l border-border bg-white p-6 shadow-xl",
            side === "right" ? "right-0" : "left-0 border-r border-l-0",
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    );
  },
);

SheetContent.displayName = "SheetContent";
