import { Body, Controller, HttpException, Inject, Post } from "@nestjs/common";
import { ApiAcceptedResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  AnalyticsEventValidationError,
  AnalyticsService,
} from "./analytics.service";

@ApiTags("analytics")
@Controller("analytics")
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService)
    private readonly analyticsService: AnalyticsService,
  ) {}

  @ApiOperation({ summary: "Record a privacy-safe analytics event" })
  @ApiAcceptedResponse({ description: "Analytics event accepted" })
  @Post("events")
  async recordEvent(@Body() body: unknown) {
    try {
      return { data: await this.analyticsService.recordEvent(body) };
    } catch (error) {
      if (error instanceof AnalyticsEventValidationError) {
        throw new HttpException(
          {
            code: "analytics_event_invalid",
            detail: error.message,
            status: 400,
            title: "Invalid analytics event",
            type: "about:blank",
          },
          400,
        );
      }
      throw error;
    }
  }
}
