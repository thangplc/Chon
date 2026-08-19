import type { ReactNode } from "react";
import type { VibeSnapshotApiItem } from "@chon/contracts/backend";

import type { PlaceDetail } from "../domain/place-detail";
import {
  buildPlaceVibePresentation,
  type PlaceDetailIntent,
} from "../domain/place-vibe-presentation";
import { VibeReportFlow } from "@/features/contribution/components/vibe-report-flow";
import { PlaceDetailBackControl } from "./place-detail-back-control";
import { PlaceFacts } from "./place-facts";
import { PlaceGallery } from "./place-gallery";
import { PlaceVibeSummary } from "./place-vibe-summary";

type PlaceDetailViewProps = Readonly<{
  authControls?: ReactNode;
  backHref?: string;
  intent: PlaceDetailIntent;
  place: PlaceDetail;
  vibeError?: boolean;
  vibeSnapshots?: readonly VibeSnapshotApiItem[];
}>;

type OpenStatus = Readonly<{
  label: string;
  tone: "closed" | "open" | "unknown";
}>;

function minutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function getOpenStatus(place: PlaceDetail): OpenStatus {
  if (!place.openingHours) return { label: "Chưa rõ", tone: "unknown" };

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      timeZone: place.openingHours.timezone,
      weekday: "long",
    })
      .formatToParts(new Date())
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  const weekday =
    parts.weekday?.toLowerCase() as keyof typeof place.openingHours.weekly;
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const open = place.openingHours.weekly[weekday]?.some(
    ({ closes, opens }) =>
      currentMinutes >= minutes(opens) && currentMinutes < minutes(closes),
  );

  return open
    ? { label: "Đang mở", tone: "open" }
    : { label: "Đang đóng", tone: "closed" };
}

const statusClassNames: Readonly<Record<OpenStatus["tone"], string>> = {
  closed: "bg-[#f7eee0] text-[#8b5a2b]",
  open: "bg-[#dfece3] text-[#315d50]",
  unknown: "bg-[#eee6da] text-[#756c63]",
};

export function PlaceDetailView({
  authControls,
  backHref = "/",
  intent,
  place,
  vibeError = false,
  vibeSnapshots = [],
}: PlaceDetailViewProps) {
  const presentation = buildPlaceVibePresentation(vibeSnapshots, intent);
  const openStatus = getOpenStatus(place);
  const osmUrl = `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=18/${place.latitude}/${place.longitude}`;

  return (
    <article className="min-h-screen bg-[#f7f2eb] pb-24 text-[#28231f] lg:pb-0">
      {place.isSimulated && (
        <div className="bg-[#2c2723] px-4 py-2 text-center text-[11px] font-bold tracking-[0.12em] text-[#fffdf9] uppercase">
          Prototype · địa điểm và hình ảnh mô phỏng
        </div>
      )}
      {!place.isSimulated && place.metadata.isSimulated && (
        <div className="bg-[#f5ddd3] px-4 py-2 text-center text-[11px] font-bold tracking-[0.12em] text-[#963f2a] uppercase">
          {place.metadata.label}
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <PlaceDetailBackControl compact href={backHref} />
          <span className="truncate text-center text-xs font-extrabold tracking-[0.14em] text-[#756c63] uppercase sm:text-sm">
            Chi tiết vibe
          </span>
          <div className="flex min-w-10 justify-end">{authControls}</div>
        </header>

        <main className="mt-4 grid gap-7 lg:grid-cols-[minmax(0,1.08fr)_minmax(330px,0.92fr)] lg:items-start">
          <PlaceGallery
            matchScore={presentation.matchScore}
            media={place.media}
            placeName={place.name}
          />

          <div className="min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-extrabold tracking-[0.12em] text-[#756c63] uppercase">
                  {place.district} · {intent.purposeLabel}
                </p>
                <h1 className="mt-1 text-3xl leading-tight font-extrabold tracking-[-0.025em] sm:text-4xl">
                  {place.name}
                </h1>
              </div>
              <span
                className={`mt-1 shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold ${statusClassNames[openStatus.tone]}`}
              >
                {openStatus.label}
              </span>
            </div>

            <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-[#5e746a]">
              <span aria-hidden="true" className="text-[#963f2a]">
                ⌖
              </span>
              <span>{place.address}</span>
            </p>
            {place.description && (
              <p className="mt-3 text-sm leading-6 text-[#5e746a]">
                {place.description}
              </p>
            )}

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ddd2c3] bg-[#fffdf9]/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-12px_30px_rgba(69,50,37,0.12)] backdrop-blur lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0 lg:pb-0 lg:shadow-none lg:backdrop-blur-none">
              <div className="mx-auto grid max-w-2xl grid-cols-2 gap-2.5 lg:mx-0 lg:flex lg:max-w-none lg:flex-wrap">
                <VibeReportFlow
                  placeName={place.name}
                  placeSlug={place.slug}
                  triggerClassName="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#c96040] px-4 text-sm font-extrabold text-white transition hover:bg-[#a94e35] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040] lg:min-w-40 lg:flex-none lg:px-6"
                />
                <a
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#ddd2c3] bg-[#fffdf9] px-4 text-sm font-extrabold text-[#28231f] transition hover:border-[#c96040] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040] lg:min-w-36 lg:flex-none lg:px-6"
                  href={osmUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Chỉ đường
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>

            <div className="mt-6">
              <PlaceVibeSummary
                error={vibeError}
                intent={intent}
                presentation={presentation}
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <PlaceFacts place={place} />
          </div>
        </main>
      </div>
    </article>
  );
}
