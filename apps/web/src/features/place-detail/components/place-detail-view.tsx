import type { PlaceDetail } from "../domain/place-detail";
import { PlaceDetailBackControl } from "./place-detail-back-control";
import { PlaceDetailMap } from "./place-detail-map";
import { PlaceFacts } from "./place-facts";
import { PlaceGallery } from "./place-gallery";
import { PlaceVibeSummary } from "./place-vibe-summary";
import type { VibeSnapshotApiItem } from "@chon/contracts/backend";
import { VibeReportFlow } from "@/features/contribution/components/vibe-report-flow";

type PlaceDetailViewProps = Readonly<{
  mapStyleUrl: string | null;
  place: PlaceDetail;
  presentation?: "page" | "drawer";
  vibeError?: boolean;
  vibeSnapshots?: readonly VibeSnapshotApiItem[];
}>;

export function PlaceDetailView({
  mapStyleUrl,
  place,
  presentation = "page",
  vibeError = false,
  vibeSnapshots = [],
}: PlaceDetailViewProps) {
  return (
    <article
      className={
        presentation === "drawer"
          ? "min-h-full bg-[#f3efe5] text-[#18352d]"
          : "min-h-screen bg-[#f3efe5] text-[#18352d]"
      }
    >
      {place.isSimulated && (
        <div className="bg-[#f4c96b] px-4 py-2 text-center text-xs font-bold tracking-[0.12em] text-amber-950 uppercase">
          Địa điểm và hình ảnh đang là dữ liệu giả lập
        </div>
      )}
      {!place.isSimulated && place.metadata.isSimulated && (
        <div className="bg-[#f4c96b] px-4 py-2 text-center text-xs font-bold tracking-[0.12em] text-amber-950 uppercase">
          {place.metadata.label}
        </div>
      )}

      <div
        className={`mx-auto px-4 py-5 sm:px-6 ${
          presentation === "drawer" ? "max-w-5xl" : "max-w-7xl lg:px-8"
        }`}
      >
        <nav aria-label="Điều hướng chi tiết địa điểm">
          <PlaceDetailBackControl presentation={presentation} />
        </nav>

        <header className="mt-4 rounded-[2rem] bg-[#173f33] p-6 text-[#f8f3e8] shadow-xl shadow-[#173f33]/10 sm:p-8">
          <p className="text-xs font-bold tracking-[0.15em] text-[#f4c96b] uppercase">
            {place.district} · Chi tiết địa điểm
          </p>
          <h1 className="mt-2 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            {place.name}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#dce8e1] sm:text-base">
            {place.description ??
              "Thông tin mô tả đang được biên tập. Chốn chỉ hiển thị nội dung đã xác minh hoặc có nguồn rõ ràng."}
          </p>
          <p className="mt-5 flex items-start gap-2 text-sm text-[#f8f3e8]">
            <span aria-hidden="true">⌖</span>
            <span>{place.address}</span>
          </p>
          {presentation === "drawer" && (
            <a
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#f4c96b] px-4 py-2.5 text-sm font-bold text-[#173f33] shadow-sm transition-colors hover:bg-[#f7d98b] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f8f3e8]"
              href={`/places/${encodeURIComponent(place.slug)}`}
            >
              Mở toàn trang
              <span aria-hidden="true">↗</span>
            </a>
          )}
          <VibeReportFlow placeName={place.name} placeSlug={place.slug} />
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <PlaceGallery media={place.media} placeName={place.name} />
          <div className="space-y-5">
            <PlaceDetailMap
              latitude={place.latitude}
              longitude={place.longitude}
              mapStyleUrl={mapStyleUrl}
              name={place.name}
            />
            <PlaceFacts place={place} />
            <PlaceVibeSummary error={vibeError} snapshots={vibeSnapshots} />
          </div>
        </div>
      </div>
    </article>
  );
}
