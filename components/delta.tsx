import { clsDelta, pctPoints } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Delta({
  value,
  points = false,
  className,
}: {
  value: number | null | undefined;
  points?: boolean;
  className?: string;
}) {
  if (value == null || Number.isNaN(value)) return <span className="text-muted-foreground">—</span>;
  const display = points ? pctPoints(value) : pctPoints(value * 100);
  return <span className={cn("tabular-nums font-medium", clsDelta(value), className)}>{display}</span>;
}

export function DeltaFromPercent(props: { value: number | null | undefined; className?: string }) {
  return <Delta {...props} points />;
}
