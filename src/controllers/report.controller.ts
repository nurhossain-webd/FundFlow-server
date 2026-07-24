import type { Request, Response } from "express";

import {
  campaignReportParamsSchema,
  createCampaignReportSchema,
} from "../schemas/report.schema.js";
import { createCampaignReport } from "../services/report.service.js";
import { AppError } from "../utils/app-error.js";

export const reportCampaign = async (
  request: Request,
  response: Response,
): Promise<void> => {
  if (!request.user) {
    throw new AppError(401, "Authentication required");
  }

  const { campaignId } = campaignReportParamsSchema.parse(request.params);
  const input = createCampaignReportSchema.parse(request.body);
  const report = await createCampaignReport(
    request.user,
    campaignId,
    input,
  );

  response.status(201).json({
    success: true,
    message: "Campaign report submitted for administrator review",
    data: { report },
  });
};
