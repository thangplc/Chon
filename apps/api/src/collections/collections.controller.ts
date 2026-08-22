import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { collectionMutationSchema } from "../../../../packages/contracts/src/collections";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import {
  CollectionsService,
  CollectionNotFoundError,
  DefaultCollectionMutationError,
  SavedPlaceNotFoundError,
} from "./collections.service";

@ApiTags("collections")
@UseGuards(AuthGuard)
@Controller("me/saved-places")
export class CollectionsController {
  constructor(
    @Inject(CollectionsService)
    private readonly collectionsService: CollectionsService,
  ) {}

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

@ApiTags("collections")
@UseGuards(AuthGuard)
@Controller("me/collections")
export class OwnedCollectionsController {
  constructor(
    @Inject(CollectionsService)
    private readonly collectionsService: CollectionsService,
  ) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.collectionsService.listCollections(getUser(request)),
    };
  }

  @Post()
  async create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseMutation(body);
    return {
      data: await this.collectionsService.createCollection(
        getUser(request),
        input,
      ),
    };
  }

  @Get(":slug")
  async read(
    @Param("slug") slug: string,
    @Req() request: AuthenticatedRequest,
  ) {
    validateSlug(slug);
    return this.handle(() =>
      this.collectionsService.readOwnedCollection(getUser(request), slug),
    );
  }

  @Patch(":slug")
  async update(
    @Param("slug") slug: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    validateSlug(slug);
    const input = parseMutation(body);
    return this.handle(() =>
      this.collectionsService.updateCollection(getUser(request), slug, input),
    );
  }

  @Delete(":slug")
  async remove(
    @Param("slug") slug: string,
    @Req() request: AuthenticatedRequest,
  ) {
    validateSlug(slug);
    await this.handle(() =>
      this.collectionsService.deleteCollection(getUser(request), slug),
    );
    return { data: { deleted: true, slug } };
  }

  @Put(":collectionSlug/places/:placeSlug")
  async addPlace(
    @Param("collectionSlug") collectionSlug: string,
    @Param("placeSlug") placeSlug: string,
    @Req() request: AuthenticatedRequest,
  ) {
    validateSlug(collectionSlug);
    validateSlug(placeSlug);
    return this.handle(() =>
      this.collectionsService.addPlaceToCollection(
        getUser(request),
        collectionSlug,
        placeSlug,
      ),
    );
  }

  @Delete(":collectionSlug/places/:placeSlug")
  async removePlace(
    @Param("collectionSlug") collectionSlug: string,
    @Param("placeSlug") placeSlug: string,
    @Req() request: AuthenticatedRequest,
  ) {
    validateSlug(collectionSlug);
    validateSlug(placeSlug);
    return this.handle(() =>
      this.collectionsService.removePlaceFromCollection(
        getUser(request),
        collectionSlug,
        placeSlug,
      ),
    );
  }

  private async handle<T>(operation: () => Promise<T>) {
    try {
      return { data: await operation() };
    } catch (error) {
      if (error instanceof CollectionNotFoundError)
        throw new NotFoundException();
      if (error instanceof DefaultCollectionMutationError)
        throw new ForbiddenException(
          "Collection mặc định không thể sửa hoặc xóa",
        );
      throw error;
    }
  }
}

@ApiTags("collections")
@Controller("collections")
export class PublicCollectionsController {
  constructor(
    @Inject(CollectionsService)
    private readonly collectionsService: CollectionsService,
  ) {}

  @Get(":id")
  async read(@Param("id") id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) throw new NotFoundException();
    try {
      return { data: await this.collectionsService.readPublicCollection(id) };
    } catch (error) {
      if (error instanceof CollectionNotFoundError)
        throw new NotFoundException();
      throw error;
    }
  }
}

function parseMutation(body: unknown) {
  const result = collectionMutationSchema.safeParse(body);
  if (!result.success) throw new BadRequestException("Collection không hợp lệ");
  return result.data;
}

function getUser(request: AuthenticatedRequest) {
  if (!request.authUser) throw new UnauthorizedException();
  return request.authUser;
}

function validateSlug(slug: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new NotFoundException();
}
