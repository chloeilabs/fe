import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Kpi({
  label,
  value,
  hint,
  children,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card size="sm" className={cn("bg-card/80", className)}>
      <CardHeader className="gap-1">
        <CardDescription className="text-[11px] tracking-[0.14em] uppercase">{label}</CardDescription>
        <CardTitle className="font-mono text-2xl font-medium tracking-tight tabular-nums">{value}</CardTitle>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}
