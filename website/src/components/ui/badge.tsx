import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary border border-primary/20",
        secondary: "bg-secondary text-secondary-foreground border border-border",
        cyan: "bg-accent/10 text-accent border border-accent/20",
        purple: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
        green: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
        outline: "border border-border text-muted-foreground",
        amber: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
        danger: "bg-red-500/10 text-red-400 border border-red-500/20",
        dpdpa: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
        live: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tag-live",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
