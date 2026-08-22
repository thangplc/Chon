import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExploreTimeContext } from "@chon/domain/explore";
import { purposes } from "@chon/domain/explore-contract";

import { AuthControls } from "@/features/auth/components/auth-controls";
import { PlaceDetailView } from "@/features/place-detail/components/place-detail-view";
import { loadPlaceDetailBySlug } from "@/features/place-detail/data/place-detail-loader";
import { loadPlaceVibeBySlug } from "@/features/place-detail/data/place-vibe-loader";
import type { PlaceDetailIntent } from "@/features/place-detail/domain/place-vibe-presentation";
import {
  createDefaultExploreUrlState,
  parseExploreUrlState,
  serializeExploreUrlState,
} from "@/features/explore/state/explore-url-state";

type PlaceDetailPageProps = Readonly<{
  params: Promise<Readonly<{ slug: string }>>;
  searchParams: Promise<
    Readonly<Record<string, string | readonly string[] | undefined>>
  >;
}>;

function getTodayDateValue(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
    })
      .formatToParts(new Date())
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function toSearchString(
  values: Readonly<Record<string, string | readonly string[] | undefined>>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") params.set(key, value);
    else value?.forEach((item) => params.append(key, item));
  }
  return params.toString();
}

function readIntent(
  values: Readonly<Record<string, string | readonly string[] | undefined>>,
): Readonly<{ backHref: string; intent: PlaceDetailIntent }> {
  const fallback = createDefaultExploreUrlState(getTodayDateValue());
  const state = parseExploreUrlState(toSearchString(values), fallback);
  const timeContext = getExploreTimeContext(
    state.dateValue,
    state.exactTime,
  ) ?? {
    dayType: "weekday" as const,
    timeBucket: state.timeBucket,
  };
  const purpose =
    purposes.find(({ id }) => id === state.purpose) ?? purposes[0];

  return {
    backHref: `/${serializeExploreUrlState(state)}`,
    intent: {
      ...timeContext,
      purpose: purpose.id,
      purposeLabel: purpose.label,
      timeLabel: state.exactTime,
    },
  };
}

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
  searchParams,
}: PlaceDetailPageProps) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const [{ backHref, intent }, place, vibeResult] = await Promise.all([
    Promise.resolve(readIntent(resolvedSearchParams)),
    readPublishedPlace(slug),
    loadPlaceVibeBySlug(slug).catch(() => null),
  ]);
  if (!place) notFound();

  return (
    <PlaceDetailView
      authControls={<AuthControls />}
      backHref={backHref}
      intent={intent}
      place={place}
      vibeError={vibeResult === null}
      vibeSnapshots={vibeResult ?? []}
    />
  );
}
