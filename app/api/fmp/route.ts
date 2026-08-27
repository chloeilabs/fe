import { NextRequest } from "next/server";

import { FmpError, fmpFetch, hasFmpKey, isAllowedPath } from "@/lib/fmp/client";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");
  if (path === "status") {
    return Response.json({ configured: hasFmpKey(), mode: hasFmpKey() ? "live" : "sample" });
  }
  if (!path || !isAllowedPath(path)) {
    return Response.json({ error: "Unknown FMP path" }, { status: 400 });
  }

  const params: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    if (key !== "path" && key !== "apikey") params[key] = value;
  });

  try {
    const result = await fmpFetch(path, params);
    return Response.json({ ...result, configured: hasFmpKey() });
  } catch (error) {
    const status = error instanceof FmpError ? error.status : 502;
    const message = error instanceof Error ? error.message : "FMP request failed";
    return Response.json({ error: message, configured: hasFmpKey() }, { status });
  }
}
