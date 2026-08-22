import type {
  AuthAssertion,
  AuthUser,
} from "../../../../packages/contracts/src/auth";

export type AuthenticatedRequest = Readonly<{
  authUser?: AuthUser;
  headers: Readonly<Record<string, string | string[] | undefined>>;
}>;

export type VerifiedAuthAssertion = AuthAssertion &
  Readonly<{
    issuedAt: number;
  }>;
