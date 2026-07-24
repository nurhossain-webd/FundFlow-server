import { Router } from "express";

import {
  listAdminReports,
  reportCampaign,
  resolveAdminReport,
  suspendAdminReportedCampaign,
} from "../controllers/report.controller.js";
import {
  requireAdmin,
  requireSupporter,
} from "../middlewares/authorize.middleware.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const reportRouter = Router();

reportRouter.get(
  "/admin",
  ...requireAuth,
  requireAdmin,
  asyncHandler(listAdminReports),
);
reportRouter.patch(
  "/admin/:reportId/resolve",
  ...requireAuth,
  requireAdmin,
  asyncHandler(resolveAdminReport),
);
reportRouter.patch(
  "/admin/:reportId/suspend-campaign",
  ...requireAuth,
  requireAdmin,
  asyncHandler(suspendAdminReportedCampaign),
);
reportRouter.post(
  "/campaigns/:campaignId",
  ...requireAuth,
  requireSupporter,
  asyncHandler(reportCampaign),
);
