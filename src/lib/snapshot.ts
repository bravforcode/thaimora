import fs from "node:fs";
import { demoProperties } from "./demo";
import { propertySchema, publicSnapshot } from "./property";
export function snapshots() {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "live") return demoProperties;
  const file = process.env.THAIMORA_SNAPSHOT_PATH;
  if (!file)
    throw new Error("A checked public snapshot is required for production.");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const rows = Array.isArray(raw) ? raw : raw.properties;
  if (!Array.isArray(rows) || !rows.length)
    throw new Error("Public snapshot is empty.");
  return rows.map((p) => publicSnapshot(propertySchema.parse(p)));
}
