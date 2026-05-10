import { cn } from "@/lib/utils";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  variant?: "default" | "muted" | "radial";
  container?: boolean;
}

export function Section({
  className,
  variant = "default",
  container = true,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(
        "relative py-24 lg:py-32",
        variant === "muted" && "bg-muted/50",
        variant === "radial" && "radial-section",
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
  title: string;
  titleGradient?: string;
  description?: string;
  align?: "left" | "center";
}

export function SectionHeader({
  badge,
  title,
  titleGradient,
  description,
  align = "center",
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "max-w-3xl mb-16",
        align === "center" && "mx-auto text-center"
      )}
    >
      {badge && (
        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary mb-6">
          {badge}
        </div>
      )}
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
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
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
