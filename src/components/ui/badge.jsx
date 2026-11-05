import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

/* Status-Chip: 11 px, 3/8 px Padding, 99 px Radius, getönte Fläche.
   Varianten tragen Bedeutung — Akzent, Grün, Amber, Rot. Keine Modulfarben. */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-medium leading-none border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:     "border-transparent bg-primary/15 text-primary",
        secondary:   "border-border bg-surface text-muted-foreground",
        destructive: "border-status-danger/30 bg-status-danger/15 text-status-danger",
        outline:     "border-border text-foreground bg-transparent",
        success:     "border-status-ok/30 bg-status-ok/15 text-status-ok",
        status:      "border-status-ok/30 bg-status-ok/15 text-status-ok",
        warning:     "border-status-warn/30 bg-status-warn/15 text-status-warn",
        info:        "border-primary/30 bg-primary/15 text-primary",
        muted:       "border-border bg-surface text-muted-foreground",
        skill:       "border-status-warn/30 bg-status-warn/15 text-status-warn",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }