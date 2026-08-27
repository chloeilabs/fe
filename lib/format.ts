const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const moneyCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const numberFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const pctFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

const pctPlain = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 2,
});

export function money(value: number | null | undefined, compact = false) {
  if (value == null || Number.isNaN(value)) return "—";
  return compact ? moneyCompact.format(value) : moneyFmt.format(value);
}

export function num(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function pct(value: number | null | undefined, signed = true) {
  if (value == null || Number.isNaN(value)) return "—";
  return (signed ? pctFmt : pctPlain).format(value);
}

export function pctPoints(value: number | null | undefined, signed = true) {
  if (value == null || Number.isNaN(value)) return "—";
  const formatted = `${signed && value > 0 ? "+" : ""}${numberFmt.format(value)}%`;
  return formatted;
}

export function shares(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function isoDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function clsDelta(value: number | null | undefined) {
  if (value == null || Number.isNaN(value) || value === 0) return "text-muted-foreground";
  return value > 0 ? "text-gain" : "text-loss";
}
