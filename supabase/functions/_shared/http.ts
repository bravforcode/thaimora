import { ApiError } from "./domain.ts";

export async function fetchJson(url: string, init: RequestInit = {}, timeout = 8000): Promise<any> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new ApiError(503, "upstream_unavailable");
  return response.json();
}
