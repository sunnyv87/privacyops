import { cn } from "@/lib/utils";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  variant?: "default" | "muted" | "radial" | "dark" | "featured" | "emerald";
  container?: boolean;
  pattern?: "none" | "grid" | "grid-dense" | "dots";
}

export function Section({
  className,
  variant = "default",
  container = true,
  pattern = "none",
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(
        "relative py-24 lg:py-32",
        variant === "muted" && "bg-muted/50",
        variant === "radial" && "radial-section",
        variant === "dark" && "bg-background",
        variant === "featured" && "bg-surface-elevated/30",
        variant === "emerald" && "radial-emerald",
        pattern === "grid" && "grid-bg",
        pattern === "grid-dense" && "grid-bg-dense",
        pattern === "dots" && "dot-bg",
        className
      )}
      {...props}
    >
      {container ? (
        <div className="mx-auto max-w-7xl px-6 lg:px-8">{children}</div>
      ) : (
        children
      )}
    </section>
  );
}

interface SectionHeaderProps {
  badge?: string;
  badgeVariant?: "primary" | "cyan" | "purple" | "emerald" | "amber";
  title: string;
  titleGradient?: string;
  description?: string;
  align?: "left" | "center";
  eyebrow?: string;
}

const badgeColorMap = {
  primary: "border-primary/20 bg-primary/5 text-primary",
  cyan: "border-cyan-500/20 bg-cyan-500/5 text-cyan-400",
  purple: "border-purple-500/20 bg-purple-500/5 text-purple-400",
  emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
  amber: "border-amber-500/20 bg-amber-500/5 text-amber-400",
};

export function SectionHeader({
  badge,
  badgeVariant = "primary",
  title,
  titleGradient,
  description,
  align = "center",
  eyebrow,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "max-w-3xl mb-16",
        align === "center" && "mx-auto text-center"
      )}
    >
      {eyebrow && (
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
          {eyebrow}
        </div>
      )}
      {badge && (
        <div
          className={cn(
            "inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-medium mb-6",
            badgeColorMap[badgeVariant]
          )}
        >
          {badge}
        </div>
      )}
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl text-balance">
        {titleGradient ? (
          <>
            {title}{" "}
            <span className="gradient-text">{titleGradient}</span>
          </>
        ) : (
          title
        )}
      </h2>
      {description && (
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed text-pretty">
          {description}
        </p>
      )}
    </div>
  );
}
