"use client";

import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          variant === "default" &&
            "bg-primary text-primary-foreground hover:opacity-90",
          variant === "outline" &&
            "border border-border bg-transparent hover:bg-muted",
          variant === "ghost" && "hover:bg-muted",
          size === "default" && "px-4 py-2 text-sm",
          size === "sm" && "px-3 py-1.5 text-xs",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
