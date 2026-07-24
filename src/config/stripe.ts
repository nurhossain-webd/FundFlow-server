import Stripe from "stripe";

import { AppError } from "../utils/app-error.js";
import { env } from "./env.js";

let stripeClient: Stripe | undefined;

export const getStripeClient = (): Stripe => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(503, "Stripe payments are not configured");
  }

  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY);
  return stripeClient;
};

export const getStripeWebhookSecret = (): string => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError(503, "Stripe webhook verification is not configured");
  }

  return env.STRIPE_WEBHOOK_SECRET;
};
