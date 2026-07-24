import { z } from "zod";

import { REPORT_REASONS } from "../models/report.model.js";

const objectIdPattern = /^[a-f\d]{24}$/i;

export const campaignReportParamsSchema = z
  .object({
    campaignId: z
      .string()
      .regex(objectIdPattern, "Campaign ID must be a valid MongoDB ObjectId"),
  })
  .strict();

export const createCampaignReportSchema = z
  .object({
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().min(10).max(2_000),
  })
  .strict();

export type CreateCampaignReportInput = z.infer<
  typeof createCampaignReportSchema
>;
