export type ContentSnapshot<T> = {
  data: T | null;
  checkedAt: number | null;
  checking: boolean;
  error: string | null;
  meta: ContentMetadata | null;
};

type ContentMetadata = Record<string, unknown> & {
  revision: string; poisVersion: string; eventsVersion: string; homeVersion: string;
};
function metadata(body: unknown): ContentMetadata | null {
  if (!body || typeof body !== "object" || !("meta" in body)) return null;
  const meta = body.meta;
  return meta && typeof meta === "object" && ["revision", "poisVersion", "eventsVersion", "homeVersion"].every(key =>
    key in meta && typeof meta[key as keyof typeof meta] === "string" && String(meta[key as keyof typeof meta]).length > 0,
  ) ? meta as ContentMetadata : null;
}

const INTERVAL = 60_000;
const DEADLINE = 12_000;
const MAX_BACKOFF = 15 * INTERVAL;

/** A tab-local cache for public editorial content only. Never use for offers or PII. */
export function createPublicContentClient<T extends { pois: unknown[]; events: unknown[] }>(url: string | undefined, decode: (body: unknown) => T) {
  const initial: ContentSnapshot<T> = { data: null, checkedAt: null, checking: false, error: null, meta: null };
  let snapshot = initial;
  let fullEtag: string | null = null;
  let eventsEtag: string | null = null;
  let nextDue = 0;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let inFlight: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const available = () => typeof document !== "undefined" && document.visibilityState !== "hidden" && navigator.onLine !== false;
  const publish = (patch: Partial<ContentSnapshot<T>>) => {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  };
  const clearTimer = () => { clearTimeout(timer); timer = undefined; };
  const schedule = () => {
    clearTimer();
    if (!listeners.size || !available() || inFlight) return;
    timer = setTimeout(() => { void refresh(); }, Math.max(0, nextDue - Date.now()));
  };
  const environmentChanged = () => {
    if (!available()) { clearTimer(); controller?.abort(); }
    else schedule();
  };
  async function refresh(force = false): Promise<void> {
    if (inFlight) return inFlight;
    if (!listeners.size || !available()) return;
    if (!force && Date.now() < nextDue) { schedule(); return; }
    clearTimer();
    const active = new AbortController();
    controller = active;
    let timedOut = false;
    const deadline = setTimeout(() => { timedOut = true; active.abort(); }, DEADLINE);
    publish({ checking: true });
    inFlight = Promise.resolve().then(async () => {
      try {
        if (!url) throw new Error("Content API is not configured.");
        const read = async (eventsOnly: boolean) => {
          const address = new URL(url);
          if (eventsOnly) address.searchParams.set("scope", "events");
          const tag = eventsOnly ? eventsEtag : fullEtag;
          const response = await fetch(address.href, {
            signal: active.signal, cache: "no-store", credentials: "omit",
            headers: { Accept: "application/json", ...(tag ? { "If-None-Match": tag } : {}) },
          });
          if (active.signal.aborted) throw new Error("Content refresh was interrupted.");
          if (response.status === 304) {
            if (!snapshot.data || !tag) throw new Error("Content response cannot be validated.");
            return null;
          }
          if (!response.ok) throw new Error("Current content is temporarily unavailable.");
          const body: unknown = await response.json();
          if (active.signal.aborted) throw new Error("Content refresh was interrupted.");
          const candidate = response.headers.get("etag");
          const etag = candidate && candidate.length <= 160 && /^(W\/)?"[^\r\n"]*"$/.test(candidate) ? candidate : null;
          return { body, etag, meta: metadata(body) };
        };
        const eventsOnly = snapshot.data !== null && snapshot.meta !== null;
        const result = await read(eventsOnly);
        if (result) {
          if (eventsOnly) {
            if (!result.meta || !result.body || typeof result.body !== "object" || !("events" in result.body) || !Array.isArray(result.body.events))
              throw new Error("Content revision response is invalid.");
            if (result.meta.poisVersion !== snapshot.meta?.poisVersion || result.meta.homeVersion !== snapshot.meta?.homeVersion) {
              const full = await read(false);
              if (!full) throw new Error("Changed content returned an unchanged full revision.");
              const data = decode(full.body);
              fullEtag = full.etag;
              eventsEtag = null;
              publish({ data, meta: full.meta });
            } else {
              const current = snapshot.data!;
              const data = { ...decode({ ...current, pois: [], events: result.body.events, meta: result.meta }), pois: current.pois };
              eventsEtag = result.etag;
              publish({ data, meta: result.meta });
            }
          } else {
            const data = decode(result.body);
            fullEtag = result.etag;
            publish({ data, meta: result.meta });
          }
        }
        failures = 0;
        nextDue = Date.now() + INTERVAL;
        publish({ checkedAt: Date.now(), error: null });
      } catch {
        if (!active.signal.aborted || timedOut) {
          failures += 1;
          nextDue = Date.now() + Math.min(MAX_BACKOFF, INTERVAL * 2 ** Math.min(failures, 4));
          publish({ error: timedOut ? "Content refresh timed out." : "Current content is temporarily unavailable." });
        }
      } finally {
        clearTimeout(deadline);
        controller = undefined;
        inFlight = undefined;
        publish({ checking: false });
        schedule();
      }
    });
    return inFlight;
  }
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    refresh: () => refresh(true),
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        document.addEventListener("visibilitychange", environmentChanged);
        window.addEventListener("online", environmentChanged);
        window.addEventListener("offline", environmentChanged);
        schedule();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          clearTimer(); controller?.abort();
          document.removeEventListener("visibilitychange", environmentChanged);
          window.removeEventListener("online", environmentChanged);
          window.removeEventListener("offline", environmentChanged);
        }
      };
    },
  };
}

export function currentEvents<T extends { startsAt?: string; endsAt?: string }>(events: T[], now: number): T[] {
  return events.filter(event => {
    const start = Date.parse(event.startsAt ?? "");
    const end = Date.parse(event.endsAt ?? "");
    return Number.isFinite(start) && Number.isFinite(end) && end > start && end > now;
  });
}

export function nextEventCheck(events: { endsAt?: string }[], now: number): number {
  const upcoming = events.map(event => Date.parse(event.endsAt ?? "")).filter(end => Number.isFinite(end) && end > now);
  return Math.min(INTERVAL, upcoming.reduce((delay, end) => Math.min(delay, end - now + 1), INTERVAL));
}
