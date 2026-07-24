import mongoose from "mongoose";

import {
  CampaignModel,
  type ICampaign,
} from "../models/campaign.model.js";
import { ContributionModel } from "../models/contribution.model.js";
import { NotificationModel } from "../models/notification.model.js";
import { UserProfileModel } from "../models/user-profile.model.js";
import type {
  CampaignListQuery,
  CreateCampaignInput,
  UpdateCampaignInput,
} from "../schemas/campaign.schema.js";
import type { RequestUser } from "../types/auth-user.js";
import { AppError } from "../utils/app-error.js";
import {
  assertActiveTransaction,
  withMongoTransaction,
} from "../utils/mongo-transaction.js";

const escapeRegularExpression = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const createSearchFilter = (
  search?: string,
): mongoose.QueryFilter<ICampaign> | undefined => {
  if (!search) {
    return undefined;
  }

  const expression = new RegExp(escapeRegularExpression(search), "i");

  return {
    $or: [
      { title: expression },
      { creatorName: expression },
    ],
  };
};

const createCategoryFilter = (
  category?: string,
): mongoose.QueryFilter<ICampaign> | undefined => {
  if (!category) {
    return undefined;
  }

  return {
    category: new RegExp(`^${escapeRegularExpression(category)}$`, "i"),
  };
};

const createRangeFilter = (
  query: CampaignListQuery,
): mongoose.QueryFilter<ICampaign> | undefined => {
  const rangeFilter: mongoose.QueryFilter<ICampaign> = {};

  if (query.deadlineBefore) {
    rangeFilter.deadline = { $lte: query.deadlineBefore };
  }

  if (
    query.fundingGoalMin !== undefined ||
    query.fundingGoalMax !== undefined
  ) {
    rangeFilter.fundingGoal = {
      ...(query.fundingGoalMin !== undefined
        ? { $gte: query.fundingGoalMin }
        : {}),
      ...(query.fundingGoalMax !== undefined
        ? { $lte: query.fundingGoalMax }
        : {}),
    };
  }

  return Object.keys(rangeFilter).length > 0 ? rangeFilter : undefined;
};

const getPaginatedCampaigns = async (
  baseFilter: mongoose.QueryFilter<ICampaign>,
  query: CampaignListQuery,
) => {
  const searchFilter = createSearchFilter(query.search);
  const categoryFilter = createCategoryFilter(query.category);
  const rangeFilter = createRangeFilter(query);
  const filter: mongoose.QueryFilter<ICampaign> = {
    $and: [
      baseFilter,
      ...(searchFilter ? [searchFilter] : []),
      ...(categoryFilter ? [categoryFilter] : []),
      ...(rangeFilter ? [rangeFilter] : []),
    ],
  };
  const skip = (query.page - 1) * query.limit;
  const direction = query.sortOrder === "asc" ? 1 : -1;
  const [campaigns, total] = await Promise.all([
    query.sortBy === "progress"
      ? CampaignModel.aggregate<ICampaign>([
          { $match: filter },
          {
            $addFields: {
              fundingProgress: {
                $divide: ["$amountRaised", "$fundingGoal"],
              },
            },
          },
          { $sort: { fundingProgress: direction, _id: -1 } },
          { $skip: skip },
          { $limit: query.limit },
          { $unset: "fundingProgress" },
        ]).exec()
      : CampaignModel.find(filter)
          .sort({ [query.sortBy]: direction, _id: -1 })
          .skip(skip)
          .limit(query.limit)
          .lean()
          .exec(),
    CampaignModel.countDocuments(filter).exec(),
  ]);

  return {
    campaigns,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const createCampaign = async (
  creator: RequestUser,
  input: CreateCampaignInput,
) => {
  const campaign = await CampaignModel.create({
    ...input,
    creatorId: new mongoose.Types.ObjectId(creator.profileId),
    creatorName: creator.displayName,
    creatorEmail: creator.email,
    amountRaised: 0,
    status: "pending",
  });

  return campaign.toObject();
};

export const getCreatorCampaigns = (
  creatorProfileId: string,
  query: CampaignListQuery,
) =>
  getPaginatedCampaigns(
    {
      creatorId: new mongoose.Types.ObjectId(creatorProfileId),
      ...(query.status ? { status: query.status } : {}),
    },
    query,
  );

export const getCreatorCampaignById = async (
  campaignId: string,
  creatorProfileId: string,
) => {
  const campaign = await CampaignModel.findOne({
    _id: campaignId,
    creatorId: creatorProfileId,
  })
    .lean()
    .exec();

  if (!campaign) {
    throw new AppError(404, "Campaign not found");
  }

  return campaign;
};

export const getApprovedActiveCampaigns = (
  query: CampaignListQuery,
) =>
  getPaginatedCampaigns(
    {
      status: "approved",
      deadline: { $gt: new Date() },
    },
    query,
  );

export const getApprovedActiveCampaignById = async (
  campaignId: string,
) => {
  const campaign = await CampaignModel.findOne({
    _id: campaignId,
    status: "approved",
    deadline: { $gt: new Date() },
  })
    .lean()
    .exec();

  if (!campaign) {
    throw new AppError(404, "Campaign not found");
  }

  return campaign;
};

export const getTopFundedActiveCampaigns = async () =>
  CampaignModel.find({
    status: "approved",
    deadline: { $gt: new Date() },
  })
    .sort({ amountRaised: -1, createdAt: -1 })
    .limit(6)
    .lean()
    .exec();

export const updateCreatorCampaign = async (
  campaignId: string,
  creatorProfileId: string,
  input: UpdateCampaignInput,
) => {
  const campaign = await CampaignModel.findOneAndUpdate(
    {
      _id: campaignId,
      creatorId: creatorProfileId,
    },
    { $set: input },
    { new: true, runValidators: true },
  )
    .lean()
    .exec();

  if (!campaign) {
    throw new AppError(404, "Campaign not found");
  }

  return campaign;
};

export const getPendingCampaigns = (
  query: CampaignListQuery,
) =>
  getPaginatedCampaigns(
    {
      status: "pending",
    },
    query,
  );

const reviewCampaign = async (
  campaignId: string,
  status: "approved" | "rejected",
  reason?: string,
) =>
  withMongoTransaction(async (session) => {
    assertActiveTransaction(session);

    const campaign = await CampaignModel.findOne({
      _id: campaignId,
      status: "pending",
    })
      .session(session)
      .exec();

    if (!campaign) {
      throw new AppError(409, "Only pending campaigns can be reviewed");
    }

    if (status === "approved" && campaign.deadline.getTime() <= Date.now()) {
      throw new AppError(409, "An expired campaign cannot be approved");
    }

    const creator = await UserProfileModel.findById(campaign.creatorId)
      .session(session)
      .lean()
      .exec();

    if (!creator) {
      throw new AppError(409, "Campaign creator profile no longer exists");
    }

    campaign.status = status;
    await campaign.save({ session });

    await NotificationModel.create(
      [
        {
          recipientId: creator._id,
          recipientAuthUserId: creator.authUserId,
          type:
            status === "approved"
              ? "campaign_approved"
              : "campaign_rejected",
          title:
            status === "approved"
              ? "Campaign approved"
              : "Campaign needs revision",
          message:
            status === "approved"
              ? `${campaign.title} is now live and can receive support.`
              : `${campaign.title} was rejected. ${reason ?? ""}`.trim(),
          relatedEntityType: "campaign",
          relatedEntityId: campaign._id,
          actionPath: `/dashboard/creator/campaigns/${campaign._id.toString()}`,
          isRead: false,
        },
      ],
      { session },
    );

    return campaign.toObject();
  });

export const approveCampaign = (campaignId: string) =>
  reviewCampaign(campaignId, "approved");

export const rejectCampaign = (campaignId: string, reason: string) =>
  reviewCampaign(campaignId, "rejected", reason);

interface DeleteCampaignOptions {
  campaignId: string;
  actor: RequestUser;
  reason?: string;
}

export const deleteCampaignWithRefunds = async ({
  actor,
  campaignId,
  reason,
}: DeleteCampaignOptions) =>
  withMongoTransaction(async (session) => {
    assertActiveTransaction(session);

    const campaign = await CampaignModel.findById(campaignId)
      .session(session)
      .exec();

    if (!campaign) {
      throw new AppError(404, "Campaign not found");
    }

    if (
      actor.role === "creator" &&
      campaign.creatorId.toString() !== actor.profileId
    ) {
      throw new AppError(403, "You can delete only your own campaigns");
    }

    const contributions = await ContributionModel.find({
      campaignId: campaign._id,
      status: { $in: ["pending", "approved"] },
    })
      .session(session)
      .lean()
      .exec();

    const supporterRefunds = new Map<
      string,
      {
        supporterId: mongoose.Types.ObjectId;
        supporterAuthUserId: string;
        amount: number;
      }
    >();
    let approvedRefundTotal = 0;
    let totalRefundedCredits = 0;

    for (const contribution of contributions) {
      const supporterKey = contribution.supporterId.toString();
      const existingRefund = supporterRefunds.get(supporterKey);
      const supporterRefundAmount =
        (existingRefund?.amount ?? 0) + contribution.amount;
      const nextRefundTotal = totalRefundedCredits + contribution.amount;

      if (
        !Number.isSafeInteger(supporterRefundAmount) ||
        !Number.isSafeInteger(nextRefundTotal)
      ) {
        throw new AppError(409, "Campaign refund total is invalid");
      }

      supporterRefunds.set(supporterKey, {
        supporterId: contribution.supporterId,
        supporterAuthUserId: contribution.supporterAuthUserId,
        amount: supporterRefundAmount,
      });
      totalRefundedCredits = nextRefundTotal;

      if (contribution.status === "approved") {
        approvedRefundTotal += contribution.amount;

        if (!Number.isSafeInteger(approvedRefundTotal)) {
          throw new AppError(409, "Approved campaign refund total is invalid");
        }
      }
    }

    if (approvedRefundTotal > 0) {
      const creatorResult = await UserProfileModel.updateOne(
        {
          _id: campaign.creatorId,
          raisedCredits: { $gte: approvedRefundTotal },
        },
        {
          $inc: { raisedCredits: -approvedRefundTotal },
        },
        { session },
      );

      if (creatorResult.modifiedCount !== 1) {
        throw new AppError(
          409,
          "Campaign cannot be deleted because approved credits are no longer fully refundable",
        );
      }
    }

    if (supporterRefunds.size > 0) {
      const supporterUpdateResult = await UserProfileModel.bulkWrite(
        Array.from(supporterRefunds.values()).map((refund) => ({
          updateOne: {
            filter: { _id: refund.supporterId, role: "supporter" },
            update: { $inc: { credits: refund.amount } },
          },
        })),
        { session },
      );

      if (supporterUpdateResult.matchedCount !== supporterRefunds.size) {
        throw new AppError(
          409,
          "One or more supporter profiles could not receive a refund",
        );
      }

      await NotificationModel.insertMany(
        Array.from(supporterRefunds.values()).map((refund) => ({
          recipientId: refund.supporterId,
          recipientAuthUserId: refund.supporterAuthUserId,
          type: "contribution_refunded",
          title: "Campaign contribution refunded",
          message: `${refund.amount.toLocaleString()} credits were returned because ${campaign.title} was deleted.`,
          isRead: false,
        })),
        { session },
      );

      await ContributionModel.updateMany(
        {
          campaignId: campaign._id,
          status: { $in: ["pending", "approved"] },
        },
        {
          $set: {
            status: "refunded",
            refundedAt: new Date(),
            refundReason:
              reason ?? "Campaign deleted and contribution refunded",
          },
        },
        { session },
      );
    }

    await CampaignModel.deleteOne({ _id: campaign._id }, { session });

    return {
      campaignId: campaign._id.toString(),
      refundedContributions: contributions.length,
      refundedSupporters: supporterRefunds.size,
      refundedCredits: totalRefundedCredits,
    };
  });
