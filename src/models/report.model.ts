import mongoose, { type Model } from "mongoose";

import { EMAIL_PATTERN } from "./model.utils.js";

const { model, models, Schema } = mongoose;

export const REPORT_TARGET_TYPES = [
  "user",
  "campaign",
  "contribution",
] as const;

export const REPORT_REASONS = [
  "fraud",
  "misleading_information",
  "prohibited_content",
  "harassment",
  "spam",
  "other",
] as const;

export const REPORT_STATUSES = [
  "pending",
  "under_review",
  "resolved",
  "dismissed",
] as const;

export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface IReport {
  reporterId: mongoose.Types.ObjectId;
  reporterAuthUserId: string;
  reporterEmail: string;
  targetType: ReportTargetType;
  targetId: mongoose.Types.ObjectId;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  assignedAdminId?: mongoose.Types.ObjectId;
  reviewedByAuthUserId?: string;
  resolutionNote?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
      immutable: true,
    },
    reporterAuthUserId: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    reporterEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: EMAIL_PATTERN,
      immutable: true,
    },
    targetType: {
      type: String,
      enum: REPORT_TARGET_TYPES,
      required: true,
      immutable: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    reason: {
      type: String,
      enum: REPORT_REASONS,
      required: true,
      immutable: true,
    },
    details: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2_000,
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      required: true,
      default: "pending",
    },
    assignedAdminId: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
    },
    reviewedByAuthUserId: {
      type: String,
      trim: true,
    },
    resolutionNote: {
      type: String,
      trim: true,
      maxlength: 2_000,
    },
    resolvedAt: Date,
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reporterId: 1, createdAt: -1 });
reportSchema.index({ reporterEmail: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
reportSchema.index({ assignedAdminId: 1, status: 1, createdAt: -1 });

export const ReportModel =
  (models.Report as Model<IReport> | undefined) ??
  model<IReport>("Report", reportSchema);
