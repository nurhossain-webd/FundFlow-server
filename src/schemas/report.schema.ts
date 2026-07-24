import { z } from "zod";

import { REPORT_REASONS, REPORT_STATUSES } from "../models/report.model.js";

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

const optionalIntegerQuery = (defaultValue: number, maximum: number) =>
  z.preprocess(
    (value) => (value === undefined ? defaultValue : value),
    z.coerce.number().int().min(1).max(maximum),
  );

export const adminReportListQuerySchema = z
  .object({
    page: optionalIntegerQuery(1, 10_000),
    limit: optionalIntegerQuery(20, 100),
    search: z.string().trim().max(100).optional(),
    status: z.enum(REPORT_STATUSES).optional(),
  })
  .strict();

export const reportIdParamsSchema = z
  .object({
    reportId: z
      .string()
      .regex(objectIdPattern, "Report ID must be a valid MongoDB ObjectId"),
  })
  .strict();

export const resolveReportSchema = z
  .object({
    resolutionNote: z.string().trim().min(5).max(2_000).optional(),
  })
  .strict();

export type CreateCampaignReportInput = z.infer<
  typeof createCampaignReportSchema
>;
export type AdminReportListQuery = z.infer<typeof adminReportListQuerySchema>;
