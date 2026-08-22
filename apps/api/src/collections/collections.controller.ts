import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import {
  CollectionsService,
  SavedPlaceNotFoundError,
} from "./collections.service";

@ApiTags("collections")
@UseGuards(AuthGuard)
@Controller("me/saved-places")
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @ApiOperation({ summary: "List the authenticated user's saved places" })
  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.collectionsService.listSavedPlaces(getUser(request)),
    };
  }

  @ApiOperation({ summary: "Read saved status for one place" })
  @Get(":slug")
  async read(
    @Param("slug") slug: string,
    @Req() request: AuthenticatedRequest,
  ) {
    validateSlug(slug);
    return {
      data: await this.collectionsService.readSavedPlaceStatus(
        getUser(request),
        slug,
      ),
    };
  }

  @ApiOperation({ summary: "Save a place to the default private collection" })
  @Put(":slug")
  async save(
    @Param("slug") slug: string,
    @Req() request: AuthenticatedRequest,
  ) {
    validateSlug(slug);
    try {
      return {
        data: await this.collectionsService.savePlace(getUser(request), slug),
      };
    } catch (error) {
      if (error instanceof SavedPlaceNotFoundError)
        throw new NotFoundException();
      throw error;
    }
  }

  @ApiOperation({ summary: "Remove a place from the default collection" })
  @Delete(":slug")
  async remove(
    @Param("slug") slug: string,
    @Req() request: AuthenticatedRequest,
  ) {
    validateSlug(slug);
    return {
      data: await this.collectionsService.removeSavedPlace(
        getUser(request),
        slug,
      ),
    };
  }
}

function getUser(request: AuthenticatedRequest) {
  if (!request.authUser) throw new UnauthorizedException();
  return request.authUser;
}

function validateSlug(slug: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new NotFoundException();
}
