import { cache } from "react";
import {
  collectionDetailResponseSchema,
  type CollectionDetail,
} from "@chon/contracts/collections";

import { readBackendConfig } from "@/config/backend";

export const loadPublicCollectionServer = cache(
  async (id: string): Promise<CollectionDetail | null> => {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return null;
    const config = readBackendConfig();
    const response = await fetch(
      new URL(`/v1/collections/${encodeURIComponent(id)}`, config.baseUrl),
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(config.timeoutMs),
      },
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Public collection API returned ${response.status}`);
    }
    return collectionDetailResponseSchema.parse(await response.json()).data;
  },
);
