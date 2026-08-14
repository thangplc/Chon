import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const mapLibrePackagePath = require.resolve("maplibre-gl/package.json");
const mapLibreDistDirectory = path.join(
  path.dirname(mapLibrePackagePath),
  "dist",
);
const destinationDirectory = path.join(process.cwd(), "public", "maplibre");
const workerFiles = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

await mkdir(destinationDirectory, { recursive: true });
await Promise.all(
  workerFiles.map((fileName) =>
    copyFile(
      path.join(mapLibreDistDirectory, fileName),
      path.join(destinationDirectory, fileName),
    ),
  ),
);

console.log("Prepared MapLibre worker assets in public/maplibre.");
