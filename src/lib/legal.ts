import fs from "node:fs";
import { z } from "zod";
const legalSchema = z.object({
  approved: z.literal(true),
  privacy: z.object({ en: z.string().min(100), th: z.string().min(100) }),
  terms: z.object({ en: z.string().min(100), th: z.string().min(100) }),
});
export function approvedLegal(kind: "privacy" | "terms") {
  const path = process.env.THAIMORA_LEGAL_PATH;
  if (!path || !fs.existsSync(path)) return undefined;
  try {
    return legalSchema.parse(JSON.parse(fs.readFileSync(path, "utf8")))[kind];
  } catch {
    return undefined;
  }
}
