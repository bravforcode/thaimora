import type { PublicProperty } from "./property";

// Who is offering the property: the owner directly, or a subscribed agent.
export type ListingChannel =
  | { kind: "owner" }
  | { kind: "agent"; name: string; agency: string };

// `published` marks listings posted in this browser; they have no static page.
export type HomeListing = PublicProperty & {
  channel: ListingChannel;
  published?: boolean;
};

// Live snapshots carry no channel yet; treat them as agent-listed so the
// contact route stays the consent-gated inquiry form.
export function withDefaultChannel(
  properties: readonly PublicProperty[],
): HomeListing[] {
  return properties.map((p) => ({
    ...p,
    channel: { kind: "agent", name: "", agency: "" },
  }));
}
