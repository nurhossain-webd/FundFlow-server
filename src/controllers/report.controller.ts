import type { Request, Response } from "express";

import {
  adminReportListQuerySchema,
  campaignReportParamsSchema,
  createCampaignReportSchema,
  reportIdParamsSchema,
  resolveReportSchema,
} from "../schemas/report.schema.js";
import {
  createCampaignReport,
  getAdminReports,
  resolveCampaignReport,
  suspendReportedCampaign,
} from "../services/report.service.js";
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
  const report = await createCampaignReport(request.user, campaignId, input);

  response.status(201).json({
    success: true,
    message: "Campaign report submitted for administrator review",
    data: { report },
  });
};

export const listAdminReports = async (
  request: Request,
  response: Response,
): Promise<void> => {
  if (!request.user) {
    throw new AppError(401, "Authentication required");
  }
  const query = adminReportListQuerySchema.parse(request.query);
  const result = await getAdminReports(query);
  response.status(200).json({ success: true, data: result });
};

export const resolveAdminReport = async (
  request: Request,
  response: Response,
): Promise<void> => {
  if (!request.user) {
    throw new AppError(401, "Authentication required");
  }
  const { reportId } = reportIdParamsSchema.parse(request.params);
  const { resolutionNote } = resolveReportSchema.parse(request.body);
  const report = await resolveCampaignReport(
    reportId,
    request.user,
    resolutionNote,
  );
  response.status(200).json({
    success: true,
    message: "Campaign report resolved",
    data: { report },
  });
};

export const suspendAdminReportedCampaign = async (
  request: Request,
  response: Response,
): Promise<void> => {
  if (!request.user) {
    throw new AppError(401, "Authentication required");
  }
  const { reportId } = reportIdParamsSchema.parse(request.params);
  const { resolutionNote } = resolveReportSchema.parse(request.body);
  const result = await suspendReportedCampaign(
    reportId,
    request.user,
    resolutionNote,
  );
  response.status(200).json({
    success: true,
    message: "Campaign suspended and active reports resolved",
    data: result,
  });
};
