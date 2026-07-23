import { Router } from "express";

import {
  getPublicPlatformStatistics,
  getPublicTopCampaigns,
} from "../controllers/public-platform.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

export const publicPlatformRouter = Router();

publicPlatformRouter.get(
  "/campaigns/top-funded",
  asyncHandler(getPublicTopCampaigns),
);
publicPlatformRouter.get(
  "/statistics",
  asyncHandler(getPublicPlatformStatistics),
);
