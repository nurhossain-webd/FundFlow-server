import mongoose from "mongoose";

import {
  CONTRIBUTION_STATUSES,
  ContributionModel,
  type ContributionStatus,
} from "../models/contribution.model.js";
import { UserProfileModel } from "../models/user-profile.model.js";
import { AppError } from "../utils/app-error.js";

interface SupporterContributionAnalytics {
  statistics: Array<{
    totalContributions: number;
    pendingContributions: number;
    totalApprovedAmount: number;
  }>;
  contributionsByCampaign: Array<{
    campaignId: mongoose.Types.ObjectId;
    campaignTitle: string;
    approvedAmount: number;
    contributionCount: number;
  }>;
  statusDistribution: Array<{
    status: ContributionStatus;
    count: number;
    totalCredits: number;
  }>;
  approvedContributions: Array<{
    contributionId: mongoose.Types.ObjectId;
    campaignId: mongoose.Types.ObjectId;
    campaignTitle: string;
    creatorName?: string;
    creatorEmail: string;
    amount: number;
    createdAt: Date;
  }>;
}

export const getSupporterDashboardStatistics = async (
  supporterProfileId: string,
) => {
  const supporterId = new mongoose.Types.ObjectId(supporterProfileId);

  const [profile, contributionAnalytics] = await Promise.all([
    UserProfileModel.findOne({
      _id: supporterId,
      role: "supporter",
    })
      .select({ credits: 1 })
      .lean()
      .exec(),
    ContributionModel.aggregate<SupporterContributionAnalytics>([
      { $match: { supporterId } },
      {
        $facet: {
          statistics: [
            {
              $group: {
                _id: null,
                totalContributions: { $sum: 1 },
                pendingContributions: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "pending"] }, 1, 0],
                  },
                },
                totalApprovedAmount: {
                  $sum: {
                    $cond: [
                      { $eq: ["$status", "approved"] },
                      "$amount",
                      0,
                    ],
                  },
                },
              },
            },
            { $project: { _id: 0 } },
          ],
          contributionsByCampaign: [
            { $match: { status: "approved" } },
            {
              $group: {
                _id: {
                  campaignId: "$campaignId",
                  campaignTitle: "$campaignTitle",
                },
                approvedAmount: { $sum: "$amount" },
                contributionCount: { $sum: 1 },
              },
            },
            { $sort: { approvedAmount: -1, "_id.campaignTitle": 1 } },
            {
              $project: {
                _id: 0,
                campaignId: "$_id.campaignId",
                campaignTitle: "$_id.campaignTitle",
                approvedAmount: 1,
                contributionCount: 1,
              },
            },
          ],
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
          approvedContributions: [
            { $match: { status: "approved" } },
            { $sort: { createdAt: -1, _id: -1 } },
            { $limit: 10 },
            {
              $project: {
                _id: 0,
                contributionId: "$_id",
                campaignId: 1,
                campaignTitle: 1,
                creatorName: 1,
                creatorEmail: 1,
                amount: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },
    ]).exec(),
  ]);

  if (!profile) {
    throw new AppError(404, "Supporter profile not found");
  }

  const analytics = contributionAnalytics[0];
  const statistics = analytics?.statistics[0];
  const distributionMap = new Map(
    (analytics?.statusDistribution ?? []).map((item) => [
      item.status,
      item,
    ]),
  );

  return {
    statistics: {
      totalContributions: statistics?.totalContributions ?? 0,
      pendingContributions: statistics?.pendingContributions ?? 0,
      totalApprovedAmount: statistics?.totalApprovedAmount ?? 0,
      currentAvailableCredits: profile.credits,
    },
    contributionsByCampaign: (analytics?.contributionsByCampaign ?? []).map(
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
    approvedContributions: (analytics?.approvedContributions ?? []).map(
      (contribution) => ({
        ...contribution,
        contributionId: contribution.contributionId.toString(),
        campaignId: contribution.campaignId.toString(),
      }),
    ),
  };
};
