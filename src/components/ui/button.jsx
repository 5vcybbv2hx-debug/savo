import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /* Drei Varianten: primär · sekundär (Rahmen) · ghost (nur Text) */
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border border-border bg-card text-foreground hover:bg-secondary",
        ghost:
          "text-foreground hover:bg-secondary",
        /* Nur für Fehler/Löschen — Statusfarbe mit Bedeutung */
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        /* Altbestand: auf die drei Varianten abgebildet, keine Modulfarben */
        secondary:
          "border border-border bg-card text-foreground hover:bg-secondary",
        link:
          "text-primary underline-offset-4 hover:underline",
        success:
          "bg-primary text-primary-foreground hover:bg-primary/90",
        warning:
          "bg-primary text-primary-foreground hover:bg-primary/90",
      },
      size: {
        default: "h-9 px-4",
        sm:      "h-8 rounded-lg px-3 text-xs",
        lg:      "h-11 px-5",
        xl:      "h-11 px-5",
        icon:    "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size:    "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }