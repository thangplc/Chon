import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublicMapConfiguration } from "@/config/map";
import { PlaceDetailView } from "@/features/place-detail/components/place-detail-view";
import { loadPlaceDetailBySlug } from "@/features/place-detail/data/place-detail-loader";

type PlaceDetailPageProps = Readonly<{
  params: Promise<Readonly<{ slug: string }>>;
}>;

async function readPublishedPlace(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return loadPlaceDetailBySlug(slug);
}

export async function generateMetadata({
  params,
}: PlaceDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const place = await readPublishedPlace(slug);

  if (!place) return { title: "Không tìm thấy địa điểm" };
  return {
    description:
      place.description ??
      `Khám phá ${place.name} tại ${place.district} trên Chốn.`,
    title: place.name,
  };
}

export default async function PlaceDetailPage({
  params,
}: PlaceDetailPageProps) {
  const { slug } = await params;
  const place = await readPublishedPlace(slug);
  if (!place) notFound();

  return (
    <PlaceDetailView
      mapStyleUrl={getPublicMapConfiguration().styleUrl}
      place={place}
    />
  );
}
