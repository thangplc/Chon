import "server-only";

import { SignJWT } from "jose";
import type { Session } from "next-auth";

import type { AuthAssertion } from "@chon/contracts/auth";

const DEFAULT_ISSUER = "chon-web";
const DEFAULT_AUDIENCE = "chon-api";

export async function createApiAssertion(
  user: Session["user"],
): Promise<string> {
  const secretValue = process.env.AUTH_API_SECRET?.trim();
  if (!secretValue || secretValue.length < 32) {
    throw new Error("AUTH_API_SECRET must contain at least 32 characters");
  }
  const providerSubject = user.providerSubject ?? user.id;
  const provider = user.provider;
  if (!provider || !providerSubject) {
    throw new Error("Authenticated user is missing provider identity");
  }

  const payload: AuthAssertion = {
    email: user.email ?? null,
    name: user.name ?? null,
    picture: user.image ?? null,
    provider,
    providerSubject,
    sub: user.id,
  };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setAudience(process.env.AUTH_API_AUDIENCE?.trim() || DEFAULT_AUDIENCE)
    .setExpirationTime("60s")
    .setIssuedAt()
    .setIssuer(process.env.AUTH_API_ISSUER?.trim() || DEFAULT_ISSUER)
    .setSubject(user.id)
    .sign(new TextEncoder().encode(secretValue));
}
