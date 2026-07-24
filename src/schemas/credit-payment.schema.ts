import { z } from "zod";

import { CREDIT_PACKAGES } from "../config/credit-packages.js";

const creditPackageIds = Object.keys(CREDIT_PACKAGES) as [
  keyof typeof CREDIT_PACKAGES,
  ...(keyof typeof CREDIT_PACKAGES)[],
];

export const createCheckoutSessionSchema = z
  .object({
    packageId: z.enum(creditPackageIds),
  })
  .strict();

export const checkoutSessionParamsSchema = z.object({
  checkoutSessionId: z
    .string()
    .trim()
    .regex(/^cs_(?:test|live)_[A-Za-z0-9]+$/, "Invalid Checkout Session ID"),
});

const optionalIntegerQuery = (defaultValue: number, maximum: number) =>
  z.preprocess(
    (value) => (value === undefined ? defaultValue : value),
    z.coerce.number().int().min(1).max(maximum),
  );

export const paymentHistoryQuerySchema = z
  .object({
    page: optionalIntegerQuery(1, 10_000),
    limit: optionalIntegerQuery(10, 50),
  })
  .strict();

export type PaymentHistoryQuery = z.infer<typeof paymentHistoryQuerySchema>;
