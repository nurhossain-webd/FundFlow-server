import {
  CAMPAIGN_STATUSES,
  CampaignModel,
  type CampaignStatus,
} from "../models/campaign.model.js";
import { CreditPaymentModel } from "../models/credit-payment.model.js";
import {
  USER_ROLES,
  UserProfileModel,
  type UserRole,
} from "../models/user-profile.model.js";
import { WithdrawalModel } from "../models/withdrawal.model.js";

interface UserAnalytics {
  roleDistribution: Array<{
    role: UserRole;
    count: number;
    availableCredits: number;
  }>;
  totals: Array<{
    totalAvailableUserCredits: number;
  }>;
}

interface CampaignAnalytics {
  statusDistribution: Array<{
    status: CampaignStatus;
    count: number;
  }>;
  newestPendingCampaigns: Array<{
    campaignId: unknown;
    title: string;
    creatorName: string;
    fundingGoal: number;
    createdAt: Date;
  }>;
}

interface PaymentAnalytics {
  totals: Array<{
    totalPaymentsProcessed: number;
    totalPaymentAmountInCents: number;
  }>;
  recentPaymentTotals: Array<{
    date: string;
    paymentCount: number;
    amountInCents: number;
  }>;
}

interface WithdrawalAnalytics {
  newestPendingWithdrawals: Array<{
    withdrawalId: unknown;
    creatorName: string;
    creatorEmail: string;
    requestedCredits: number;
    amountInCents: number;
    createdAt: Date;
  }>;
}

export const getAdminDashboardStatistics = async () => {
  const recentPaymentStart = new Date();
  recentPaymentStart.setUTCDate(recentPaymentStart.getUTCDate() - 29);
  recentPaymentStart.setUTCHours(0, 0, 0, 0);

  const [
    userAnalytics,
    campaignAnalytics,
    paymentAnalytics,
    withdrawalAnalytics,
  ] = await Promise.all([
    UserProfileModel.aggregate<UserAnalytics>([
      { $match: { isDeleted: { $ne: true } } },
      {
        $facet: {
          roleDistribution: [
            {
              $group: {
                _id: "$role",
                count: { $sum: 1 },
                availableCredits: { $sum: "$credits" },
              },
            },
            {
              $project: {
                _id: 0,
                role: "$_id",
                count: 1,
                availableCredits: 1,
              },
            },
          ],
          totals: [
            {
              $group: {
                _id: null,
                totalAvailableUserCredits: { $sum: "$credits" },
              },
            },
            { $project: { _id: 0 } },
          ],
        },
      },
    ]).exec(),
    CampaignModel.aggregate<CampaignAnalytics>([
      {
        $facet: {
          statusDistribution: [
            { $group: { _id: "$status", count: { $sum: 1 } } },
            {
              $project: {
                _id: 0,
                status: "$_id",
                count: 1,
              },
            },
          ],
          newestPendingCampaigns: [
            { $match: { status: "pending" } },
            { $sort: { createdAt: -1, _id: -1 } },
            { $limit: 5 },
            {
              $project: {
                _id: 0,
                campaignId: "$_id",
                title: 1,
                creatorName: 1,
                fundingGoal: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },
    ]).exec(),
    CreditPaymentModel.aggregate<PaymentAnalytics>([
      {
        $match: {
          status: "completed",
          currency: "usd",
        },
      },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalPaymentsProcessed: { $sum: 1 },
                totalPaymentAmountInCents: { $sum: "$amountInCents" },
              },
            },
            { $project: { _id: 0 } },
          ],
          recentPaymentTotals: [
            {
              $match: {
                completedAt: { $gte: recentPaymentStart },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$completedAt",
                    timezone: "UTC",
                  },
                },
                paymentCount: { $sum: 1 },
                amountInCents: { $sum: "$amountInCents" },
              },
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                date: "$_id",
                paymentCount: 1,
                amountInCents: 1,
              },
            },
          ],
        },
      },
    ]).exec(),
    WithdrawalModel.aggregate<WithdrawalAnalytics>([
      { $match: { status: "pending" } },
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          withdrawalId: "$_id",
          creatorName: 1,
          creatorEmail: 1,
          requestedCredits: 1,
          amountInCents: 1,
          createdAt: 1,
        },
      },
      {
        $group: {
          _id: null,
          newestPendingWithdrawals: { $push: "$$ROOT" },
        },
      },
      { $project: { _id: 0 } },
    ]).exec(),
  ]);

  const userResult = userAnalytics[0];
  const campaignResult = campaignAnalytics[0];
  const paymentResult = paymentAnalytics[0];
  const withdrawalResult = withdrawalAnalytics[0];
  const userRoleMap = new Map(
    (userResult?.roleDistribution ?? []).map((item) => [item.role, item]),
  );
  const campaignStatusMap = new Map(
    (campaignResult?.statusDistribution ?? []).map((item) => [
      item.status,
      item,
    ]),
  );
  const paymentTotals = paymentResult?.totals[0];

  return {
    statistics: {
      totalSupporters: userRoleMap.get("supporter")?.count ?? 0,
      totalCreators: userRoleMap.get("creator")?.count ?? 0,
      totalAvailableUserCredits:
        userResult?.totals[0]?.totalAvailableUserCredits ?? 0,
      totalPaymentsProcessed: paymentTotals?.totalPaymentsProcessed ?? 0,
      totalPaymentAmountInCents: paymentTotals?.totalPaymentAmountInCents ?? 0,
      paymentCurrency: "usd",
    },
    userRoleDistribution: USER_ROLES.map((role) => ({
      role,
      count: userRoleMap.get(role)?.count ?? 0,
      availableCredits: userRoleMap.get(role)?.availableCredits ?? 0,
    })),
    campaignStatusDistribution: CAMPAIGN_STATUSES.map((status) => ({
      status,
      count: campaignStatusMap.get(status)?.count ?? 0,
    })),
    recentPaymentTotals: paymentResult?.recentPaymentTotals ?? [],
    newestPendingCampaigns: (campaignResult?.newestPendingCampaigns ?? []).map(
      (campaign) => ({
        ...campaign,
        campaignId: String(campaign.campaignId),
      }),
    ),
    newestPendingWithdrawals: (
      withdrawalResult?.newestPendingWithdrawals ?? []
    ).map((withdrawal) => ({
      ...withdrawal,
      withdrawalId: String(withdrawal.withdrawalId),
    })),
  };
};
