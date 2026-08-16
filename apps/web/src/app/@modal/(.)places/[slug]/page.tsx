import { notFound } from "next/navigation";

import { getPublicMapConfiguration } from "@/config/map";
import { PlaceDetailDrawer } from "@/features/place-detail/components/place-detail-drawer";
import { PlaceDetailView } from "@/features/place-detail/components/place-detail-view";
import { loadPlaceDetailBySlug } from "@/features/place-detail/data/place-detail-loader";
import { loadPlaceVibeBySlug } from "@/features/place-detail/data/place-vibe-loader";

type InterceptedPlaceDetailPageProps = Readonly<{
  params: Promise<Readonly<{ slug: string }>>;
}>;

export default async function InterceptedPlaceDetailPage({
  params,
}: InterceptedPlaceDetailPageProps) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();
  const [place, vibeResult] = await Promise.all([
    loadPlaceDetailBySlug(slug),
    loadPlaceVibeBySlug(slug).catch(() => null),
  ]);
  if (!place) notFound();

  return (
    <PlaceDetailDrawer>
      <PlaceDetailView
        mapStyleUrl={getPublicMapConfiguration().styleUrl}
        place={place}
        presentation="drawer"
        vibeError={vibeResult === null}
        vibeSnapshots={vibeResult ?? []}
      />
    </PlaceDetailDrawer>
  );
}
