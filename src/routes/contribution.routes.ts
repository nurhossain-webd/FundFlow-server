import { Router } from "express";

import {
  approvePendingContribution,
  createSupporterContribution,
  getCreatorContribution,
  getCreatorStatistics,
  getSupporterStatistics,
  listCreatorPendingContributions,
  listSupporterApprovedContributions,
  listSupporterContributions,
  rejectPendingContribution,
} from "../controllers/contribution.controller.js";
import {
  requireCreator,
  requireSupporter,
} from "../middlewares/authorize.middleware.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const contributionRouter = Router();

contributionRouter.use(...requireAuth);

contributionRouter.post(
  "/",
  requireSupporter,
  asyncHandler(createSupporterContribution),
);
contributionRouter.get(
  "/mine",
  requireSupporter,
  asyncHandler(listSupporterContributions),
);
contributionRouter.get(
  "/supporter/approved",
  requireSupporter,
  asyncHandler(listSupporterApprovedContributions),
);
contributionRouter.get(
  "/supporter/statistics",
  requireSupporter,
  asyncHandler(getSupporterStatistics),
);

contributionRouter.get(
  "/creator/pending",
  requireCreator,
  asyncHandler(listCreatorPendingContributions),
);
contributionRouter.get(
  "/creator/statistics",
  requireCreator,
  asyncHandler(getCreatorStatistics),
);
contributionRouter.get(
  "/creator/:contributionId",
  requireCreator,
  asyncHandler(getCreatorContribution),
);
contributionRouter.patch(
  "/creator/:contributionId/approve",
  requireCreator,
  asyncHandler(approvePendingContribution),
);
contributionRouter.patch(
  "/creator/:contributionId/reject",
  requireCreator,
  asyncHandler(rejectPendingContribution),
);
