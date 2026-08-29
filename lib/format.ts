const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pctFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

const pctPlain = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(value: number | null | undefined, compact = false) {
  if (value == null || Number.isNaN(value)) return "—";
  if (!compact) return moneyFmt.format(value);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const fmt = (n: number, suffix: string, digits: number) => `${sign}$${n.toFixed(digits)}${suffix}`;
  if (abs >= 1e12) return fmt(abs / 1e12, "T", 2);
  if (abs >= 1e9) return fmt(abs / 1e9, "B", 2);
  if (abs >= 1e6) return fmt(abs / 1e6, "M", 2);
  if (abs >= 1e3) return fmt(abs / 1e3, "k", 1);
  return moneyFmt.format(value);
}

export function num(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function pct(value: number | null | undefined, signed = true) {
  if (value == null || Number.isNaN(value)) return "—";
  return (signed ? pctFmt : pctPlain).format(value);
}

export function pctPoints(value: number | null | undefined, signed = true) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${signed && value > 0 ? "+" : ""}${numberFmt.format(value)}%`;
}

export function shares(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  }).format(value);
}

export function isoDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** FMP etf/country-weightings sends "97.26%" strings. */
export function parseWeightPct(raw: string | number | undefined): number {
  if (typeof raw === "number") return Math.abs(raw) > 1.5 ? raw / 100 : raw;
  if (!raw) return 0;
  const n = Number(String(raw).replace(/%/g, "").trim());
  return Number.isFinite(n) ? n / 100 : 0;
}

export function clsDelta(value: number | null | undefined) {
  if (value == null || Number.isNaN(value) || value === 0) return "text-muted-foreground";
  return value > 0 ? "text-gain" : "text-loss";
}
