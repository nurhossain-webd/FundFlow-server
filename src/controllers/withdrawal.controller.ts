import type { Request, Response } from "express";

import {
  createWithdrawalSchema,
  withdrawalIdempotencyKeySchema,
  withdrawalIdParamsSchema,
  withdrawalListQuerySchema,
} from "../schemas/withdrawal.schema.js";
import {
  approveWithdrawalRequest,
  createWithdrawalRequest,
  getCreatorWithdrawalHistory,
  getCreatorWithdrawalSummary,
  getPendingWithdrawalRequests,
} from "../services/withdrawal.service.js";
import { AppError } from "../utils/app-error.js";

const getRequestUser = (request: Request) => {
  if (!request.user) {
    throw new AppError(401, "Authentication required");
  }

  return request.user;
};

export const getWithdrawalSummary = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const creator = getRequestUser(request);
  const summary = await getCreatorWithdrawalSummary(creator);

  response.status(200).json({
    success: true,
    data: { summary },
  });
};

export const createCreatorWithdrawal = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const creator = getRequestUser(request);
  const input = createWithdrawalSchema.parse(request.body);
  const idempotencyKey = withdrawalIdempotencyKeySchema.parse(
    request.get("Idempotency-Key"),
  );
  const result = await createWithdrawalRequest(creator, input, idempotencyKey);

  response.status(result.created ? 201 : 200).json({
    success: true,
    message: result.created
      ? "Withdrawal request submitted"
      : "Existing withdrawal returned for this request",
    data: result,
  });
};

export const listCreatorWithdrawals = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const creator = getRequestUser(request);
  const query = withdrawalListQuerySchema.parse(request.query);
  const result = await getCreatorWithdrawalHistory(creator, query);

  response.status(200).json({ success: true, data: result });
};

export const listPendingWithdrawals = async (
  request: Request,
  response: Response,
): Promise<void> => {
  getRequestUser(request);
  const query = withdrawalListQuerySchema.parse(request.query);
  const result = await getPendingWithdrawalRequests(query);

  response.status(200).json({ success: true, data: result });
};

export const approvePendingWithdrawal = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const admin = getRequestUser(request);
  const { withdrawalId } = withdrawalIdParamsSchema.parse(request.params);
  const withdrawal = await approveWithdrawalRequest(withdrawalId, admin);

  response.status(200).json({
    success: true,
    message: "Withdrawal request approved",
    data: { withdrawal },
  });
};
