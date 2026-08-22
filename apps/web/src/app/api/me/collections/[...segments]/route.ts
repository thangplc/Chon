import { proxyCollections } from "@/features/collections/server/proxy-collections";

type Context = { params: Promise<{ segments: string[] }> };
const handle = async (request: Request, context: Context) =>
  proxyCollections(request, (await context.params).segments);
export const GET = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
