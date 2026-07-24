import mongoose from "mongoose";

import { CampaignModel } from "../models/campaign.model.js";
import { ReportModel, type IReport } from "../models/report.model.js";
import { UserProfileModel } from "../models/user-profile.model.js";
import type {
  AdminReportListQuery,
  CreateCampaignReportInput,
} from "../schemas/report.schema.js";
import type { RequestUser } from "../types/auth-user.js";
import { AppError } from "../utils/app-error.js";
import {
  assertActiveTransaction,
  withMongoTransaction,
} from "../utils/mongo-transaction.js";
import {
  createNotification,
  createNotifications,
} from "./notification.service.js";

const isDuplicateKeyError = (error: unknown): error is { code: number } =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11_000;

const escapeRegularExpression = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toAdminReport = (report: {
  _id: mongoose.Types.ObjectId;
  reporterName: string;
  reporterEmail: string;
  targetId: mongoose.Types.ObjectId;
  campaignTitle: string;
  creatorName: string;
  creatorEmail: string;
  reason: string;
  details: string;
  status: string;
  resolutionNote?: string;
  resolvedAt?: Date;
  createdAt: Date;
}) => ({
  id: report._id.toString(),
  campaignId: report.targetId.toString(),
  campaignTitle: report.campaignTitle,
  creatorName: report.creatorName,
  creatorEmail: report.creatorEmail,
  reporterName: report.reporterName,
  reporterEmail: report.reporterEmail,
  reason: report.reason,
  details: report.details,
  status: report.status,
  reportDate: report.createdAt.toISOString(),
  resolutionNote: report.resolutionNote ?? null,
  resolvedAt: report.resolvedAt?.toISOString() ?? null,
});

export const createCampaignReport = async (
  supporter: RequestUser,
  campaignId: string,
  input: CreateCampaignReportInput,
) => {
  const activeDeduplicationKey = `${supporter.profileId}:campaign:${campaignId}`;

  try {
    return await withMongoTransaction(async (session) => {
      assertActiveTransaction(session);

      const campaign = await CampaignModel.findOne({
        _id: campaignId,
        status: "approved",
      })
        .session(session)
        .lean()
        .exec();

      if (!campaign) {
        throw new AppError(404, "Approved campaign not found");
      }

      const creator = await UserProfileModel.findOne({
        _id: campaign.creatorId,
        role: "creator",
        isDeleted: { $ne: true },
      })
        .session(session)
        .lean()
        .exec();

      if (!creator) {
        throw new AppError(409, "Campaign creator profile is unavailable");
      }

      const report = new ReportModel({
        reporterId: supporter.profileId,
        reporterAuthUserId: supporter.authUserId,
        reporterName: supporter.displayName,
        reporterEmail: supporter.email,
        targetType: "campaign",
        targetId: campaign._id,
        campaignTitle: campaign.title,
        creatorId: creator._id,
        creatorAuthUserId: creator.authUserId,
        creatorName: creator.displayName,
        creatorEmail: creator.email,
        reason: input.reason,
        details: input.details,
        status: "pending",
        activeDeduplicationKey,
      });
      await report.save({ session });

      const admins = await UserProfileModel.find({
        role: "admin",
        isSuspended: false,
        isDeleted: { $ne: true },
      })
        .select({ _id: 1, authUserId: 1, email: 1 })
        .session(session)
        .lean()
        .exec();

      await createNotifications(
        admins.map((admin) => ({
          recipientId: admin._id,
          recipientAuthUserId: admin.authUserId,
          toEmail: admin.email,
          type: "campaign_reported",
          title: "Campaign report submitted",
          message: `${campaign.title} was reported for ${input.reason.replaceAll("_", " ")}.`,
          relatedEntityType: "report",
          relatedEntityId: report._id,
          actionRoute: "/dashboard/admin/reports",
        })),
        session,
      );

      return toAdminReport(report);
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(
        409,
        "You already have an unresolved report for this campaign",
      );
    }
    throw error;
  }
};

export const getAdminReports = async (query: AdminReportListQuery) => {
  const searchExpression = query.search
    ? new RegExp(escapeRegularExpression(query.search), "i")
    : undefined;
  const filter: mongoose.QueryFilter<IReport> = {
    targetType: "campaign",
    ...(query.status ? { status: query.status } : {}),
    ...(searchExpression
      ? {
          $or: [
            { reporterName: searchExpression },
            { reporterEmail: searchExpression },
            { campaignTitle: searchExpression },
            { creatorName: searchExpression },
            { creatorEmail: searchExpression },
          ],
        }
      : {}),
  };
  const skip = (query.page - 1) * query.limit;
  const [reports, total] = await Promise.all([
    ReportModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean()
      .exec(),
    ReportModel.countDocuments(filter).exec(),
  ]);

  return {
    reports: reports.map(toAdminReport),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const resolveCampaignReport = async (
  reportId: string,
  admin: RequestUser,
  resolutionNote?: string,
) =>
  withMongoTransaction(async (session) => {
    assertActiveTransaction(session);
    const resolvedAt = new Date();
    const report = await ReportModel.findOneAndUpdate(
      {
        _id: reportId,
        targetType: "campaign",
        status: { $in: ["pending", "under_review"] },
      },
      {
        $set: {
          status: "resolved",
          reviewedByAuthUserId: admin.authUserId,
          resolvedAt,
          ...(resolutionNote ? { resolutionNote } : {}),
        },
        $unset: { activeDeduplicationKey: 1 },
      },
      { new: true, session },
    ).exec();

    if (!report) {
      const exists = await ReportModel.exists({ _id: reportId })
        .session(session)
        .exec();
      throw new AppError(
        exists ? 409 : 404,
        exists ? "Report is already resolved" : "Report not found",
      );
    }

    await createNotification(
      {
        recipientId: report.reporterId,
        recipientAuthUserId: report.reporterAuthUserId,
        toEmail: report.reporterEmail,
        type: "report_resolved",
        title: "Campaign report reviewed",
        message: `Your report about ${report.campaignTitle} has been reviewed.`,
        relatedEntityType: "report",
        relatedEntityId: report._id,
        actionRoute: "/campaigns",
      },
      session,
    );

    return toAdminReport(report);
  });

export const suspendReportedCampaign = async (
  reportId: string,
  admin: RequestUser,
  resolutionNote?: string,
) =>
  withMongoTransaction(async (session) => {
    assertActiveTransaction(session);

    const report = await ReportModel.findOne({
      _id: reportId,
      targetType: "campaign",
      status: { $in: ["pending", "under_review"] },
    })
      .session(session)
      .exec();

    if (!report) {
      throw new AppError(404, "Active campaign report not found");
    }

    const campaign = await CampaignModel.findOneAndUpdate(
      {
        _id: report.targetId,
        status: "approved",
      },
      { $set: { status: "suspended" } },
      { new: true, session },
    ).exec();

    if (!campaign) {
      throw new AppError(409, "Only an approved campaign can be suspended");
    }

    const activeReports = await ReportModel.find({
      targetType: "campaign",
      targetId: campaign._id,
      status: { $in: ["pending", "under_review"] },
    })
      .session(session)
      .exec();
    const resolvedAt = new Date();

    await ReportModel.updateMany(
      {
        _id: { $in: activeReports.map((item) => item._id) },
      },
      {
        $set: {
          status: "resolved",
          reviewedByAuthUserId: admin.authUserId,
          resolvedAt,
          resolutionNote:
            resolutionNote ?? "Campaign suspended after moderation review",
        },
        $unset: { activeDeduplicationKey: 1 },
      },
      { session },
    );

    const reporterRecipients = new Map(
      activeReports.map((item) => [
        item.reporterId.toString(),
        {
          recipientId: item.reporterId,
          recipientAuthUserId: item.reporterAuthUserId,
          toEmail: item.reporterEmail,
        },
      ]),
    );

    await createNotifications(
      [
        {
          recipientId: report.creatorId,
          recipientAuthUserId: report.creatorAuthUserId,
          toEmail: report.creatorEmail,
          type: "campaign_suspended",
          title: "Campaign suspended",
          message: `${report.campaignTitle} was suspended after a moderation review.`,
          relatedEntityType: "campaign",
          relatedEntityId: campaign._id,
          actionRoute: "/dashboard/creator/campaigns",
        },
        ...Array.from(reporterRecipients.values()).map((recipient) => ({
          ...recipient,
          type: "report_resolved" as const,
          title: "Reported campaign suspended",
          message: `${report.campaignTitle} was suspended after moderation review.`,
          relatedEntityType: "report" as const,
          relatedEntityId: report._id,
          actionRoute: "/campaigns",
        })),
      ],
      session,
    );

    return {
      campaignId: campaign._id.toString(),
      status: campaign.status,
      resolvedReports: activeReports.length,
    };
  });
