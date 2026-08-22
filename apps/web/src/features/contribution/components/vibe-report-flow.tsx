"use client";

import type {
  CommunityVibeReportInput,
  VibeReportDimension,
  VibeReportEvidenceMode,
  VibeReportVisitMode,
} from "@chon/contracts/vibe-report";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { submitCommunityVibeReport } from "../data/vibe-report-repository";

type VibeReportFlowProps = Readonly<{
  hideTrigger?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  placeName: string;
  placeSlug: string;
  triggerClassName?: string;
}>;

type AuthState = "checking" | "signed-in" | "signed-out" | "unavailable";
type Step = 1 | 2 | 3;
type ScoreMap = Partial<Record<VibeReportDimension, number>>;
type SeatAvailability = "easy" | "normal" | "difficult" | "unknown";
type LocationState = "idle" | "requesting" | "ready" | "denied" | "unavailable";
type ContributionExperience = VibeReportEvidenceMode | "not_visited";

const experienceOptions: readonly Readonly<{
  description: string;
  id: ContributionExperience;
  label: string;
}>[] = [
  {
    description: "Có thể xác minh GPS nếu bạn chủ động cho phép.",
    id: "on_site",
    label: "Tôi đang ở đây",
  },
  {
    description: "Chọn lại ngày và khung giờ của lần ghé gần nhất.",
    id: "recalled",
    label: "Tôi đã ghé trước đó",
  },
  {
    description: "Không tạo report trải nghiệm; chuyển sang góp ý thông tin.",
    id: "not_visited",
    label: "Tôi chưa ghé",
  },
];

const visitModeOptions: readonly Readonly<{
  id: VibeReportVisitMode;
  label: string;
}>[] = [
  { id: "work", label: "Làm việc" },
  { id: "study", label: "Học / đọc" },
  { id: "solo", label: "Đi một mình" },
  { id: "date", label: "Hẹn hò" },
  { id: "friends", label: "Gặp bạn" },
  { id: "business_meeting", label: "Họp việc" },
  { id: "relax", label: "Thư giãn" },
  { id: "late_night", label: "Đi khuya" },
];

const dimensionsByVisitMode: Readonly<
  Record<VibeReportVisitMode, readonly VibeReportDimension[]>
> = {
  business_meeting: ["noise", "privacy", "workability"],
  date: ["lighting", "privacy", "socialEnergy"],
  friends: ["crowd", "noise", "socialEnergy"],
  late_night: ["crowd", "lighting", "noise"],
  relax: ["noise", "lighting", "privacy"],
  solo: ["lighting", "noise", "privacy"],
  study: ["noise", "lighting", "workability"],
  work: ["noise", "privacy", "workability"],
};

const allDimensions: readonly VibeReportDimension[] = [
  "noise",
  "crowd",
  "lighting",
  "privacy",
  "workability",
  "socialEnergy",
];

const dimensionCopy: Readonly<
  Record<
    VibeReportDimension,
    Readonly<{ high: string; label: string; low: string }>
  >
> = {
  crowd: { high: "Đông", label: "Mật độ người", low: "Thoáng" },
  lighting: { high: "Sáng", label: "Ánh sáng", low: "Trầm" },
  noise: { high: "Ồn", label: "Mức ồn", low: "Yên tĩnh" },
  privacy: { high: "Riêng tư", label: "Độ riêng tư", low: "Cởi mở" },
  socialEnergy: { high: "Sôi động", label: "Năng lượng xã hội", low: "Tĩnh" },
  workability: {
    high: "Dễ tập trung",
    label: "Khả năng làm việc",
    low: "Khó tập trung",
  },
};

const seatOptions: readonly Readonly<{
  id: SeatAvailability;
  label: string;
}>[] = [
  { id: "easy", label: "Dễ tìm chỗ" },
  { id: "normal", label: "Bình thường" },
  { id: "difficult", label: "Khó tìm chỗ" },
  { id: "unknown", label: "Chưa rõ" },
];

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

function formatVisitedAt(date: string, time: string): string {
  return `${date} · ${time}`;
}

export function VibeReportFlow({
  hideTrigger = false,
  onOpenChange,
  open,
  placeName,
  placeSlug,
  triggerClassName,
}: VibeReportFlowProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = open ?? internalOpen;
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authCheckAttempt, setAuthCheckAttempt] = useState(0);
  const [step, setStep] = useState<Step>(1);
  const [experience, setExperience] =
    useState<ContributionExperience>("on_site");
  const [visitMode, setVisitMode] = useState<VibeReportVisitMode>("work");
  const [visitedDate, setVisitedDate] = useState(getTodayDateValue);
  const [visitedTime, setVisitedTime] = useState("09:00");
  const [scores, setScores] = useState<ScoreMap>({});
  const [seatAvailability, setSeatAvailability] =
    useState<SeatAvailability>("unknown");
  const [shortNote, setShortNote] = useState("");
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [locationEvidence, setLocationEvidence] =
    useState<CommunityVibeReportInput["locationEvidence"]>();
  const [locationResult, setLocationResult] = useState<
    "none" | "recalled" | "approximate" | "verified" | null
  >(null);
  const [submitState, setSubmitState] = useState<
    "idle" | "submitting" | "success"
  >("idle");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredDimensions = dimensionsByVisitMode[visitMode];
  const optionalDimensions = allDimensions.filter(
    (dimension) => !requiredDimensions.includes(dimension),
  );
  const answeredRequiredDimensions = requiredDimensions.filter(
    (dimension) => scores[dimension] !== undefined,
  ).length;
  const canContinueFromContext =
    experience !== "not_visited" && Boolean(visitedDate && visitedTime);
  const canContinueFromQuestions =
    answeredRequiredDimensions === requiredDimensions.length;

  const callbackDescription = useMemo(
    () => `Đăng nhập để góp vibe cho ${placeName}`,
    [placeName],
  );

  const setFlowOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  useEffect(() => {
    if (isControlled) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("contribute") !== "1") return;

    queueMicrotask(() => setFlowOpen(true));
    url.searchParams.delete("contribute");
    url.searchParams.delete("place");
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [isControlled, setFlowOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    void fetch("/api/auth/me", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then((response) => {
        if (!active) return;
        if (response.status === 401) {
          setAuthState("signed-out");
        } else if (response.ok) {
          setAuthState("signed-in");
        } else {
          setAuthState("unavailable");
        }
      })
      .catch(() => {
        if (active) setAuthState("unavailable");
      });

    return () => {
      active = false;
    };
  }, [authCheckAttempt, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFlowOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, setFlowOpen]);

  const closeFlow = useCallback(() => {
    setFlowOpen(false);
    setStep(1);
    setExperience("on_site");
    setSubmitState("idle");
    setLocationEvidence(undefined);
    setLocationResult(null);
    setLocationState("idle");
    setError(null);
  }, [setFlowOpen]);

  const openFlow = useCallback(() => {
    setAuthState("checking");
    setFlowOpen(true);
  }, [setFlowOpen]);

  async function startGoogleSignIn() {
    setIsSigningIn(true);
    setError(null);

    try {
      const callbackUrl = new URL(window.location.href);
      callbackUrl.searchParams.set("contribute", "1");
      callbackUrl.searchParams.set("place", placeSlug);
      await signIn("google", { callbackUrl: callbackUrl.toString() });
    } catch (signInError) {
      setIsSigningIn(false);
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Không thể bắt đầu đăng nhập Google. Vui lòng thử lại.",
      );
    }
  }

  function updateScore(dimension: VibeReportDimension, value: number) {
    setScores((current) => ({ ...current, [dimension]: value }));
    setError(null);
  }

  function selectExperience(nextExperience: ContributionExperience) {
    setExperience(nextExperience);
    setLocationEvidence(undefined);
    setLocationResult(null);
    setLocationState("idle");
    setError(null);
  }

  function requestLocationVerification() {
    if (!("geolocation" in navigator)) {
      setLocationState("unavailable");
      return;
    }
    setLocationState("requesting");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationEvidence({
          accuracyMeters: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationState("ready");
      },
      (geolocationError) => {
        setLocationEvidence(undefined);
        setLocationState(
          geolocationError.code === geolocationError.PERMISSION_DENIED
            ? "denied"
            : "unavailable",
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
  }

  async function submitReport() {
    if (experience === "not_visited") return;
    setSubmitState("submitting");
    setError(null);
    const input: CommunityVibeReportInput = {
      locationEvidence,
      scores,
      seatAvailability,
      shortNote: shortNote.trim() || undefined,
      visitEvidenceMode: experience,
      visitMode,
      visitedAt: new Date(
        `${visitedDate}T${visitedTime}:00+07:00`,
      ).toISOString(),
    };

    try {
      const response = await submitCommunityVibeReport(placeSlug, input);
      setLocationResult(response.data.locationVerification);
      setSubmitState("success");
      router.refresh();
    } catch (submitError) {
      setSubmitState("idle");
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Không thể gửi góp vibe. Vui lòng thử lại.",
      );
    }
  }

  return (
    <>
      {!hideTrigger && (
        <button
          className={
            triggerClassName ??
            "mt-6 inline-flex items-center gap-2 rounded-xl border border-[#c96040]/70 px-4 py-2.5 text-sm font-bold text-[#963f2a] transition hover:bg-[#f5ddd3] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040]"
          }
          onClick={openFlow}
          type="button"
        >
          Góp vibe
          <span aria-hidden="true">✦</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#28231f]/55 p-0 sm:items-center sm:p-6">
          <div
            aria-describedby="vibe-report-description"
            aria-labelledby="vibe-report-title"
            aria-modal="true"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] border border-[#c96040]/20 bg-[#f7f2eb] p-5 text-[#28231f] shadow-[0_-20px_55px_rgba(40,35,31,0.32)] sm:rounded-[2rem] sm:p-7 sm:shadow-[0_24px_80px_rgba(40,35,31,0.38)]"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.14em] text-[#963f2a] uppercase">
                  Đóng góp community
                </p>
                <h2
                  className="mt-1 text-2xl font-semibold"
                  id="vibe-report-title"
                >
                  Góp vibe cho {placeName}
                </h2>
                <p
                  className="mt-2 text-sm leading-6 text-[#756c63]"
                  id="vibe-report-description"
                >
                  {callbackDescription}. Report hợp lệ sẽ được cập nhật lên Chốn
                  ngay sau khi gửi.
                </p>
              </div>
              <button
                aria-label="Đóng góp vibe"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-xl font-bold shadow-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040]"
                onClick={closeFlow}
                type="button"
              >
                ×
              </button>
            </div>

            {authState === "checking" && (
              <div className="mt-8 rounded-2xl bg-white p-6 text-center text-sm text-[#756c63]">
                Đang kiểm tra phiên đăng nhập…
              </div>
            )}

            {authState === "signed-out" && (
              <div className="mt-8 rounded-2xl bg-white p-6 text-center">
                <p className="text-base font-bold">Cần đăng nhập để góp vibe</p>
                <p className="mt-2 text-sm leading-6 text-[#756c63]">
                  Bạn có thể xem Explore công khai, nhưng report community cần
                  gắn với identity để bảo đảm trách nhiệm đóng góp.
                </p>
                <button
                  className="mt-5 inline-flex rounded-xl bg-[#c96040] px-5 py-3 text-sm font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040]"
                  disabled={isSigningIn}
                  onClick={() => void startGoogleSignIn()}
                  type="button"
                >
                  {isSigningIn
                    ? "Đang chuyển tới Google…"
                    : "Đăng nhập bằng Google"}
                </button>
                {error && (
                  <p className="mt-3 text-sm text-[#a23d2f]" role="alert">
                    {error}
                  </p>
                )}
              </div>
            )}

            {authState === "unavailable" && (
              <div className="mt-8 rounded-2xl bg-white p-6 text-center">
                <p className="text-base font-bold">
                  Chưa thể xác minh phiên đăng nhập
                </p>
                <p className="mt-2 text-sm leading-6 text-[#756c63]">
                  Dịch vụ xác thực tạm thời chưa sẵn sàng. Vui lòng thử lại sau
                  giây lát.
                </p>
                <button
                  className="mt-5 inline-flex rounded-xl bg-[#c96040] px-5 py-3 text-sm font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040]"
                  onClick={() => {
                    setAuthState("checking");
                    setAuthCheckAttempt((attempt) => attempt + 1);
                  }}
                  type="button"
                >
                  Thử lại
                </button>
              </div>
            )}

            {authState === "signed-in" && submitState === "success" && (
              <div className="mt-8 rounded-2xl bg-white p-6 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-[#f5ddd3] text-2xl text-[#963f2a]">
                  ✓
                </div>
                <h3 className="mt-4 text-xl font-bold">Đã nhận góp vibe</h3>
                <p className="mt-2 text-sm leading-6 text-[#756c63]">
                  Vibe đã được cập nhật vào dữ liệu của địa điểm và có thể được
                  dùng trên Explore.
                </p>
                <p className="mt-3 rounded-xl bg-[#f7f2eb] px-3 py-2 text-sm font-semibold text-[#42645a]">
                  {locationResult === "verified"
                    ? "✓ Đã xác minh bạn ở gần địa điểm."
                    : locationResult === "approximate"
                      ? "Vị trí tương đối gần địa điểm."
                      : locationResult === "recalled"
                        ? "Đã ghi nhận trải nghiệm từ lần ghé trước."
                        : "Report chưa có xác minh vị trí."}
                </p>
                <button
                  className="mt-5 rounded-xl bg-[#c96040] px-5 py-3 text-sm font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040]"
                  onClick={closeFlow}
                  type="button"
                >
                  Đóng
                </button>
              </div>
            )}

            {authState === "signed-in" && submitState !== "success" && (
              <>
                <div
                  className="mt-6 grid grid-cols-3 gap-2"
                  aria-label="Tiến độ góp vibe"
                >
                  {[1, 2, 3].map((item) => (
                    <div
                      className={`h-1.5 rounded-full ${item <= step ? "bg-[#c96040]" : "bg-[#eee6da]"}`}
                      key={item}
                    />
                  ))}
                </div>

                {step === 1 && (
                  <section
                    className="mt-6 space-y-5"
                    aria-labelledby="vibe-context-title"
                  >
                    <div>
                      <h3 className="text-lg font-bold" id="vibe-context-title">
                        1. Bạn đang chia sẻ trải nghiệm nào?
                      </h3>
                      <p className="mt-1 text-sm text-[#756c63]">
                        Chốn chỉ dùng vibe từ người đã thực sự ghé địa điểm.
                      </p>
                    </div>
                    <fieldset>
                      <legend className="text-sm font-bold">
                        Loại trải nghiệm
                      </legend>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {experienceOptions.map((option) => (
                          <button
                            aria-pressed={experience === option.id}
                            className={`rounded-2xl border p-3 text-left transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040] ${experience === option.id ? "border-[#c96040] bg-[#f5ddd3]" : "border-[#c96040]/15 bg-white hover:border-[#c96040]/45"}`}
                            key={option.id}
                            onClick={() => selectExperience(option.id)}
                            type="button"
                          >
                            <span className="block text-sm font-bold">
                              {option.label}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-[#756c63]">
                              {option.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    {experience === "not_visited" && (
                      <div className="rounded-2xl border border-[#c96040]/20 bg-white p-5">
                        <h4 className="font-bold text-[#963f2a]">
                          Vibe cần dựa trên trải nghiệm thực tế
                        </h4>
                        <p className="mt-2 text-sm leading-6 text-[#756c63]">
                          Chốn sẽ không tạo vibe report cho lựa chọn này để
                          tránh làm sai lệch xếp hạng. Flow gửi đề xuất thông
                          tin địa điểm sẽ được bổ sung ở task kế tiếp.
                        </p>
                      </div>
                    )}
                    {experience !== "not_visited" && (
                      <>
                        <label
                          className="block text-sm font-bold"
                          htmlFor="vibe-visit-mode"
                        >
                          Mục đích ghé
                          <select
                            id="vibe-visit-mode"
                            className="mt-2 w-full rounded-xl border border-[#c96040]/15 bg-white px-3 py-3 font-normal focus:border-[#c96040] focus:outline-none"
                            onChange={(event) =>
                              setVisitMode(
                                event.target.value as VibeReportVisitMode,
                              )
                            }
                            value={visitMode}
                          >
                            {visitModeOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label
                            className="block text-sm font-bold"
                            htmlFor="vibe-visited-date"
                          >
                            Ngày đã ghé
                            <input
                              id="vibe-visited-date"
                              className="mt-2 w-full rounded-xl border border-[#c96040]/15 bg-white px-3 py-3 font-normal focus:border-[#c96040] focus:outline-none"
                              max={getTodayDateValue()}
                              onChange={(event) =>
                                setVisitedDate(event.target.value)
                              }
                              type="date"
                              value={visitedDate}
                            />
                          </label>
                          <label
                            className="block text-sm font-bold"
                            htmlFor="vibe-visited-time"
                          >
                            Khoảng giờ
                            <input
                              id="vibe-visited-time"
                              className="mt-2 w-full rounded-xl border border-[#c96040]/15 bg-white px-3 py-3 font-normal focus:border-[#c96040] focus:outline-none"
                              onChange={(event) =>
                                setVisitedTime(event.target.value)
                              }
                              type="time"
                              value={visitedTime}
                            />
                          </label>
                        </div>
                        {experience === "recalled" && (
                          <p className="rounded-2xl bg-[#fff4df] p-4 text-sm leading-6 text-[#8b551f]">
                            Đây là trải nghiệm bạn nhớ lại. Ngày và khoảng giờ
                            đã ghé là bắt buộc; GPS hiện tại sẽ không được sử
                            dụng.
                          </p>
                        )}
                        {experience === "on_site" && (
                          <div className="rounded-2xl border border-[#c96040]/15 bg-white p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-sm font-bold">
                                  Xác minh bạn đang ở gần đây
                                </p>
                                <p className="mt-1 text-xs leading-5 text-[#756c63]">
                                  Chỉ truy cập vị trí một lần khi bạn chủ động
                                  bấm. Chốn chỉ lưu mức xác minh, không lưu tọa
                                  độ của bạn. Phù hợp khi bạn đang ở quán hoặc
                                  vừa ghé.
                                </p>
                              </div>
                              {locationState === "ready" && (
                                <span className="shrink-0 rounded-full bg-[#dceade] px-2.5 py-1 text-xs font-bold text-[#286146]">
                                  Đã lấy vị trí
                                </span>
                              )}
                            </div>
                            <button
                              className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-[#c96040]/35 px-4 text-sm font-bold text-[#963f2a] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040] disabled:cursor-wait disabled:opacity-60"
                              disabled={locationState === "requesting"}
                              onClick={requestLocationVerification}
                              type="button"
                            >
                              {locationState === "requesting"
                                ? "Đang xác định vị trí…"
                                : locationState === "ready"
                                  ? "Xác minh lại vị trí"
                                  : "Xác minh vị trí"}
                            </button>
                            {locationState === "denied" && (
                              <p
                                className="mt-2 text-xs text-[#963f2a]"
                                role="status"
                              >
                                Bạn đã từ chối quyền vị trí. Vẫn có thể gửi
                                report mà không xác minh.
                              </p>
                            )}
                            {locationState === "unavailable" && (
                              <p
                                className="mt-2 text-xs text-[#963f2a]"
                                role="status"
                              >
                                Chưa thể lấy vị trí. Vẫn có thể tiếp tục góp
                                vibe.
                              </p>
                            )}
                          </div>
                        )}
                        <button
                          className="w-full rounded-xl bg-[#c96040] px-4 py-3 font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040] disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={!canContinueFromContext}
                          onClick={() => setStep(2)}
                          type="button"
                        >
                          Tiếp tục
                        </button>
                      </>
                    )}
                  </section>
                )}

                {step === 2 && (
                  <section
                    className="mt-6 space-y-5"
                    aria-labelledby="vibe-questions-title"
                  >
                    <div>
                      <h3
                        className="text-lg font-bold"
                        id="vibe-questions-title"
                      >
                        2. Chấm nhanh không khí
                      </h3>
                      <p className="mt-1 text-sm text-[#756c63]">
                        Ba chiều chính là bắt buộc. Trả lời thêm các chiều tùy
                        chọn sẽ giúp kết quả đầy đủ và đáng tin hơn.
                      </p>
                    </div>
                    {[...requiredDimensions, ...optionalDimensions].map(
                      (dimension) => {
                        const copy = dimensionCopy[dimension];
                        const isRequired =
                          requiredDimensions.includes(dimension);
                        return (
                          <fieldset
                            className="rounded-2xl bg-white p-4"
                            key={dimension}
                          >
                            <legend className="font-bold">
                              {copy.label}
                              <span className="ml-2 text-xs font-semibold text-[#756c63]">
                                {isRequired ? "Bắt buộc" : "Tùy chọn"}
                              </span>
                            </legend>
                            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-[#6b7d74]">
                              <span>{copy.low}</span>
                              <span>{copy.high}</span>
                            </div>
                            <div className="mt-2 grid grid-cols-5 gap-2">
                              {[1, 2, 3, 4, 5].map((value) => (
                                <button
                                  aria-label={`${copy.label}: ${value} trên 5`}
                                  aria-pressed={scores[dimension] === value}
                                  className={`rounded-lg border px-2 py-2 text-sm font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040] ${scores[dimension] === value ? "border-[#c96040] bg-[#c96040] text-white" : "border-[#c96040]/15 bg-[#eee6da]"}`}
                                  key={value}
                                  onClick={() => updateScore(dimension, value)}
                                  type="button"
                                >
                                  {value}
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        );
                      },
                    )}
                    <label
                      className="block text-sm font-bold"
                      htmlFor="vibe-seat-availability"
                    >
                      Chỗ ngồi
                      <select
                        id="vibe-seat-availability"
                        className="mt-2 w-full rounded-xl border border-[#c96040]/15 bg-white px-3 py-3 font-normal focus:border-[#c96040] focus:outline-none"
                        onChange={(event) =>
                          setSeatAvailability(
                            event.target.value as SeatAvailability,
                          )
                        }
                        value={seatAvailability}
                      >
                        {seatOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex gap-3">
                      <button
                        className="flex-1 rounded-xl border border-[#c96040]/20 px-4 py-3 font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040]"
                        onClick={() => setStep(1)}
                        type="button"
                      >
                        Quay lại
                      </button>
                      <button
                        className="flex-1 rounded-xl bg-[#c96040] px-4 py-3 font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040] disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={!canContinueFromQuestions}
                        onClick={() => setStep(3)}
                        type="button"
                      >
                        Tiếp tục
                      </button>
                    </div>
                  </section>
                )}

                {step === 3 && (
                  <section
                    className="mt-6 space-y-5"
                    aria-labelledby="vibe-note-title"
                  >
                    <div>
                      <h3 className="text-lg font-bold" id="vibe-note-title">
                        3. Thêm ghi chú nếu muốn
                      </h3>
                      <p className="mt-1 text-sm text-[#756c63]">
                        Ghi chú ngắn giúp người khác hiểu bối cảnh trải nghiệm.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 text-sm text-[#42645a]">
                      <strong>
                        {
                          visitModeOptions.find(
                            (option) => option.id === visitMode,
                          )?.label
                        }
                      </strong>
                      <span className="mx-2">·</span>
                      {formatVisitedAt(visitedDate, visitedTime)}
                      <span className="mt-2 block text-xs text-[#756c63]">
                        {experience === "recalled"
                          ? "Trải nghiệm từ lần ghé trước sẽ được lưu là recalled."
                          : locationState === "ready"
                            ? "Vị trí sẽ được đối chiếu khi gửi report."
                            : "Report chưa có xác minh vị trí."}
                      </span>
                    </div>
                    <label
                      className="block text-sm font-bold"
                      htmlFor="vibe-short-note"
                    >
                      Ghi chú tùy chọn
                      <textarea
                        id="vibe-short-note"
                        className="mt-2 min-h-28 w-full resize-y rounded-xl border border-[#c96040]/15 bg-white px-3 py-3 font-normal focus:border-[#c96040] focus:outline-none"
                        maxLength={140}
                        onChange={(event) => setShortNote(event.target.value)}
                        placeholder="Ví dụ: Góc cửa sổ yên tĩnh vào buổi sáng."
                        value={shortNote}
                      />
                      <span className="mt-1 block text-right text-xs font-normal text-[#6b7d74]">
                        {shortNote.length}/140
                      </span>
                    </label>
                    {error && (
                      <p
                        className="rounded-xl bg-[#f5ddd3] px-3 py-2 text-sm text-[#963f2a]"
                        role="alert"
                      >
                        {error}
                      </p>
                    )}
                    <div className="flex gap-3">
                      <button
                        className="flex-1 rounded-xl border border-[#c96040]/20 px-4 py-3 font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040]"
                        disabled={submitState === "submitting"}
                        onClick={() => setStep(2)}
                        type="button"
                      >
                        Quay lại
                      </button>
                      <button
                        className="flex-1 rounded-xl bg-[#c96040] px-4 py-3 font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c96040] disabled:cursor-wait disabled:opacity-60"
                        disabled={submitState === "submitting"}
                        onClick={() => void submitReport()}
                        type="button"
                      >
                        {submitState === "submitting"
                          ? "Đang gửi…"
                          : "Gửi góp vibe"}
                      </button>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
