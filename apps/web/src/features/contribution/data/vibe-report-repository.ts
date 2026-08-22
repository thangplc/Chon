import {
  vibeReportSubmissionResponseSchema,
  type CommunityVibeReportInput,
  type VibeReportSubmissionResponse,
} from "@chon/contracts/vibe-report";

export async function submitCommunityVibeReport(
  slug: string,
  input: CommunityVibeReportInput,
): Promise<VibeReportSubmissionResponse> {
  const response = await fetch(
    `/api/places/${encodeURIComponent(slug)}/vibe-reports`,
    {
      body: JSON.stringify(input),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const body = (await response.json()) as {
    code?: string;
    detail?: string;
    retryAfterSeconds?: number;
    title?: string;
  };

  if (!response.ok) {
    throw new VibeReportSubmissionError(
      body.detail ?? body.title ?? "Không thể gửi góp vibe",
      body.code,
      body.retryAfterSeconds,
    );
  }

  return vibeReportSubmissionResponseSchema.parse(body);
}

export class VibeReportSubmissionError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "VibeReportSubmissionError";
  }
}
