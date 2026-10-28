import { ApiError } from "./domain.ts";

export async function fetchJson(url: string, init: RequestInit = {}, timeout = 8000): Promise<any> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new ApiError(503, "upstream_unavailable");
  return response.json();
}

// The gateway appends the address it received the connection from; earlier hops are client-controlled.
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "anonymous";
}
