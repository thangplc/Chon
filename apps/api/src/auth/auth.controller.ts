import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { AuthGuard } from "./auth.guard";
import type { AuthenticatedRequest } from "./auth.types";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  @ApiOperation({ summary: "Read the authenticated Chốn user" })
  @ApiOkResponse({ description: "Authenticated user" })
  @ApiUnauthorizedResponse({ description: "Authentication is required" })
  @UseGuards(AuthGuard)
  @Get("me")
  readCurrentUser(@Req() request: AuthenticatedRequest) {
    if (!request.authUser) {
      throw new UnauthorizedException("Authentication required");
    }
    return { data: request.authUser };
  }
}
