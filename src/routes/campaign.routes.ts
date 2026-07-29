import { Router } from "express";

import {
  approvePendingCampaign,
  createCampaignUpdate,
  createCreatorCampaign,
  deleteAdminCampaign,
  deleteCreatorCampaign,
  getApprovedCampaign,
  getCreatorCampaign,
  listApprovedCampaigns,
  listAdminCampaigns,
  listCreatorCampaigns,
  listPendingCampaigns,
  listTopFundedCampaigns,
  rejectPendingCampaign,
  updateCampaign,
} from "../controllers/campaign.controller.js";
import {
  requireAdmin,
  requireCreator,
} from "../middlewares/authorize.middleware.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const campaignRouter = Router();

campaignRouter.get(
  "/admin",
  ...requireAuth,
  requireAdmin,
  asyncHandler(listAdminCampaigns),
);
campaignRouter.get(
  "/admin/pending",
  ...requireAuth,
  requireAdmin,
  asyncHandler(listPendingCampaigns),
);
campaignRouter.post(
  "/:campaignId/updates",
  ...requireAuth,
  requireCreator,
  asyncHandler(createCampaignUpdate),
);
campaignRouter.patch(
  "/admin/:campaignId/approve",
  ...requireAuth,
  requireAdmin,
  asyncHandler(approvePendingCampaign),
);
campaignRouter.patch(
  "/admin/:campaignId/reject",
  ...requireAuth,
  requireAdmin,
  asyncHandler(rejectPendingCampaign),
);
campaignRouter.delete(
  "/admin/:campaignId",
  ...requireAuth,
  requireAdmin,
  asyncHandler(deleteAdminCampaign),
);

campaignRouter.post(
  "/",
  ...requireAuth,
  requireCreator,
  asyncHandler(createCreatorCampaign),
);
campaignRouter.get(
  "/mine",
  ...requireAuth,
  requireCreator,
  asyncHandler(listCreatorCampaigns),
);
campaignRouter.get(
  "/mine/:campaignId",
  ...requireAuth,
  requireCreator,
  asyncHandler(getCreatorCampaign),
);
campaignRouter.patch(
  "/:campaignId",
  ...requireAuth,
  requireCreator,
  asyncHandler(updateCampaign),
);
campaignRouter.delete(
  "/:campaignId",
  ...requireAuth,
  requireCreator,
  asyncHandler(deleteCreatorCampaign),
);

campaignRouter.get("/", asyncHandler(listApprovedCampaigns));
campaignRouter.get("/top-funded", asyncHandler(listTopFundedCampaigns));
campaignRouter.get("/:campaignId", asyncHandler(getApprovedCampaign));
