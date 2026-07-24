import type { Request, Response } from "express";

import {
  getPublicCreditPackages,
  createCreditCheckoutSession,
  getCreditCheckoutStatus,
  getSupporterPaymentHistory,
} from "../services/credit-payment.service.js";
import {
  checkoutSessionParamsSchema,
  createCheckoutSessionSchema,
  paymentHistoryQuerySchema,
} from "../schemas/credit-payment.schema.js";
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

export const listPaymentHistory = async (
  request: Request,
  response: Response,
): Promise<void> => {
  if (!request.user) {
    throw new AppError(401, "Authentication required");
  }

  const query = paymentHistoryQuerySchema.parse(request.query);
  const history = await getSupporterPaymentHistory(request.user, query);

  response.status(200).json({
    success: true,
    data: history,
  });
};

export const getCheckoutStatus = async (
  request: Request,
  response: Response,
): Promise<void> => {
  if (!request.user) {
    throw new AppError(401, "Authentication required");
  }

  const { checkoutSessionId } = checkoutSessionParamsSchema.parse(
    request.params,
  );
  const payment = await getCreditCheckoutStatus(
    request.user,
    checkoutSessionId,
  );

  response.status(200).json({
    success: true,
    data: { payment },
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
