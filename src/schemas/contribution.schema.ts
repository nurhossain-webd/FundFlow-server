import { z } from "zod";

const objectIdPattern = /^[a-f\d]{24}$/i;

export const contributionIdParamsSchema = z
  .object({
    contributionId: z
      .string()
      .regex(
        objectIdPattern,
        "Contribution ID must be a valid MongoDB ObjectId",
      ),
  })
  .strict();

export const createContributionSchema = z
  .object({
    campaignId: z
      .string()
      .regex(objectIdPattern, "Campaign ID must be a valid MongoDB ObjectId"),
    amount: z.number().int().positive().safe(),
    message: z.string().trim().min(2).max(1_000).optional(),
  })
  .strict();

export const contributionIdempotencyKeySchema = z
  .string()
  .trim()
  .min(16, "Idempotency-Key must contain at least 16 characters")
  .max(100, "Idempotency-Key cannot exceed 100 characters")
  .regex(
    /^[A-Za-z0-9._:-]+$/,
    "Idempotency-Key contains unsupported characters",
  );

const optionalIntegerQuery = (defaultValue: number, maximum: number) =>
  z.preprocess(
    (value) => (value === undefined ? defaultValue : value),
    z.coerce.number().int().min(1).max(maximum),
  );

export const contributionListQuerySchema = z
  .object({
    page: optionalIntegerQuery(1, 10_000),
    limit: optionalIntegerQuery(12, 50),
    status: z
      .enum(["pending", "approved", "rejected", "refunded"])
      .optional(),
  })
  .strict();

export const rejectContributionSchema = z
  .object({
    reason: z.string().trim().min(5).max(500),
  })
  .strict();

export type CreateContributionInput = z.infer<
  typeof createContributionSchema
>;
export type ContributionListQuery = z.infer<
  typeof contributionListQuerySchema
>;
