import { Router } from "express";

import { getAdminDashboard } from "../controllers/admin-dashboard.controller.js";
import { getCreatorDashboard } from "../controllers/creator-dashboard.controller.js";
import { getSupporterDashboard } from "../controllers/supporter-dashboard.controller.js";
import {
  requireCreator,
  requireAdmin,
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

dashboardRouter.get(
  "/admin",
  ...requireAuth,
  requireAdmin,
  asyncHandler(getAdminDashboard),
);
