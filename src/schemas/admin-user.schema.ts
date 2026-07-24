import { z } from "zod";

import { USER_ROLES } from "../models/user-profile.model.js";

const objectIdPattern = /^[a-f\d]{24}$/i;

const optionalIntegerQuery = (defaultValue: number, maximum: number) =>
  z.preprocess(
    (value) => (value === undefined ? defaultValue : value),
    z.coerce.number().int().min(1).max(maximum),
  );

export const adminUserListQuerySchema = z
  .object({
    page: optionalIntegerQuery(1, 10_000),
    limit: optionalIntegerQuery(10, 50),
    search: z.string().trim().max(100).optional(),
    role: z.enum(USER_ROLES).optional(),
  })
  .strict();

export const adminUserIdParamsSchema = z
  .object({
    userId: z
      .string()
      .regex(objectIdPattern, "User ID must be a valid MongoDB ObjectId"),
  })
  .strict();

export const changeUserRoleSchema = z
  .object({
    role: z.enum(USER_ROLES),
  })
  .strict();

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
