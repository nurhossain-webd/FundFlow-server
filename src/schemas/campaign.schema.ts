import { z } from "zod";

const objectIdPattern = /^[a-f\d]{24}$/i;

export const campaignIdParamsSchema = z
  .object({
    campaignId: z
      .string()
      .regex(objectIdPattern, "Campaign ID must be a valid MongoDB ObjectId"),
  })
  .strict();

const campaignFields = {
  title: z.string().trim().min(5).max(120),
  story: z.string().trim().min(50).max(20_000),
  category: z.string().trim().min(2).max(60),
  fundingGoal: z.number().int().positive().safe(),
  minimumContribution: z.number().int().positive().safe(),
  deadline: z.coerce.date(),
  rewardInfo: z.string().trim().min(5).max(2_000),
  imageURL: z.url("Campaign image must be a valid URL"),
} as const;

export const createCampaignSchema = z
  .object(campaignFields)
  .strict()
  .superRefine((campaign, context) => {
    if (campaign.deadline.getTime() <= Date.now()) {
      context.addIssue({
        code: "custom",
        path: ["deadline"],
        message: "Campaign deadline must be in the future",
      });
    }

    if (campaign.minimumContribution > campaign.fundingGoal) {
      context.addIssue({
        code: "custom",
        path: ["minimumContribution"],
        message: "Minimum contribution cannot exceed the funding goal",
      });
    }
  });

export const updateCampaignSchema = z
  .object({
    title: campaignFields.title.optional(),
    story: campaignFields.story.optional(),
    rewardInfo: campaignFields.rewardInfo.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one editable campaign field",
  });

const optionalIntegerQuery = (defaultValue: number, maximum: number) =>
  z.preprocess(
    (value) => (value === undefined ? defaultValue : value),
    z.coerce.number().int().min(1).max(maximum),
  );

export const campaignListQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    category: z.string().trim().min(2).max(60).optional(),
    deadlineBefore: z.coerce.date().optional(),
    fundingGoalMin: z.coerce.number().int().positive().safe().optional(),
    fundingGoalMax: z.coerce.number().int().positive().safe().optional(),
    status: z
      .enum(["pending", "approved", "rejected", "suspended"])
      .optional(),
    sortBy: z
      .enum([
        "createdAt",
        "amountRaised",
        "deadline",
        "fundingGoal",
        "progress",
      ])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    page: optionalIntegerQuery(1, 10_000),
    limit: optionalIntegerQuery(12, 50),
  })
  .strict()
  .superRefine((query, context) => {
    if (
      query.fundingGoalMin !== undefined &&
      query.fundingGoalMax !== undefined &&
      query.fundingGoalMin > query.fundingGoalMax
    ) {
      context.addIssue({
        code: "custom",
        path: ["fundingGoalMin"],
        message: "Minimum funding goal cannot exceed maximum funding goal",
      });
    }
  });

export const rejectCampaignSchema = z
  .object({
    reason: z.string().trim().min(5).max(500),
  })
  .strict();

export const deleteCampaignSchema = z
  .object({
    reason: z.string().trim().min(5).max(500).optional(),
  })
  .strict();

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type CampaignListQuery = z.infer<typeof campaignListQuerySchema>;
