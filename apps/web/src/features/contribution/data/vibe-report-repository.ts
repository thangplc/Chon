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
    detail?: string;
    title?: string;
  };

  if (!response.ok) {
    throw new Error(body.detail ?? body.title ?? "Không thể gửi góp vibe");
  }

  return vibeReportSubmissionResponseSchema.parse(body);
}
