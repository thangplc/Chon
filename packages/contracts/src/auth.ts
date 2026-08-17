import { z } from "zod";

const nullableText = (max: number) =>
  z.union([z.string().trim().min(1).max(max), z.null()]);

export const authProviderSchema = z.enum(["google"]);

export const authAssertionSchema = z
  .object({
    email: nullableText(320).optional(),
    name: nullableText(120).optional(),
    picture: nullableText(2048).optional(),
    provider: authProviderSchema,
    providerSubject: z.string().trim().min(1).max(255),
    sub: z.string().trim().min(1).max(128),
  })
  .strict();

export type AuthAssertion = z.infer<typeof authAssertionSchema>;

export const authUserSchema = z
  .object({
    avatarUrl: z.string().url().max(2048).nullable(),
    displayName: z.string().trim().min(1).max(120).nullable(),
    email: z.string().email().max(320).nullable(),
    id: z.string().uuid(),
    provider: authProviderSchema,
    status: z.enum(["active", "suspended", "deleted"]),
  })
  .strict();

export type AuthUser = z.infer<typeof authUserSchema>;

export const authMeResponseSchema = z.object({
  data: authUserSchema,
});
