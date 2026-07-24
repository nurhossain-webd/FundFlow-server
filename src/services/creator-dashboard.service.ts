import mongoose from "mongoose";

import { CampaignModel } from "../models/campaign.model.js";
import {
  CONTRIBUTION_STATUSES,
  ContributionModel,
  type ContributionStatus,
} from "../models/contribution.model.js";
import { UserProfileModel } from "../models/user-profile.model.js";
import { AppError } from "../utils/app-error.js";

const CREDITS_PER_DOLLAR = 20;
const CENTS_PER_DOLLAR = 100;

interface CampaignAnalytics {
  statistics: Array<{
    totalCampaigns: number;
    activeCampaigns: number;
    totalAmountRaised: number;
  }>;
  raisedByCampaign: Array<{
    campaignId: mongoose.Types.ObjectId;
    title: string;
    amountRaised: number;
    status: string;
  }>;
}

interface ContributionAnalytics {
  statusDistribution: Array<{
    status: ContributionStatus;
    count: number;
    totalCredits: number;
  }>;
  latestPendingContributions: Array<{
    contributionId: mongoose.Types.ObjectId;
    supporterName: string;
    campaignTitle: string;
    amount: number;
    createdAt: Date;
  }>;
}

export const getCreatorDashboardStatistics = async (
  creatorProfileId: string,
) => {
  const creatorId = new mongoose.Types.ObjectId(creatorProfileId);
  const now = new Date();

  const [profile, campaignAnalytics, contributionAnalytics] = await Promise.all(
    [
      UserProfileModel.findOne({
        _id: creatorId,
        role: "creator",
      })
        .select({ raisedCredits: 1 })
        .lean()
        .exec(),
      CampaignModel.aggregate<CampaignAnalytics>([
        { $match: { creatorId } },
        {
          $facet: {
            statistics: [
              {
                $group: {
                  _id: null,
                  totalCampaigns: { $sum: 1 },
                  activeCampaigns: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            { $eq: ["$status", "approved"] },
                            { $gt: ["$deadline", now] },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                  totalAmountRaised: { $sum: "$amountRaised" },
                },
              },
              { $project: { _id: 0 } },
            ],
            raisedByCampaign: [
              { $sort: { amountRaised: -1, createdAt: -1 } },
              {
                $project: {
                  _id: 0,
                  campaignId: "$_id",
                  title: 1,
                  amountRaised: 1,
                  status: 1,
                },
              },
            ],
          },
        },
      ]).exec(),
      ContributionModel.aggregate<ContributionAnalytics>([
        { $match: { creatorId } },
        {
          $facet: {
            statusDistribution: [
              {
                $group: {
                  _id: "$status",
                  count: { $sum: 1 },
                  totalCredits: { $sum: "$amount" },
                },
              },
              {
                $project: {
                  _id: 0,
                  status: "$_id",
                  count: 1,
                  totalCredits: 1,
                },
              },
            ],
            latestPendingContributions: [
              { $match: { status: "pending" } },
              { $sort: { createdAt: -1, _id: -1 } },
              { $limit: 5 },
              {
                $project: {
                  _id: 0,
                  contributionId: "$_id",
                  supporterName: 1,
                  campaignTitle: 1,
                  amount: 1,
                  createdAt: 1,
                },
              },
            ],
          },
        },
      ]).exec(),
    ],
  );

  if (!profile) {
    throw new AppError(404, "Creator profile not found");
  }

  const estimatedWithdrawalCents =
    profile.raisedCredits * (CENTS_PER_DOLLAR / CREDITS_PER_DOLLAR);

  if (!Number.isSafeInteger(estimatedWithdrawalCents)) {
    throw new AppError(409, "Estimated withdrawal value is invalid");
  }

  const campaignResult = campaignAnalytics[0];
  const contributionResult = contributionAnalytics[0];
  const campaignStatistics = campaignResult?.statistics[0];
  const distributionMap = new Map(
    (contributionResult?.statusDistribution ?? []).map((item) => [
      item.status,
      item,
    ]),
  );

  return {
    statistics: {
      totalCampaigns: campaignStatistics?.totalCampaigns ?? 0,
      activeCampaigns: campaignStatistics?.activeCampaigns ?? 0,
      totalAmountRaised: campaignStatistics?.totalAmountRaised ?? 0,
      currentRaisedCredits: profile.raisedCredits,
      estimatedWithdrawalCents,
      withdrawalRate: {
        creditsPerDollar: CREDITS_PER_DOLLAR,
        centsPerDollar: CENTS_PER_DOLLAR,
      },
    },
    raisedByCampaign: (campaignResult?.raisedByCampaign ?? []).map(
      (campaign) => ({
        ...campaign,
        campaignId: campaign.campaignId.toString(),
      }),
    ),
    contributionStatusDistribution: CONTRIBUTION_STATUSES.map((status) => ({
      status,
      count: distributionMap.get(status)?.count ?? 0,
      totalCredits: distributionMap.get(status)?.totalCredits ?? 0,
    })),
    latestPendingContributions: (
      contributionResult?.latestPendingContributions ?? []
    ).map((contribution) => ({
      ...contribution,
      contributionId: contribution.contributionId.toString(),
    })),
  };
};
