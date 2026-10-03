import type { NextConfig } from "next";
import { mkdirSync, readdirSync, copyFileSync } from "node:fs";
import path from "node:path";
// MapLibre 6 ships a module worker with sibling imports. Preserve its module
// graph under our origin instead of relying on a bundler's import.meta rewriting.
const mapDistribution = path.join(
  process.cwd(),
  "node_modules/maplibre-gl/dist",
);
const workerAssets = path.join(process.cwd(), "public/maplibre");
mkdirSync(workerAssets, { recursive: true });
for (const file of readdirSync(mapDistribution).filter((file) =>
  file.endsWith(".mjs"),
))
  copyFileSync(path.join(mapDistribution, file), path.join(workerAssets, file));
copyFileSync(
  path.join(process.cwd(), "node_modules/maplibre-gl/LICENSE.txt"),
  path.join(workerAssets, "LICENSE.txt"),
);
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  devIndicators: false,
  turbopack: { root: process.cwd() },
};
export default config;
