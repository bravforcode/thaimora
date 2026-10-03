"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPublicContentClient, nextEventCheck } from "./public-content-client";

const inactive = () => () => {};
export function usePublicContent<T extends { pois: unknown[]; events: unknown[] }>(client: ReturnType<typeof createPublicContentClient<T>>, enabled = true) {
  return useSyncExternalStore(enabled ? client.subscribe : inactive, enabled ? client.getSnapshot : client.getServerSnapshot, client.getServerSnapshot);
}

/** Expire events locally at their exclusive end time, including after a tab resumes. */
export function useEventClock(events: { endsAt?: string }[]) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      clearTimeout(timer);
      const current = Date.now();
      setNow(current);
      if (document.visibilityState !== "hidden" && events.some(event => Date.parse(event.endsAt ?? "") > current))
        timer = setTimeout(tick, nextEventCheck(events, current));
    };
    tick();
    document.addEventListener("visibilitychange", tick);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", tick); };
  }, [events]);
  return now;
}
