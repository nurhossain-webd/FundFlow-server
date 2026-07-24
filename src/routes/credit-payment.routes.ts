import { Router } from "express";

import {
  createCheckoutSession,
  getCheckoutStatus,
  listPaymentHistory,
  listCreditPackages,
} from "../controllers/credit-payment.controller.js";
import { requireSupporter } from "../middlewares/authorize.middleware.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const creditPaymentRouter = Router();

creditPaymentRouter.get("/packages", listCreditPackages);
creditPaymentRouter.get(
  "/history",
  ...requireAuth,
  requireSupporter,
  asyncHandler(listPaymentHistory),
);
creditPaymentRouter.post(
  "/checkout-session",
  ...requireAuth,
  requireSupporter,
  asyncHandler(createCheckoutSession),
);
creditPaymentRouter.get(
  "/checkout-session/:checkoutSessionId",
  ...requireAuth,
  requireSupporter,
  asyncHandler(getCheckoutStatus),
);
