import {
  Body,
  Controller,
  HttpException,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import {
  VibeReportPlaceNotFoundError,
  VibeReportValidationError,
  VibeReportsService,
} from "./vibe-reports.service";
import {
  VibeReportDuplicateError,
  VibeReportRateLimitError,
} from "./vibe-report-abuse.service";

@ApiTags("vibe-reports")
@Controller("places")
export class VibeReportsController {
  constructor(
    @Inject(VibeReportsService)
    private readonly vibeReportsService: VibeReportsService,
  ) {}

  @ApiOperation({ summary: "Submit a community vibe report for a place" })
  @ApiCreatedResponse({ description: "Community report published" })
  @ApiBadRequestResponse({ description: "Invalid community report" })
  @ApiConflictResponse({ description: "Identical contribution already exists" })
  @ApiTooManyRequestsResponse({ description: "Contribution rate exceeded" })
  @ApiNotFoundResponse({ description: "Place is not publicly available" })
  @UseGuards(AuthGuard)
  @Post(":slug/vibe-reports")
  async create(
    @Param("slug") slug: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true })
    response: { setHeader(name: string, value: number | string): void },
  ) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new NotFoundException();
    }
    if (!request.authUser) {
      throw new UnauthorizedException("Authentication required");
    }

    try {
      return {
        data: await this.vibeReportsService.createForPlaceSlug(
          slug,
          body,
          request.authUser,
        ),
      };
    } catch (error) {
      if (error instanceof VibeReportPlaceNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof VibeReportValidationError) {
        throw new HttpException(
          {
            code: "vibe_report_invalid",
            detail: error.message,
            status: 400,
            title: "Invalid vibe report",
            type: "about:blank",
          },
          400,
        );
      }
      if (error instanceof VibeReportDuplicateError) {
        throw new HttpException(
          {
            code: "vibe_report_duplicate",
            detail: "Bạn đã gửi một góp vibe giống hệt cho lần ghé này.",
            status: 409,
            title: "Góp vibe đã tồn tại",
            type: "about:blank",
          },
          409,
        );
      }
      if (error instanceof VibeReportRateLimitError) {
        response.setHeader("Retry-After", error.retryAfterSeconds);
        throw new HttpException(
          {
            code: "vibe_report_rate_limited",
            detail: formatRateLimitDetail(error),
            retryAfterSeconds: error.retryAfterSeconds,
            status: 429,
            title: "Bạn đang góp vibe quá nhanh",
            type: "about:blank",
          },
          429,
        );
      }
      throw error;
    }
  }
}

function formatRateLimitDetail(error: VibeReportRateLimitError): string {
  const minutes = Math.max(1, Math.ceil(error.retryAfterSeconds / 60));
  if (error.reason === "place_cooldown") {
    return `Bạn vừa góp vibe cho địa điểm này. Hãy thử lại sau ${minutes} phút.`;
  }
  return `Bạn đã gửi nhiều góp vibe trong thời gian ngắn. Hãy thử lại sau ${minutes} phút.`;
}
