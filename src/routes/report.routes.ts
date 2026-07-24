import { Router } from "express";

import { reportCampaign } from "../controllers/report.controller.js";
import { requireSupporter } from "../middlewares/authorize.middleware.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const reportRouter = Router();

reportRouter.post(
  "/campaigns/:campaignId",
  ...requireAuth,
  requireSupporter,
  asyncHandler(reportCampaign),
);
