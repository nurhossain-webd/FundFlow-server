import mongoose from "mongoose";

import { CampaignModel } from "../models/campaign.model.js";
import {
  ContributionModel,
  type IContribution,
} from "../models/contribution.model.js";
import { UserProfileModel } from "../models/user-profile.model.js";
import type {
  ContributionListQuery,
  CreateContributionInput,
} from "../schemas/contribution.schema.js";
import type { RequestUser } from "../types/auth-user.js";
import { AppError } from "../utils/app-error.js";
import {
  assertActiveTransaction,
  withMongoTransaction,
} from "../utils/mongo-transaction.js";
import { assertTrustedActor } from "../utils/trusted-actor.js";
import { createNotification } from "./notification.service.js";

const getPagination = (query: ContributionListQuery, total: number) => ({
  page: query.page,
  limit: query.limit,
  total,
  totalPages: Math.ceil(total / query.limit),
});

const contributionResponseProjection = {
  campaignId: 1,
  campaignTitle: 1,
  supporterName: 1,
  supporterEmail: 1,
  creatorName: 1,
  creatorEmail: 1,
  amount: 1,
  message: 1,
  status: 1,
  reviewedAt: 1,
  rejectionReason: 1,
  refundedAt: 1,
  refundReason: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

const getPaginatedContributions = async (
  filter: mongoose.QueryFilter<IContribution>,
  query: ContributionListQuery,
) => {
  const skip = (query.page - 1) * query.limit;
  const [contributions, total] = await Promise.all([
    ContributionModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit)
      .select(contributionResponseProjection)
      .lean()
      .exec(),
    ContributionModel.countDocuments(filter).exec(),
  ]);

  return {
    contributions,
    pagination: getPagination(query, total),
  };
};

const assertMatchingIdempotentContribution = (
  contribution: IContribution,
  input: CreateContributionInput,
) => {
  if (
    contribution.campaignId.toString() !== input.campaignId ||
    contribution.amount !== input.amount ||
    (contribution.message ?? undefined) !== input.message
  ) {
    throw new AppError(
      409,
      "Idempotency-Key has already been used for another contribution",
    );
  }
};

const isDuplicateKeyError = (error: unknown): error is { code: number } =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11_000;

export const createContribution = async (
  supporter: RequestUser,
  input: CreateContributionInput,
  idempotencyKey: string,
) => {
  assertTrustedActor(supporter, "supporter");

  try {
    return await withMongoTransaction(async (session) => {
      assertActiveTransaction(session);

      const existingContribution = await ContributionModel.findOne({
        supporterId: supporter.profileId,
        idempotencyKey,
      })
        .session(session)
        .lean()
        .exec();

      if (existingContribution) {
        assertMatchingIdempotentContribution(existingContribution, input);
        return { contribution: existingContribution, created: false };
      }

      const campaign = await CampaignModel.findOne({
        _id: input.campaignId,
        status: "approved",
        deadline: { $gt: new Date() },
      })
        .session(session)
        .lean()
        .exec();

      if (!campaign) {
        throw new AppError(
          404,
          "Campaign is unavailable, unapproved, or expired",
        );
      }

      if (input.amount < campaign.minimumContribution) {
        throw new AppError(
          400,
          `Contribution must be at least ${campaign.minimumContribution} credits`,
        );
      }

      const updatedSupporter = await UserProfileModel.findOneAndUpdate(
        {
          _id: supporter.profileId,
          role: "supporter",
          isSuspended: false,
          credits: { $gte: input.amount },
        },
        { $inc: { credits: -input.amount } },
        { new: true, session },
      )
        .lean()
        .exec();

      if (!updatedSupporter) {
        throw new AppError(409, "Insufficient supporter credits");
      }

      const creator = await UserProfileModel.findOne({
        _id: campaign.creatorId,
        role: "creator",
      })
        .session(session)
        .lean()
        .exec();

      if (!creator) {
        throw new AppError(409, "Campaign creator profile is unavailable");
      }

      const [contribution] = await ContributionModel.create(
        [
          {
            campaignId: campaign._id,
            campaignTitle: campaign.title,
            supporterId: updatedSupporter._id,
            supporterAuthUserId: supporter.authUserId,
            supporterName: supporter.displayName,
            supporterEmail: supporter.email,
            creatorId: creator._id,
            creatorName: creator.displayName,
            creatorEmail: creator.email,
            amount: input.amount,
            ...(input.message ? { message: input.message } : {}),
            status: "pending",
            idempotencyKey,
          },
        ],
        { session },
      );

      if (!contribution) {
        throw new AppError(500, "Contribution could not be created");
      }

      await createNotification(
        {
          recipientId: creator._id,
          recipientAuthUserId: creator.authUserId,
          toEmail: creator.email,
          type: "contribution_received",
          title: "New contribution awaiting review",
          message: `${supporter.displayName} contributed ${input.amount.toLocaleString()} credits to ${campaign.title}.`,
          relatedEntityType: "contribution",
          relatedEntityId: contribution._id,
          actionRoute: "/dashboard/creator/contributions",
        },
        session,
      );

      return { contribution: contribution.toObject(), created: true };
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const existingContribution = await ContributionModel.findOne({
      supporterId: supporter.profileId,
      idempotencyKey,
    })
      .lean()
      .exec();

    if (!existingContribution) {
      throw new AppError(409, "Duplicate contribution request");
    }

    assertMatchingIdempotentContribution(existingContribution, input);
    return { contribution: existingContribution, created: false };
  }
};

export const getSupporterContributions = (
  supporterProfileId: string,
  query: ContributionListQuery,
) =>
  getPaginatedContributions(
    {
      supporterId: new mongoose.Types.ObjectId(supporterProfileId),
      ...(query.status ? { status: query.status } : {}),
    },
    query,
  );

export const getSupporterApprovedContributions = (
  supporterProfileId: string,
  query: ContributionListQuery,
) =>
  getPaginatedContributions(
    {
      supporterId: new mongoose.Types.ObjectId(supporterProfileId),
      status: "approved",
    },
    query,
  );

export const getCreatorPendingContributions = (
  creatorProfileId: string,
  query: ContributionListQuery,
) =>
  getPaginatedContributions(
    {
      creatorId: new mongoose.Types.ObjectId(creatorProfileId),
      status: "pending",
    },
    query,
  );

export const getCreatorContributionById = async (
  contributionId: string,
  creatorProfileId: string,
) => {
  const contribution = await ContributionModel.findOne({
    _id: contributionId,
    creatorId: creatorProfileId,
  })
    .select(contributionResponseProjection)
    .lean()
    .exec();

  if (!contribution) {
    throw new AppError(404, "Contribution not found");
  }

  return contribution;
};

const getContributionStatistics = async (
  filter: mongoose.QueryFilter<IContribution>,
) => {
  const [statistics] = await ContributionModel.aggregate<{
    totalContributions: number;
    totalCredits: number;
    pendingCount: number;
    pendingCredits: number;
    approvedCount: number;
    approvedCredits: number;
    rejectedCount: number;
    rejectedCredits: number;
    refundedCount: number;
    refundedCredits: number;
  }>([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalContributions: { $sum: 1 },
        totalCredits: { $sum: "$amount" },
        pendingCount: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
        },
        pendingCredits: {
          $sum: {
            $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0],
          },
        },
        approvedCount: {
          $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
        },
        approvedCredits: {
          $sum: {
            $cond: [{ $eq: ["$status", "approved"] }, "$amount", 0],
          },
        },
        rejectedCount: {
          $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
        },
        rejectedCredits: {
          $sum: {
            $cond: [{ $eq: ["$status", "rejected"] }, "$amount", 0],
          },
        },
        refundedCount: {
          $sum: { $cond: [{ $eq: ["$status", "refunded"] }, 1, 0] },
        },
        refundedCredits: {
          $sum: {
            $cond: [{ $eq: ["$status", "refunded"] }, "$amount", 0],
          },
        },
      },
    },
    { $project: { _id: 0 } },
  ]).exec();

  return (
    statistics ?? {
      totalContributions: 0,
      totalCredits: 0,
      pendingCount: 0,
      pendingCredits: 0,
      approvedCount: 0,
      approvedCredits: 0,
      rejectedCount: 0,
      rejectedCredits: 0,
      refundedCount: 0,
      refundedCredits: 0,
    }
  );
};

export const getSupporterContributionStatistics = (
  supporterProfileId: string,
) =>
  getContributionStatistics({
    supporterId: new mongoose.Types.ObjectId(supporterProfileId),
  });

export const getCreatorContributionStatistics = (creatorProfileId: string) =>
  getContributionStatistics({
    creatorId: new mongoose.Types.ObjectId(creatorProfileId),
  });

export const approveContribution = async (
  contributionId: string,
  creator: RequestUser,
) => {
  assertTrustedActor(creator, "creator");
  return withMongoTransaction(async (session) => {
    assertActiveTransaction(session);

    const contribution = await ContributionModel.findOneAndUpdate(
      {
        _id: contributionId,
        creatorId: creator.profileId,
        status: "pending",
      },
      {
        $set: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedByAuthUserId: creator.authUserId,
        },
      },
      { new: true, session },
    ).exec();

    if (!contribution) {
      const exists = await ContributionModel.exists({
        _id: contributionId,
        creatorId: creator.profileId,
      }).session(session);

      throw new AppError(
        exists ? 409 : 404,
        exists
          ? "Only pending contributions can be approved"
          : "Contribution not found",
      );
    }

    const maximumCurrentValue = Number.MAX_SAFE_INTEGER - contribution.amount;
    const campaignUpdate = await CampaignModel.updateOne(
      {
        _id: contribution.campaignId,
        creatorId: creator.profileId,
        amountRaised: { $lte: maximumCurrentValue },
      },
      { $inc: { amountRaised: contribution.amount } },
      { session },
    );

    if (campaignUpdate.modifiedCount !== 1) {
      throw new AppError(409, "Campaign raised amount could not be updated");
    }

    const creatorUpdate = await UserProfileModel.updateOne(
      {
        _id: creator.profileId,
        role: "creator",
        raisedCredits: { $lte: maximumCurrentValue },
      },
      { $inc: { raisedCredits: contribution.amount } },
      { session },
    );

    if (creatorUpdate.modifiedCount !== 1) {
      throw new AppError(409, "Creator raised credits could not be updated");
    }

    await createNotification(
      {
        recipientId: contribution.supporterId,
        recipientAuthUserId: contribution.supporterAuthUserId,
        toEmail: contribution.supporterEmail,
        type: "contribution_approved",
        title: "Contribution approved",
        message: `Your ${contribution.amount.toLocaleString()} credit contribution to ${contribution.campaignTitle} was approved.`,
        relatedEntityType: "contribution",
        relatedEntityId: contribution._id,
        actionRoute: "/dashboard/supporter/contributions",
      },
      session,
    );

    return contribution.toObject();
  });
};

export const rejectContribution = async (
  contributionId: string,
  creator: RequestUser,
  reason: string,
) => {
  assertTrustedActor(creator, "creator");
  return withMongoTransaction(async (session) => {
    assertActiveTransaction(session);

    const contribution = await ContributionModel.findOneAndUpdate(
      {
        _id: contributionId,
        creatorId: creator.profileId,
        status: "pending",
      },
      {
        $set: {
          status: "rejected",
          reviewedAt: new Date(),
          reviewedByAuthUserId: creator.authUserId,
          rejectionReason: reason,
          refundedAt: new Date(),
          refundReason: reason,
        },
      },
      { new: true, session },
    ).exec();

    if (!contribution) {
      const exists = await ContributionModel.exists({
        _id: contributionId,
        creatorId: creator.profileId,
      }).session(session);

      throw new AppError(
        exists ? 409 : 404,
        exists
          ? "Only pending contributions can be rejected"
          : "Contribution not found",
      );
    }

    const maximumCurrentValue = Number.MAX_SAFE_INTEGER - contribution.amount;
    const supporterUpdate = await UserProfileModel.updateOne(
      {
        _id: contribution.supporterId,
        role: "supporter",
        credits: { $lte: maximumCurrentValue },
      },
      { $inc: { credits: contribution.amount } },
      { session },
    );

    if (supporterUpdate.modifiedCount !== 1) {
      throw new AppError(409, "Supporter credits could not be refunded");
    }

    await createNotification(
      {
        recipientId: contribution.supporterId,
        recipientAuthUserId: contribution.supporterAuthUserId,
        toEmail: contribution.supporterEmail,
        type: "contribution_rejected",
        title: "Contribution rejected and refunded",
        message: `Your ${contribution.amount.toLocaleString()} credit contribution to ${contribution.campaignTitle} was rejected and refunded.`,
        relatedEntityType: "contribution",
        relatedEntityId: contribution._id,
        actionRoute: "/dashboard/supporter/contributions",
      },
      session,
    );

    return contribution.toObject();
  });
};
