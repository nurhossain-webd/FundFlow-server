import type { Request, Response } from "express";

import {
  contributionIdempotencyKeySchema,
  contributionIdParamsSchema,
  contributionListQuerySchema,
  createContributionSchema,
  rejectContributionSchema,
} from "../schemas/contribution.schema.js";
import {
  approveContribution,
  createContribution,
  getCreatorContributionById,
  getCreatorContributionStatistics,
  getCreatorPendingContributions,
  getSupporterApprovedContributions,
  getSupporterContributions,
  getSupporterContributionStatistics,
  rejectContribution,
} from "../services/contribution.service.js";
import { AppError } from "../utils/app-error.js";

const getRequestUser = (request: Request) => {
  if (!request.user) {
    throw new AppError(401, "Authentication required");
  }

  return request.user;
};

export const createSupporterContribution = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const supporter = getRequestUser(request);
  const input = createContributionSchema.parse(request.body);
  const idempotencyKey = contributionIdempotencyKeySchema.parse(
    request.get("Idempotency-Key"),
  );
  const result = await createContribution(
    supporter,
    input,
    idempotencyKey,
  );

  response.status(result.created ? 201 : 200).json({
    success: true,
    message: result.created
      ? "Contribution submitted for creator review"
      : "Existing contribution returned for this request",
    data: result,
  });
};

export const listSupporterContributions = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const supporter = getRequestUser(request);
  const query = contributionListQuerySchema.parse(request.query);
  const result = await getSupporterContributions(
    supporter.profileId,
    query,
  );

  response.status(200).json({
    success: true,
    data: result,
  });
};

export const listSupporterApprovedContributions = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const supporter = getRequestUser(request);
  const query = contributionListQuerySchema.parse(request.query);
  const result = await getSupporterApprovedContributions(
    supporter.profileId,
    query,
  );

  response.status(200).json({
    success: true,
    data: result,
  });
};

export const getSupporterStatistics = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const supporter = getRequestUser(request);
  const statistics = await getSupporterContributionStatistics(
    supporter.profileId,
  );

  response.status(200).json({
    success: true,
    data: { statistics },
  });
};

export const listCreatorPendingContributions = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const creator = getRequestUser(request);
  const query = contributionListQuerySchema.parse(request.query);
  const result = await getCreatorPendingContributions(
    creator.profileId,
    query,
  );

  response.status(200).json({
    success: true,
    data: result,
  });
};

export const getCreatorContribution = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const creator = getRequestUser(request);
  const { contributionId } = contributionIdParamsSchema.parse(
    request.params,
  );
  const contribution = await getCreatorContributionById(
    contributionId,
    creator.profileId,
  );

  response.status(200).json({
    success: true,
    data: { contribution },
  });
};

export const getCreatorStatistics = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const creator = getRequestUser(request);
  const statistics = await getCreatorContributionStatistics(
    creator.profileId,
  );

  response.status(200).json({
    success: true,
    data: { statistics },
  });
};

export const approvePendingContribution = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const creator = getRequestUser(request);
  const { contributionId } = contributionIdParamsSchema.parse(
    request.params,
  );
  const contribution = await approveContribution(contributionId, creator);

  response.status(200).json({
    success: true,
    message: "Contribution approved",
    data: { contribution },
  });
};

export const rejectPendingContribution = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const creator = getRequestUser(request);
  const { contributionId } = contributionIdParamsSchema.parse(
    request.params,
  );
  const { reason } = rejectContributionSchema.parse(request.body);
  const contribution = await rejectContribution(
    contributionId,
    creator,
    reason,
  );

  response.status(200).json({
    success: true,
    message: "Contribution rejected and supporter credits refunded",
    data: { contribution },
  });
};
