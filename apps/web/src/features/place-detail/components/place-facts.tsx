import {
  WEEKDAYS,
  type OpeningHoursPeriod,
  type PlaceDetail,
  type PriceLevel,
  type SizeCategory,
  type Weekday,
} from "@chon/domain/place-detail";

const weekdayLabels: Record<Weekday, string> = {
  friday: "Thứ Sáu",
  monday: "Thứ Hai",
  saturday: "Thứ Bảy",
  sunday: "Chủ Nhật",
  thursday: "Thứ Năm",
  tuesday: "Thứ Ba",
  wednesday: "Thứ Tư",
};

const priceLevelLabels: Record<PriceLevel, string> = {
  1: "Bình dân",
  2: "Phổ thông",
  3: "Cao",
  4: "Cao cấp",
};

const sizeLabels: Record<SizeCategory, string> = {
  large: "Rộng",
  medium: "Vừa",
  small: "Nhỏ",
  unknown: "Chưa xác định",
};

function formatPeriods(periods: readonly OpeningHoursPeriod[]): string {
  if (periods.length === 0) return "Đóng cửa";
  return periods.map(({ closes, opens }) => `${opens}–${closes}`).join(", ");
}

function todayInTimezone(timezone: string): Weekday {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  })
    .format(new Date())
    .toLowerCase() as Weekday;
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("vi-VN", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatSpend(place: PlaceDetail): string | null {
  const { currency, typicalSpendMax, typicalSpendMin } = place;
  if (typicalSpendMin !== null && typicalSpendMax !== null) {
    return `${formatMoney(typicalSpendMin, currency)}–${formatMoney(
      typicalSpendMax,
      currency,
    )} / người`;
  }
  if (typicalSpendMin !== null) {
    return `Từ ${formatMoney(typicalSpendMin, currency)} / người`;
  }
  if (typicalSpendMax !== null) {
    return `Tối đa ${formatMoney(typicalSpendMax, currency)} / người`;
  }
  return null;
}

const cardClassName =
  "rounded-[1.25rem] border border-[#173f33]/10 bg-[#f8f3e8] p-4";
const emptyClassName = "mt-2 text-sm leading-6 text-[#6b7d74]";

export function PlaceFacts({ place }: Readonly<{ place: PlaceDetail }>) {
  const openingHours = place.openingHours;
  const today = openingHours ? todayInTimezone(openingHours.timezone) : null;
  const spend = formatSpend(place);
  const hasSpaceSummary =
    place.sizeCategory !== "unknown" || place.estimatedCapacity !== null;

  return (
    <section
      aria-labelledby="place-facts-title"
      className="rounded-[1.5rem] border border-[#173f33]/10 bg-white/75 p-5 shadow-sm"
    >
      <h2 id="place-facts-title" className="text-lg font-bold">
        Thông tin địa điểm
      </h2>
      <div className="mt-4 grid gap-3">
        <section
          aria-labelledby="opening-hours-title"
          className={cardClassName}
        >
          <h3 id="opening-hours-title" className="font-bold">
            Giờ mở cửa
          </h3>
          {openingHours && today ? (
            <>
              <p className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="text-[#5e746a]">
                  {weekdayLabels[today]} · Hôm nay
                </span>
                <strong>{formatPeriods(openingHours.weekly[today])}</strong>
              </p>
              <p className="mt-2 text-xs text-[#6b7d74]">
                Lịch thường lệ · múi giờ TP.HCM
              </p>
              <details className="mt-3 border-t border-[#173f33]/10 pt-3">
                <summary className="cursor-pointer text-sm font-semibold text-[#245c4c] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c59635]">
                  Xem lịch cả tuần
                </summary>
                <dl className="mt-3 space-y-2 text-sm">
                  {WEEKDAYS.map((weekday) => (
                    <div
                      className={`flex justify-between gap-4 rounded-lg px-2 py-1 ${
                        weekday === today ? "bg-[#e9eddc]" : ""
                      }`}
                      key={weekday}
                    >
                      <dt className="font-medium">
                        {weekdayLabels[weekday]}
                        {weekday === today ? " · Hôm nay" : ""}
                      </dt>
                      <dd className="text-right text-[#5e746a]">
                        {formatPeriods(openingHours.weekly[weekday])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </>
          ) : (
            <p className={emptyClassName}>Chưa có lịch mở cửa đã xác minh.</p>
          )}
        </section>

        <section aria-labelledby="price-title" className={cardClassName}>
          <h3 id="price-title" className="font-bold">
            Mức giá
          </h3>
          {spend || place.priceLevel ? (
            <div className="mt-2 space-y-1 text-sm">
              {spend && <p className="font-semibold">{spend}</p>}
              {place.priceLevel && (
                <p className="text-[#5e746a]">
                  Phân khúc: {priceLevelLabels[place.priceLevel]} · mức{" "}
                  {place.priceLevel}/4
                </p>
              )}
            </div>
          ) : (
            <p className={emptyClassName}>Chưa có thông tin giá đã xác minh.</p>
          )}
        </section>

        <section aria-labelledby="space-title" className={cardClassName}>
          <h3 id="space-title" className="font-bold">
            Không gian trong quán
          </h3>
          {hasSpaceSummary || place.areas.length > 0 ? (
            <div className="mt-2 space-y-3 text-sm">
              {hasSpaceSummary && (
                <p className="text-[#5e746a]">
                  Quy mô: <strong>{sizeLabels[place.sizeCategory]}</strong>
                  {place.estimatedCapacity !== null
                    ? ` · khoảng ${place.estimatedCapacity} khách`
                    : ""}
                </p>
              )}
              {place.areas.length > 0 ? (
                <ul className="space-y-2" aria-label="Các khu vực trong quán">
                  {place.areas.map((area) => (
                    <li
                      className="rounded-xl border border-[#173f33]/10 bg-white/70 px-3 py-2"
                      key={area.id}
                    >
                      <p className="font-semibold">{area.name}</p>
                      {area.description && (
                        <p className="mt-1 text-[#5e746a]">
                          {area.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[#6b7d74]">
                  Chưa có danh sách khu vực đã xác minh.
                </p>
              )}
            </div>
          ) : (
            <p className={emptyClassName}>
              Chưa có thông tin không gian đã xác minh.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
