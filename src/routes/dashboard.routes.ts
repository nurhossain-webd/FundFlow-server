import { Router } from "express";

import { getCreatorDashboard } from "../controllers/creator-dashboard.controller.js";
import { getSupporterDashboard } from "../controllers/supporter-dashboard.controller.js";
import {
  requireCreator,
  requireSupporter,
} from "../middlewares/authorize.middleware.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/creator",
  ...requireAuth,
  requireCreator,
  asyncHandler(getCreatorDashboard),
);

dashboardRouter.get(
  "/supporter",
  ...requireAuth,
  requireSupporter,
  asyncHandler(getSupporterDashboard),
);
