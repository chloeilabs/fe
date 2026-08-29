type FmpResponse<T> = {
  data: T;
  mode: "live" | "sample";
  configured?: boolean;
  error?: string;
};

export async function fetchFmp<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}) {
  const qs = new URLSearchParams({ path });
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    qs.set(key, String(value));
  }
  const res = await fetch(`/api/fmp?${qs.toString()}`);
  const json = (await res.json()) as FmpResponse<T> & { error?: string };
  if (!res.ok) throw new Error(json.error || "Market data request failed");
  return json;
}

/** Live FMP plans omit some endpoints; never fail a page for an optional surface. */
export async function fetchFmpOptional<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T | null> {
  try {
    const json = await fetchFmp<T>(path, params);
    return json.data ?? null;
  } catch {
    return null;
  }
}
