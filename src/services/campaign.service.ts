import mongoose from "mongoose";

import { CampaignModel, type ICampaign } from "../models/campaign.model.js";
import { ContributionModel } from "../models/contribution.model.js";
import { ReportModel } from "../models/report.model.js";
import { UserProfileModel } from "../models/user-profile.model.js";
import type {
  CampaignListQuery,
  CampaignUpdateInput,
  CreateCampaignInput,
  UpdateCampaignInput,
} from "../schemas/campaign.schema.js";
import type { RequestUser } from "../types/auth-user.js";
import { AppError } from "../utils/app-error.js";
import {
  assertActiveTransaction,
  withMongoTransaction,
} from "../utils/mongo-transaction.js";
import { assertTrustedActor } from "../utils/trusted-actor.js";
import {
  createNotification,
  createNotifications,
} from "./notification.service.js";

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
    $or: [{ title: expression }, { creatorName: expression }],
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
  assertTrustedActor(creator, "creator");
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

export const getApprovedActiveCampaigns = (query: CampaignListQuery) =>
  getPaginatedCampaigns(
    {
      status: "approved",
      deadline: { $gt: new Date() },
    },
    query,
  );

export const getApprovedActiveCampaignById = async (campaignId: string) => {
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
    { returnDocument: "after", runValidators: true },
  )
    .lean()
    .exec();

  if (!campaign) {
    throw new AppError(404, "Campaign not found");
  }

  return campaign;
};

export const postCreatorCampaignUpdate = async (
  campaignId: string,
  creatorProfileId: string,
  input: CampaignUpdateInput,
) => {
  const campaign = await CampaignModel.findOneAndUpdate(
    {
      _id: campaignId,
      creatorId: creatorProfileId,
      status: "approved",
      deadline: { $gt: new Date() },
      "updates.49": { $exists: false },
    },
    {
      $push: {
        updates: {
          title: input.title,
          message: input.message,
          createdAt: new Date(),
        },
      },
    },
    { returnDocument: "after", runValidators: true },
  )
    .lean()
    .exec();

  if (!campaign) {
    throw new AppError(
      409,
      "Only an active approved campaign can receive up to 50 updates",
    );
  }

  return campaign.updates.at(-1);
};

export const getPendingCampaigns = (query: CampaignListQuery) =>
  getPaginatedCampaigns(
    {
      status: "pending",
    },
    query,
  );

export const getAdminCampaigns = (query: CampaignListQuery) =>
  getPaginatedCampaigns({}, query);

const reviewCampaign = async (
  campaignId: string,
  admin: RequestUser,
  status: "approved" | "rejected",
  reason?: string,
) => {
  assertTrustedActor(admin, "admin");
  return withMongoTransaction(async (session) => {
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

    await createNotification(
      {
        recipientId: creator._id,
        recipientAuthUserId: creator.authUserId,
        toEmail: creator.email,
        type: status === "approved" ? "campaign_approved" : "campaign_rejected",
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
        actionRoute: "/dashboard/creator/campaigns",
      },
      session,
    );

    return campaign.toObject();
  });
};

export const approveCampaign = (campaignId: string, admin: RequestUser) =>
  reviewCampaign(campaignId, admin, "approved");

export const rejectCampaign = (
  campaignId: string,
  admin: RequestUser,
  reason?: string,
) => reviewCampaign(campaignId, admin, "rejected", reason);

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
    assertTrustedActor(actor, "creator", "admin");

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
        supporterEmail: string;
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
        supporterEmail: contribution.supporterEmail,
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

      await createNotifications(
        Array.from(supporterRefunds.values()).map((refund) => ({
          recipientId: refund.supporterId,
          recipientAuthUserId: refund.supporterAuthUserId,
          toEmail: refund.supporterEmail,
          type: "contribution_refunded",
          title: "Campaign contribution refunded",
          message: `${refund.amount.toLocaleString()} credits were returned because ${campaign.title} was deleted.`,
          actionRoute: "/dashboard/supporter/contributions",
        })),
        session,
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

    const activeReports = await ReportModel.find({
      targetType: "campaign",
      targetId: campaign._id,
      status: { $in: ["pending", "under_review"] },
    })
      .session(session)
      .lean()
      .exec();

    if (activeReports.length > 0) {
      await ReportModel.updateMany(
        { _id: { $in: activeReports.map((report) => report._id) } },
        {
          $set: {
            status: "resolved",
            reviewedByAuthUserId: actor.authUserId,
            resolvedAt: new Date(),
            resolutionNote:
              reason ?? "Campaign deleted after moderation review",
          },
          $unset: { activeDeduplicationKey: 1 },
        },
        { session },
      );

      const reporters = new Map(
        activeReports.map((report) => [
          report.reporterId.toString(),
          {
            recipientId: report.reporterId,
            recipientAuthUserId: report.reporterAuthUserId,
            toEmail: report.reporterEmail,
          },
        ]),
      );

      await createNotifications(
        Array.from(reporters.values()).map((reporter) => ({
          ...reporter,
          type: "report_resolved",
          title: "Reported campaign removed",
          message: `${campaign.title} was removed after review.`,
          relatedEntityType: "campaign",
          relatedEntityId: campaign._id,
          actionRoute: "/campaigns",
        })),
        session,
      );
    }

    if (actor.role === "admin") {
      const creator = await UserProfileModel.findById(campaign.creatorId)
        .session(session)
        .lean()
        .exec();

      if (creator) {
        await createNotification(
          {
            recipientId: creator._id,
            recipientAuthUserId: creator.authUserId,
            toEmail: creator.email,
            type: "campaign_deleted",
            title: "Campaign removed",
            message:
              `${campaign.title} was removed by an administrator. ${reason ?? ""}`.trim(),
            relatedEntityType: "campaign",
            relatedEntityId: campaign._id,
            actionRoute: "/dashboard/creator/campaigns",
          },
          session,
        );
      }
    }

    await CampaignModel.deleteOne({ _id: campaign._id }, { session });

    return {
      campaignId: campaign._id.toString(),
      refundedContributions: contributions.length,
      refundedSupporters: supporterRefunds.size,
      refundedCredits: totalRefundedCredits,
    };
  });
