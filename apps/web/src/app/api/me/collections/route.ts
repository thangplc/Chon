import { proxyCollections } from "@/features/collections/server/proxy-collections";

export const GET = (request: Request) => proxyCollections(request);
export const POST = (request: Request) => proxyCollections(request);
