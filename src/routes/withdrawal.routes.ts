import { Router } from "express";

import {
  approvePendingWithdrawal,
  createCreatorWithdrawal,
  listCreatorWithdrawals,
  listPendingWithdrawals,
} from "../controllers/withdrawal.controller.js";
import {
  requireAdmin,
  requireCreator,
} from "../middlewares/authorize.middleware.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const withdrawalRouter = Router();

withdrawalRouter.use(...requireAuth);

withdrawalRouter.post(
  "/",
  requireCreator,
  asyncHandler(createCreatorWithdrawal),
);
withdrawalRouter.get(
  "/mine",
  requireCreator,
  asyncHandler(listCreatorWithdrawals),
);
withdrawalRouter.get(
  "/admin/pending",
  requireAdmin,
  asyncHandler(listPendingWithdrawals),
);
withdrawalRouter.patch(
  "/admin/:withdrawalId/approve",
  requireAdmin,
  asyncHandler(approvePendingWithdrawal),
);
