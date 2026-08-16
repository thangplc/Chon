import { Inject, Injectable } from "@nestjs/common";
import { ZodError } from "zod";

import { analyticsEventSchema } from "../../../../packages/contracts/src/analytics";
import { DATABASE } from "../database/database.constants";
import type { ChonDatabase } from "../database/database.module";
import { analyticsEvents } from "../database/schema";

export class AnalyticsEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalyticsEventValidationError";
  }
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(DATABASE) private readonly db: ChonDatabase) {}

  async recordEvent(input: unknown): Promise<{ accepted: true }> {
    const parsed = analyticsEventSchema.safeParse(input);
    if (!parsed.success) {
      throw new AnalyticsEventValidationError(
        formatValidationError(parsed.error),
      );
    }

    await this.db.insert(analyticsEvents).values({
      eventName: parsed.data.eventName,
      payload: parsed.data.payload,
      sessionId: parsed.data.sessionId,
    });

    return { accepted: true };
  }
}

function formatValidationError(error: ZodError): string {
  const issue = error.issues[0];
  return issue
    ? `${issue.path.join(".") || "event"}: ${issue.message}`
    : "Invalid analytics event";
}
