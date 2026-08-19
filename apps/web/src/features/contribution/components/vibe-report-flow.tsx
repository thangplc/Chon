"use client";

import type {
  CommunityVibeReportInput,
  VibeReportDimension,
  VibeReportVisitMode,
} from "@chon/contracts/vibe-report";
import { signIn } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

import { submitCommunityVibeReport } from "../data/vibe-report-repository";

type VibeReportFlowProps = Readonly<{
  placeName: string;
  placeSlug: string;
}>;

type AuthState = "checking" | "signed-in" | "signed-out" | "unavailable";
type Step = 1 | 2 | 3;
type ScoreMap = Partial<Record<VibeReportDimension, number>>;
type SeatAvailability = "easy" | "normal" | "difficult" | "unknown";

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

export function VibeReportFlow({ placeName, placeSlug }: VibeReportFlowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authCheckAttempt, setAuthCheckAttempt] = useState(0);
  const [step, setStep] = useState<Step>(1);
  const [visitMode, setVisitMode] = useState<VibeReportVisitMode>("work");
  const [visitedDate, setVisitedDate] = useState(getTodayDateValue);
  const [visitedTime, setVisitedTime] = useState("09:00");
  const [scores, setScores] = useState<ScoreMap>({});
  const [seatAvailability, setSeatAvailability] =
    useState<SeatAvailability>("unknown");
  const [shortNote, setShortNote] = useState("");
  const [submitState, setSubmitState] = useState<
    "idle" | "submitting" | "success"
  >("idle");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredDimensions = dimensionsByVisitMode[visitMode];
  const answeredRequiredDimensions = requiredDimensions.filter(
    (dimension) => scores[dimension] !== undefined,
  ).length;
  const canContinueFromContext = Boolean(visitedDate && visitedTime);
  const canContinueFromQuestions =
    answeredRequiredDimensions === requiredDimensions.length;

  const callbackDescription = useMemo(
    () => `Đăng nhập để góp vibe cho ${placeName}`,
    [placeName],
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("contribute") !== "1") return;

    queueMicrotask(() => setIsOpen(true));
    url.searchParams.delete("contribute");
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

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
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  function closeFlow() {
    setIsOpen(false);
    setStep(1);
    setSubmitState("idle");
    setError(null);
  }

  function openFlow() {
    setAuthState("checking");
    setIsOpen(true);
  }

  async function startGoogleSignIn() {
    setIsSigningIn(true);
    setError(null);

    try {
      const callbackUrl = new URL(window.location.href);
      callbackUrl.searchParams.set("contribute", "1");
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

  async function submitReport() {
    setSubmitState("submitting");
    setError(null);
    const input: CommunityVibeReportInput = {
      scores,
      seatAvailability,
      shortNote: shortNote.trim() || undefined,
      visitMode,
      visitedAt: new Date(
        `${visitedDate}T${visitedTime}:00+07:00`,
      ).toISOString(),
    };

    try {
      await submitCommunityVibeReport(placeSlug, input);
      setSubmitState("success");
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
      <button
        className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#f4c96b]/70 px-4 py-2.5 text-sm font-bold text-[#f8f3e8] transition hover:bg-[#f4c96b]/15 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f4c96b]"
        onClick={openFlow}
        type="button"
      >
        Góp vibe
        <span aria-hidden="true">✦</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#173f33]/55 p-0 sm:items-center sm:p-6">
          <div
            aria-describedby="vibe-report-description"
            aria-labelledby="vibe-report-title"
            aria-modal="true"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-[#f8f3e8] p-5 text-[#173f33] shadow-2xl sm:rounded-[2rem] sm:p-7"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.14em] text-[#8b5a2b] uppercase">
                  Đóng góp community
                </p>
                <h2
                  className="mt-1 text-2xl font-semibold"
                  id="vibe-report-title"
                >
                  Góp vibe cho {placeName}
                </h2>
                <p
                  className="mt-2 text-sm leading-6 text-[#5e746a]"
                  id="vibe-report-description"
                >
                  {callbackDescription}. Chốn sẽ hiển thị report sau khi được
                  duyệt.
                </p>
              </div>
              <button
                aria-label="Đóng góp vibe"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-xl font-bold shadow-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c59635]"
                onClick={closeFlow}
                type="button"
              >
                ×
              </button>
            </div>

            {authState === "checking" && (
              <div className="mt-8 rounded-2xl bg-white p-6 text-center text-sm text-[#5e746a]">
                Đang kiểm tra phiên đăng nhập…
              </div>
            )}

            {authState === "signed-out" && (
              <div className="mt-8 rounded-2xl bg-white p-6 text-center">
                <p className="text-base font-bold">Cần đăng nhập để góp vibe</p>
                <p className="mt-2 text-sm leading-6 text-[#5e746a]">
                  Bạn có thể xem Explore công khai, nhưng report community cần
                  gắn với identity để được kiểm duyệt.
                </p>
                <button
                  className="mt-5 inline-flex rounded-xl bg-[#173f33] px-5 py-3 text-sm font-bold text-[#f8f3e8] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c59635]"
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
                <p className="mt-2 text-sm leading-6 text-[#5e746a]">
                  Dịch vụ xác thực tạm thời chưa sẵn sàng. Vui lòng thử lại sau
                  giây lát.
                </p>
                <button
                  className="mt-5 inline-flex rounded-xl bg-[#173f33] px-5 py-3 text-sm font-bold text-[#f8f3e8] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c59635]"
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
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-[#dce8e1] text-2xl">
                  ✓
                </div>
                <h3 className="mt-4 text-xl font-bold">Đã nhận góp vibe</h3>
                <p className="mt-2 text-sm leading-6 text-[#5e746a]">
                  Report đang chờ duyệt. Điểm vibe trên Explore sẽ chỉ cập nhật
                  sau khi report được kiểm tra.
                </p>
                <button
                  className="mt-5 rounded-xl bg-[#173f33] px-5 py-3 text-sm font-bold text-[#f8f3e8] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c59635]"
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
                      className={`h-1.5 rounded-full ${item <= step ? "bg-[#c59635]" : "bg-[#dce8e1]"}`}
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
                        1. Bạn ghé Chốn này khi nào?
                      </h3>
                      <p className="mt-1 text-sm text-[#5e746a]">
                        Chọn thời điểm gần nhất bạn đã trải nghiệm địa điểm.
                      </p>
                    </div>
                    <label
                      className="block text-sm font-bold"
                      htmlFor="vibe-visit-mode"
                    >
                      Mục đích ghé
                      <select
                        id="vibe-visit-mode"
                        className="mt-2 w-full rounded-xl border border-[#173f33]/15 bg-white px-3 py-3 font-normal focus:border-[#c59635] focus:outline-none"
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
                          className="mt-2 w-full rounded-xl border border-[#173f33]/15 bg-white px-3 py-3 font-normal focus:border-[#c59635] focus:outline-none"
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
                          className="mt-2 w-full rounded-xl border border-[#173f33]/15 bg-white px-3 py-3 font-normal focus:border-[#c59635] focus:outline-none"
                          onChange={(event) =>
                            setVisitedTime(event.target.value)
                          }
                          type="time"
                          value={visitedTime}
                        />
                      </label>
                    </div>
                    <button
                      className="w-full rounded-xl bg-[#173f33] px-4 py-3 font-bold text-[#f8f3e8] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c59635] disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!canContinueFromContext}
                      onClick={() => setStep(2)}
                      type="button"
                    >
                      Tiếp tục
                    </button>
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
                      <p className="mt-1 text-sm text-[#5e746a]">
                        Chọn một mức cho ba chiều phù hợp với mục đích của bạn.
                      </p>
                    </div>
                    {requiredDimensions.map((dimension) => {
                      const copy = dimensionCopy[dimension];
                      return (
                        <fieldset
                          className="rounded-2xl bg-white p-4"
                          key={dimension}
                        >
                          <legend className="font-bold">{copy.label}</legend>
                          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-[#6b7d74]">
                            <span>{copy.low}</span>
                            <span>{copy.high}</span>
                          </div>
                          <div className="mt-2 grid grid-cols-5 gap-2">
                            {[1, 2, 3, 4, 5].map((value) => (
                              <button
                                aria-label={`${copy.label}: ${value} trên 5`}
                                aria-pressed={scores[dimension] === value}
                                className={`rounded-lg border px-2 py-2 text-sm font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c59635] ${scores[dimension] === value ? "border-[#173f33] bg-[#173f33] text-white" : "border-[#173f33]/15 bg-[#f8f3e8]"}`}
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
                    })}
                    <label
                      className="block text-sm font-bold"
                      htmlFor="vibe-seat-availability"
                    >
                      Chỗ ngồi
                      <select
                        id="vibe-seat-availability"
                        className="mt-2 w-full rounded-xl border border-[#173f33]/15 bg-white px-3 py-3 font-normal focus:border-[#c59635] focus:outline-none"
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
                        className="flex-1 rounded-xl border border-[#173f33]/20 px-4 py-3 font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c59635]"
                        onClick={() => setStep(1)}
                        type="button"
                      >
                        Quay lại
                      </button>
                      <button
                        className="flex-1 rounded-xl bg-[#173f33] px-4 py-3 font-bold text-[#f8f3e8] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c59635] disabled:cursor-not-allowed disabled:opacity-40"
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
                      <p className="mt-1 text-sm text-[#5e746a]">
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
                    </div>
                    <label
                      className="block text-sm font-bold"
                      htmlFor="vibe-short-note"
                    >
                      Ghi chú tùy chọn
                      <textarea
                        id="vibe-short-note"
                        className="mt-2 min-h-28 w-full resize-y rounded-xl border border-[#173f33]/15 bg-white px-3 py-3 font-normal focus:border-[#c59635] focus:outline-none"
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
                        className="rounded-xl bg-[#f7eee0] px-3 py-2 text-sm text-[#8b5a2b]"
                        role="alert"
                      >
                        {error}
                      </p>
                    )}
                    <div className="flex gap-3">
                      <button
                        className="flex-1 rounded-xl border border-[#173f33]/20 px-4 py-3 font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c59635]"
                        disabled={submitState === "submitting"}
                        onClick={() => setStep(2)}
                        type="button"
                      >
                        Quay lại
                      </button>
                      <button
                        className="flex-1 rounded-xl bg-[#173f33] px-4 py-3 font-bold text-[#f8f3e8] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c59635] disabled:cursor-wait disabled:opacity-60"
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
