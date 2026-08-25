import { proxySavedPlaces } from "@/features/collections/server/proxy-saved-places";

export const dynamic = "force-dynamic";

export function GET() {
  return proxySavedPlaces("GET");
}
