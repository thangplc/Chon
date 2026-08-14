import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    settings: {
      next: { rootDir: "apps/web/" },
      react: { version: "19.2" },
    },
  },
  prettier,
  globalIgnores([
    ".next/**",
    "apps/*/.next/**",
    "apps/*/dist/**",
    "coverage/**",
    "data/**",
    "docs/**",
    "out/**",
    "prototype/**",
    "apps/*/public/maplibre/**",
    "apps/*/next-env.d.ts",
  ]),
]);
