import {
  Body,
  Controller,
  HttpException,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import {
  VibeReportPlaceNotFoundError,
  VibeReportValidationError,
  VibeReportsService,
} from "./vibe-reports.service";

@ApiTags("vibe-reports")
@Controller("places")
export class VibeReportsController {
  constructor(
    @Inject(VibeReportsService)
    private readonly vibeReportsService: VibeReportsService,
  ) {}

  @ApiOperation({ summary: "Submit a community vibe report for a place" })
  @ApiCreatedResponse({ description: "Community report pending moderation" })
  @ApiBadRequestResponse({ description: "Invalid community report" })
  @ApiNotFoundResponse({ description: "Place is not publicly available" })
  @UseGuards(AuthGuard)
  @Post(":slug/vibe-reports")
  async create(
    @Param("slug") slug: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
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
      throw error;
    }
  }
}
