import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq } from "drizzle-orm";
import { jwtVerify, type JWTPayload } from "jose";

import {
  authAssertionSchema,
  type AuthAssertion,
  type AuthUser,
} from "../../../../packages/contracts/src/auth";

import type { ApiEnvironment } from "../config/api-environment";
import { DATABASE } from "../database/database.constants";
import type { ChonDatabase } from "../database/database.module";
import { userIdentities, users } from "../database/schema";
import type { VerifiedAuthAssertion } from "./auth.types";

type AuthJwtPayload = JWTPayload & {
  email?: unknown;
  name?: unknown;
  picture?: unknown;
  provider?: unknown;
  providerSubject?: unknown;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService<ApiEnvironment, true>,
    @Inject(DATABASE) private readonly db: ChonDatabase,
  ) {}

  async verifyBearerToken(
    header: string | string[] | undefined,
  ): Promise<VerifiedAuthAssertion> {
    const token = Array.isArray(header) ? header[0] : header;
    if (!token?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Authentication required");
    }

    try {
      const secret = new TextEncoder().encode(
        this.config.get("AUTH_API_SECRET", { infer: true }),
      );
      const { payload } = await jwtVerify<AuthJwtPayload>(
        token.slice("Bearer ".length).trim(),
        secret,
        {
          algorithms: ["HS256"],
          audience: this.config.get("AUTH_API_AUDIENCE", { infer: true }),
          issuer: this.config.get("AUTH_API_ISSUER", { infer: true }),
        },
      );
      const assertion = parseAssertionPayload(payload);
      if (typeof payload.iat !== "number") {
        throw new Error("Missing issued-at claim");
      }
      return { ...assertion, issuedAt: payload.iat };
    } catch {
      throw new UnauthorizedException("Invalid authentication token");
    }
  }

  async resolveUser(assertion: AuthAssertion): Promise<AuthUser> {
    return this.db.transaction(async (tx) => {
      const existingIdentity = await tx
        .select({ userId: userIdentities.userId })
        .from(userIdentities)
        .where(
          and(
            eq(userIdentities.provider, assertion.provider),
            eq(userIdentities.providerSubject, assertion.providerSubject),
          ),
        )
        .limit(1);

      const userId = existingIdentity[0]?.userId;
      if (userId) {
        const updatedUser = await this.updateUser(tx, userId, assertion);
        return toAuthUser(updatedUser, assertion.provider);
      }

      const insertedUsers = await tx
        .insert(users)
        .values(toUserInsert(assertion))
        .returning();
      const user = insertedUsers[0];
      if (!user) throw new Error("User insert returned no row");

      await tx.insert(userIdentities).values({
        provider: assertion.provider,
        providerSubject: assertion.providerSubject,
        userId: user.id,
      });

      return toAuthUser(user, assertion.provider);
    });
  }

  private async updateUser(
    tx: Parameters<Parameters<ChonDatabase["transaction"]>[0]>[0],
    userId: string,
    assertion: AuthAssertion,
  ) {
    const updatedUsers = await tx
      .update(users)
      .set({
        avatarUrl: assertion.picture ?? null,
        displayName: assertion.name ?? null,
        email: assertion.email ?? null,
        emailVerifiedAt: assertion.email ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    const user = updatedUsers[0];
    if (!user) throw new UnauthorizedException("User account not found");
    return user;
  }
}

function parseAssertionPayload(payload: AuthJwtPayload): AuthAssertion {
  return authAssertionSchema.parse({
    email: nullableClaim(payload.email),
    name: nullableClaim(payload.name),
    picture: nullableClaim(payload.picture),
    provider: payload.provider,
    providerSubject: payload.providerSubject,
    sub: payload.sub,
  });
}

function nullableClaim(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toUserInsert(assertion: AuthAssertion) {
  return {
    avatarUrl: assertion.picture ?? null,
    displayName: assertion.name ?? null,
    email: assertion.email ?? null,
    emailVerifiedAt: assertion.email ? new Date() : null,
  };
}

function toAuthUser(
  user: typeof users.$inferSelect,
  provider: AuthAssertion["provider"],
): AuthUser {
  return {
    avatarUrl: user.avatarUrl,
    displayName: user.displayName,
    email: user.email,
    id: user.id,
    provider,
    status: user.status,
  };
}
