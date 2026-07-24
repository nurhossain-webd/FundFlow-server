import { Router } from "express";

import { getCreatorDashboard } from "../controllers/creator-dashboard.controller.js";
import { requireCreator } from "../middlewares/authorize.middleware.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/creator",
  ...requireAuth,
  requireCreator,
  asyncHandler(getCreatorDashboard),
);
