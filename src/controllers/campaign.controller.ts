import type { Request, Response } from "express";

import {
  campaignIdParamsSchema,
  campaignUpdateSchema,
  campaignListQuerySchema,
  createCampaignSchema,
  deleteCampaignSchema,
  rejectCampaignSchema,
  updateCampaignSchema,
} from "../schemas/campaign.schema.js";
import {
  approveCampaign,
  createCampaign,
  deleteCampaignWithRefunds,
  getApprovedActiveCampaignById,
  getApprovedActiveCampaigns,
  getAdminCampaigns,
  getCreatorCampaignById,
  getCreatorCampaigns,
  getPendingCampaigns,
  getTopFundedActiveCampaigns,
  postCreatorCampaignUpdate,
  rejectCampaign,
  updateCreatorCampaign,
} from "../services/campaign.service.js";
import { AppError } from "../utils/app-error.js";

const getRequestUser = (request: Request) => {
  if (!request.user) {
    throw new AppError(401, "Authentication required");
  }

  return request.user;
};

export const createCreatorCampaign = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const creator = getRequestUser(request);
  const input = createCampaignSchema.parse(request.body);
  const campaign = await createCampaign(creator, input);

  response.status(201).json({
    success: true,
    message: "Campaign submitted for review",
    data: { campaign },
  });
};

export const listCreatorCampaigns = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const creator = getRequestUser(request);
  const query = campaignListQuerySchema.parse(request.query);
  const result = await getCreatorCampaigns(creator.profileId, query);

  response.status(200).json({
    success: true,
    data: result,
  });
};

export const getCreatorCampaign = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const creator = getRequestUser(request);
  const { campaignId } = campaignIdParamsSchema.parse(request.params);
  const campaign = await getCreatorCampaignById(campaignId, creator.profileId);

  response.status(200).json({
    success: true,
    data: { campaign },
  });
};

export const updateCampaign = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const creator = getRequestUser(request);
  const { campaignId } = campaignIdParamsSchema.parse(request.params);
  const input = updateCampaignSchema.parse(request.body);
  const campaign = await updateCreatorCampaign(
    campaignId,
    creator.profileId,
    input,
  );

  response.status(200).json({
    success: true,
    message: "Campaign updated",
    data: { campaign },
  });
};

export const createCampaignUpdate = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const creator = getRequestUser(request);
  const { campaignId } = campaignIdParamsSchema.parse(request.params);
  const input = campaignUpdateSchema.parse(request.body);
  const update = await postCreatorCampaignUpdate(
    campaignId,
    creator.profileId,
    input,
  );

  response.status(201).json({
    success: true,
    message: "Campaign update published",
    data: { update },
  });
};

export const deleteCreatorCampaign = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const actor = getRequestUser(request);
  const { campaignId } = campaignIdParamsSchema.parse(request.params);
  const { reason } = deleteCampaignSchema.parse(request.body);
  const result = await deleteCampaignWithRefunds({
    campaignId,
    actor,
    ...(reason ? { reason } : {}),
  });

  response.status(200).json({
    success: true,
    message: "Campaign deleted and refundable contributions returned",
    data: result,
  });
};

export const listApprovedCampaigns = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = campaignListQuerySchema.parse(request.query);
  const result = await getApprovedActiveCampaigns(query);

  response.status(200).json({
    success: true,
    data: result,
  });
};

export const getApprovedCampaign = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const { campaignId } = campaignIdParamsSchema.parse(request.params);
  const campaign = await getApprovedActiveCampaignById(campaignId);

  response.status(200).json({
    success: true,
    data: { campaign },
  });
};

export const listTopFundedCampaigns = async (
  _request: Request,
  response: Response,
): Promise<void> => {
  const campaigns = await getTopFundedActiveCampaigns();

  response.status(200).json({
    success: true,
    data: { campaigns },
  });
};

export const listPendingCampaigns = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = campaignListQuerySchema.parse(request.query);
  const result = await getPendingCampaigns(query);

  response.status(200).json({
    success: true,
    data: result,
  });
};

export const listAdminCampaigns = async (
  request: Request,
  response: Response,
): Promise<void> => {
  getRequestUser(request);
  const query = campaignListQuerySchema.parse(request.query);
  const result = await getAdminCampaigns(query);

  response.status(200).json({
    success: true,
    data: result,
  });
};

export const approvePendingCampaign = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const admin = getRequestUser(request);
  const { campaignId } = campaignIdParamsSchema.parse(request.params);
  const campaign = await approveCampaign(campaignId, admin);

  response.status(200).json({
    success: true,
    message: "Campaign approved",
    data: { campaign },
  });
};

export const rejectPendingCampaign = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const admin = getRequestUser(request);
  const { campaignId } = campaignIdParamsSchema.parse(request.params);
  const { reason } = rejectCampaignSchema.parse(request.body);
  const campaign = await rejectCampaign(campaignId, admin, reason);

  response.status(200).json({
    success: true,
    message: "Campaign rejected",
    data: { campaign },
  });
};

export const deleteAdminCampaign = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const actor = getRequestUser(request);
  const { campaignId } = campaignIdParamsSchema.parse(request.params);
  const { reason } = deleteCampaignSchema.parse(request.body);
  const result = await deleteCampaignWithRefunds({
    campaignId,
    actor,
    reason: reason ?? "Campaign removed by an administrator",
  });

  response.status(200).json({
    success: true,
    message: "Campaign deleted by administrator",
    data: result,
  });
};
