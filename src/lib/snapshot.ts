import fs from "node:fs";
import { demoProperties } from "./demo";
import { propertySchema, publicSnapshot } from "./property";
export function snapshots() {
  const file = process.env.THAIMORA_SNAPSHOT_PATH;
  if (file && fs.existsSync(file)) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      const rows = Array.isArray(raw) ? raw : raw.properties;
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.map((p) => publicSnapshot(propertySchema.parse(p)));
      }
    } catch {}
  }
  return demoProperties;
}
