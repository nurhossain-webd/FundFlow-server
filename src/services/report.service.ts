import { CampaignModel } from "../models/campaign.model.js";
import { ReportModel } from "../models/report.model.js";
import type { CreateCampaignReportInput } from "../schemas/report.schema.js";
import type { RequestUser } from "../types/auth-user.js";
import { AppError } from "../utils/app-error.js";

export const createCampaignReport = async (
  supporter: RequestUser,
  campaignId: string,
  input: CreateCampaignReportInput,
) => {
  const campaign = await CampaignModel.findOne({
    _id: campaignId,
    status: "approved",
  })
    .select({ _id: 1 })
    .lean()
    .exec();

  if (!campaign) {
    throw new AppError(404, "Campaign not found");
  }

  const existingReport = await ReportModel.exists({
    reporterId: supporter.profileId,
    targetType: "campaign",
    targetId: campaign._id,
    status: { $in: ["pending", "under_review"] },
  });

  if (existingReport) {
    throw new AppError(
      409,
      "You already have an active report for this campaign",
    );
  }

  const report = await ReportModel.create({
    reporterId: supporter.profileId,
    reporterAuthUserId: supporter.authUserId,
    reporterEmail: supporter.email,
    targetType: "campaign",
    targetId: campaign._id,
    reason: input.reason,
    details: input.details,
    status: "pending",
  });

  return report.toObject();
};
