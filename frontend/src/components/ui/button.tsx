import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

/**
 * Pill control on paper. Variants map to the desk palette: `default` is wax
 * (the mark), `outline` is a hairline ghost, `ghost`/`link` are quiet.
 * Sizes stay at or above the 30px compact / 42px touch floor set in desk.css.
 */
const buttonVariants = cva("desk-btn", {
  variants: {
    variant: {
      default: "",
      accent: "",
      secondary: "desk-btn-ghost",
      outline: "desk-btn-ghost",
      ghost: "desk-btn-quiet",
      link: "desk-btn-quiet",
      destructive: "desk-btn-danger",
      field: "desk-btn-field",
    },
    size: {
      default: "",
      sm: "desk-btn-sm",
      lg: "desk-btn-lg",
      icon: "desk-btn-sm",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...(asChild ? {} : { type: type ?? "button" })}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
