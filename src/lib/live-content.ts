"use client";
import { useEffect, useState } from "react";
import { liveMode } from "./api";
import { localContent, localContentClient, type LocalEvent, type POI } from "./pois";
import { usePublicContent } from "./use-public-content";

const empty: { pois: POI[]; events: LocalEvent[] } = { pois: [], events: [] };
export function useLiveContent(enabled = true) {
  const snapshot = usePublicContent(localContentClient, enabled && liveMode);
  const [preview, setPreview] = useState(empty);
  const [previewError, setPreviewError] = useState<string | null>(null);
  useEffect(() => {
    if (liveMode || !enabled) return;
    let cancelled = false;
    localContent().then(data => { if (!cancelled) setPreview(data); }).catch(() => { if (!cancelled) setPreviewError("Local place data is unavailable."); });
    return () => { cancelled = true; };
  }, [enabled]);
  return { ...snapshot, data: liveMode ? snapshot.data ?? empty : preview, error: liveMode ? snapshot.error : previewError, loading: liveMode && !snapshot.data && !snapshot.error, retry: localContentClient.refresh };
}
