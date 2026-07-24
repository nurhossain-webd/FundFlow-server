import { Router } from "express";

import { handleStripeWebhook } from "../controllers/stripe-webhook.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

export const stripeWebhookRouter = Router();

stripeWebhookRouter.post("/", asyncHandler(handleStripeWebhook));
