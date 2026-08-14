import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const apiEnvironmentPath = fileURLToPath(new URL("../.env", import.meta.url));

const result = config({ path: apiEnvironmentPath, quiet: true });

if (result.error && result.error.code !== "ENOENT") {
  throw result.error;
}
