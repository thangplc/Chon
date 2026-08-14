import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const require = createRequire(path.join(webRoot, "package.json"));
const mapLibrePackagePath = require.resolve("maplibre-gl/package.json");
const mapLibreDistDirectory = path.join(
  path.dirname(mapLibrePackagePath),
  "dist",
);
const destinationDirectory = path.join(webRoot, "public", "maplibre");
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

console.log("Prepared MapLibre worker assets in apps/web/public/maplibre.");
