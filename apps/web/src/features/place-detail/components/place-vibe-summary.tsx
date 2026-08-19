import type { VibeDimension } from "@chon/domain/explore-contract";

import type {
  PlaceDetailIntent,
  PlaceVibePresentation,
} from "../domain/place-vibe-presentation";

const dimensions: readonly VibeDimension[] = [
  "noise",
  "crowd",
  "lighting",
  "privacy",
  "workability",
  "socialEnergy",
];

const vibeLabels: Readonly<Record<VibeDimension, string>> = {
  crowd: "Độ đông",
  lighting: "Ánh sáng",
  noise: "Độ ồn",
  privacy: "Riêng tư",
  socialEnergy: "Nhịp không gian",
  workability: "Làm việc",
};

const valueLabels: Readonly<
  Record<VibeDimension, readonly [string, string, string, string, string]>
> = {
  crowd: ["Rất vắng", "Khá vắng", "Vừa phải", "Khá đông", "Rất đông"],
  lighting: ["Rất dịu", "Khá dịu", "Cân bằng", "Khá sáng", "Rất sáng"],
  noise: ["Rất yên", "Khá yên", "Vừa phải", "Khá ồn", "Rất ồn"],
  privacy: ["Rất mở", "Khá mở", "Vừa đủ", "Khá riêng", "Rất riêng"],
  socialEnergy: [
    "Rất trầm",
    "Khá trầm",
    "Cân bằng",
    "Sôi động",
    "Rất sôi động",
  ],
  workability: ["Không hợp", "Hạn chế", "Ngắn hạn", "Khá hợp", "Rất hợp"],
};

function confidenceLabel(level: "low" | "medium" | "high"): string {
  if (level === "high") return "Độ tin cậy cao";
  if (level === "medium") return "Độ tin cậy trung bình";
  return "Dữ liệu còn ít";
}

function evidenceLabel(presentation: PlaceVibePresentation): string {
  const snapshot = presentation.snapshot;
  if (!snapshot) return "Chưa có đủ bằng chứng trong khung giờ này.";

  const parts: string[] = [];
  if (snapshot.reportCount > 0) {
    parts.push(
      `${snapshot.reportCount} ${snapshot.isSimulated ? "góp ý mô phỏng" : "góp ý cộng đồng"}`,
    );
  }
  if (snapshot.providerSignalCount > 0) {
    parts.push(`${snapshot.providerSignalCount} nguồn bổ trợ`);
  }
  return parts.length > 0
    ? `Dựa trên ${parts.join(" và ")} cùng khung giờ.`
    : "Chưa có đủ bằng chứng trong khung giờ này.";
}

function scoreLabel(dimension: VibeDimension, score: number): string {
  const index = Math.max(1, Math.min(5, Math.round(score))) - 1;
  return valueLabels[dimension][index];
}

export function PlaceVibeSummary({
  error = false,
  intent,
  presentation,
}: Readonly<{
  error?: boolean;
  intent: PlaceDetailIntent;
  presentation: PlaceVibePresentation;
}>) {
  const snapshot = presentation.snapshot;

  return (
    <div className="space-y-6">
      <div
        className={`grid gap-1 rounded-2xl px-4 py-3 text-sm ${
          snapshot?.confidence.level === "low" || !snapshot
            ? "bg-[#f7eee0] text-[#8b5a2b]"
            : "bg-[#dfece3] text-[#315d50]"
        }`}
      >
        <strong>
          {snapshot
            ? confidenceLabel(snapshot.confidence.level)
            : "Chưa có độ tin cậy"}
        </strong>
        <span>{evidenceLabel(presentation)}</span>
      </div>

      <section aria-labelledby="place-fit-reasons-title">
        <h2 className="text-xl font-extrabold" id="place-fit-reasons-title">
          {`Vì sao phù hợp với ${intent.purposeLabel.toLocaleLowerCase("vi-VN")}?`}
        </h2>
        {presentation.explanation.reasons.length > 0 ? (
          <ul className="mt-3 grid gap-2 text-sm text-[#5e746a]">
            {presentation.explanation.reasons.map((reason) => (
              <li className="flex gap-3" key={reason}>
                <span aria-hidden="true" className="font-black text-[#426b57]">
                  ✓
                </span>
                <span>{reason}</span>
              </li>
            ))}
            {presentation.explanation.cautions.map((caution) => (
              <li className="flex gap-3 text-[#8b5a2b]" key={caution}>
                <span aria-hidden="true" className="font-black">
                  !
                </span>
                <span>{caution}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-xl bg-[#f7eee0] p-4 text-sm leading-6 text-[#8b5a2b]">
            {error
              ? "Chưa thể tải dữ liệu vibe. Thông tin địa điểm vẫn được hiển thị."
              : "Chưa đủ dữ liệu vibe để giải thích mức độ phù hợp."}
          </p>
        )}
      </section>

      <section aria-labelledby="place-vibe-title">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-extrabold" id="place-vibe-title">
            Vibe lúc bạn định ghé
          </h2>
          <span className="shrink-0 text-sm text-[#756c63]">
            {intent.timeLabel}
          </span>
        </div>

        {presentation.scores ? (
          <dl className="mt-4 grid gap-3">
            {dimensions.map((dimension) => {
              const score = presentation.scores?.[dimension];
              if (score === undefined) return null;
              return (
                <div
                  className="grid grid-cols-[6.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 text-xs sm:grid-cols-[7.5rem_minmax(0,1fr)_6rem] sm:text-sm"
                  key={dimension}
                >
                  <dt>{vibeLabels[dimension]}</dt>
                  <dd
                    aria-label={`${vibeLabels[dimension]}: ${score.toFixed(1)} trên 5`}
                    className="h-2 overflow-hidden rounded-full bg-[#eee6da]"
                  >
                    <span
                      className="block h-full rounded-full bg-[#c96040]"
                      style={{ width: `${score * 20}%` }}
                    />
                  </dd>
                  <dd className="text-right text-[#756c63]">
                    {scoreLabel(dimension, score)}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <p className="mt-4 rounded-xl bg-[#f7eee0] p-4 text-sm leading-6 text-[#8b5a2b]">
            Chưa đủ dữ liệu vibe trong khung giờ này.
          </p>
        )}
      </section>
    </div>
  );
}
