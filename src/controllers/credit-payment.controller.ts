import type { Request, Response } from "express";

import {
  getPublicCreditPackages,
  createCreditCheckoutSession,
} from "../services/credit-payment.service.js";
import { createCheckoutSessionSchema } from "../schemas/credit-payment.schema.js";
import { AppError } from "../utils/app-error.js";

export const listCreditPackages = (
  _request: Request,
  response: Response,
): void => {
  response.status(200).json({
    success: true,
    data: {
      packages: getPublicCreditPackages(),
    },
  });
};

export const createCheckoutSession = async (
  request: Request,
  response: Response,
): Promise<void> => {
  if (!request.user) {
    throw new AppError(401, "Authentication required");
  }

  const { packageId } = createCheckoutSessionSchema.parse(request.body);
  const checkout = await createCreditCheckoutSession(
    request.user,
    packageId,
  );

  response.status(201).json({
    success: true,
    message: "Stripe Checkout Session created",
    data: checkout,
  });
};
