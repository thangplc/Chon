import { proxySavedPlaces } from "@/features/collections/server/proxy-saved-places";

export const dynamic = "force-dynamic";

type RouteContext = Readonly<{
  params: Promise<Readonly<{ slug: string }>>;
}>;

export async function GET(_: Request, context: RouteContext) {
  return proxySavedPlaces("GET", (await context.params).slug);
}

export async function PUT(_: Request, context: RouteContext) {
  return proxySavedPlaces("PUT", (await context.params).slug);
}

export async function DELETE(_: Request, context: RouteContext) {
  return proxySavedPlaces("DELETE", (await context.params).slug);
}
