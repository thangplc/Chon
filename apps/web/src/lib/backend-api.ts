import "server-only";

import type { z } from "zod";

import { readBackendConfig } from "@/config/backend";

export class BackendApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

export async function fetchBackendJson<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const config = readBackendConfig();
  const response = await fetch(`${config.baseUrl}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    throw new BackendApiError(
      response.status,
      `Backend request failed with status ${response.status}`,
    );
  }

  return schema.parse(await response.json());
}
