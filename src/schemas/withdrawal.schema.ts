import { z } from "zod";

import {
  WITHDRAWAL_PAYMENT_SYSTEMS,
  WITHDRAWAL_STATUSES,
} from "../models/withdrawal.model.js";

const objectIdPattern = /^[a-f\d]{24}$/i;

const optionalIntegerQuery = (defaultValue: number, maximum: number) =>
  z.preprocess(
    (value) => (value === undefined ? defaultValue : value),
    z.coerce.number().int().min(1).max(maximum),
  );

export const createWithdrawalSchema = z
  .object({
    credits: z.number().int().min(200).safe(),
    paymentSystem: z.enum(WITHDRAWAL_PAYMENT_SYSTEMS),
    accountNumber: z
      .string()
      .trim()
      .min(4)
      .max(120)
      .regex(
        /^[A-Za-z0-9@._+\-\s]+$/,
        "Account number contains unsupported characters",
      ),
  })
  .strict();

export const withdrawalIdempotencyKeySchema = z
  .string()
  .trim()
  .min(16, "Idempotency-Key must contain at least 16 characters")
  .max(100, "Idempotency-Key cannot exceed 100 characters")
  .regex(
    /^[A-Za-z0-9._:-]+$/,
    "Idempotency-Key contains unsupported characters",
  );

export const withdrawalListQuerySchema = z
  .object({
    page: optionalIntegerQuery(1, 10_000),
    limit: optionalIntegerQuery(10, 50),
    status: z.enum(WITHDRAWAL_STATUSES).optional(),
  })
  .strict();

export const withdrawalIdParamsSchema = z
  .object({
    withdrawalId: z
      .string()
      .regex(objectIdPattern, "Withdrawal ID must be a valid MongoDB ObjectId"),
  })
  .strict();

export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>;
export type WithdrawalListQuery = z.infer<typeof withdrawalListQuerySchema>;
