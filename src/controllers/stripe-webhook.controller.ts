import type { Request, Response } from "express";
import type Stripe from "stripe";

import {
  getStripeClient,
  getStripeWebhookSecret,
} from "../config/stripe.js";
import { processStripeWebhookEvent } from "../services/credit-payment.service.js";
import { AppError } from "../utils/app-error.js";

export const handleStripeWebhook = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const signature = request.get("Stripe-Signature");

  if (!signature || !Buffer.isBuffer(request.body)) {
    throw new AppError(400, "Invalid Stripe webhook request");
  }

  let event: Stripe.Event;

  try {
    event = getStripeClient().webhooks.constructEvent(
      request.body,
      signature,
      getStripeWebhookSecret(),
    );
  } catch {
    throw new AppError(400, "Stripe webhook signature verification failed");
  }

  await processStripeWebhookEvent(event);

  response.status(200).json({ received: true });
};
