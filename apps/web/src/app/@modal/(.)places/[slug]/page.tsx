import { notFound } from "next/navigation";

import { getPublicMapConfiguration } from "@/config/map";
import { PlaceDetailDrawer } from "@/features/place-detail/components/place-detail-drawer";
import { PlaceDetailView } from "@/features/place-detail/components/place-detail-view";
import { loadPlaceDetailBySlug } from "@/features/place-detail/data/place-detail-loader";

type InterceptedPlaceDetailPageProps = Readonly<{
  params: Promise<Readonly<{ slug: string }>>;
}>;

export default async function InterceptedPlaceDetailPage({
  params,
}: InterceptedPlaceDetailPageProps) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();
  const place = await loadPlaceDetailBySlug(slug);
  if (!place) notFound();

  return (
    <PlaceDetailDrawer>
      <PlaceDetailView
        mapStyleUrl={getPublicMapConfiguration().styleUrl}
        place={place}
        presentation="drawer"
      />
    </PlaceDetailDrawer>
  );
}
