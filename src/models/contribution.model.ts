import mongoose, { type Model } from "mongoose";

import { EMAIL_PATTERN, isPositiveSafeInteger } from "./model.utils.js";

const { model, models, Schema } = mongoose;

export const CONTRIBUTION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "refunded",
] as const;

export type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number];

export interface IContribution {
  campaignId: mongoose.Types.ObjectId;
  campaignTitle: string;
  supporterId: mongoose.Types.ObjectId;
  supporterAuthUserId: string;
  supporterName: string;
  supporterEmail: string;
  creatorId: mongoose.Types.ObjectId;
  creatorName?: string;
  creatorEmail: string;
  amount: number;
  message?: string;
  status: ContributionStatus;
  idempotencyKey: string;
  reviewedAt?: Date;
  reviewedByAuthUserId?: string;
  rejectionReason?: string;
  refundedAt?: Date;
  refundReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const contributionSchema = new Schema<IContribution>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      immutable: true,
    },
    campaignTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      immutable: true,
    },
    supporterId: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
      immutable: true,
    },
    supporterAuthUserId: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    supporterName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      immutable: true,
    },
    supporterEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: EMAIL_PATTERN,
      immutable: true,
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
      immutable: true,
    },
    creatorName: {
      type: String,
      trim: true,
      maxlength: 80,
      immutable: true,
    },
    creatorEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: EMAIL_PATTERN,
      immutable: true,
    },
    amount: {
      type: Number,
      required: true,
      immutable: true,
      validate: {
        validator: isPositiveSafeInteger,
        message: "Contribution amount must be a positive safe integer",
      },
    },
    message: {
      type: String,
      trim: true,
      maxlength: 1_000,
      immutable: true,
    },
    status: {
      type: String,
      enum: CONTRIBUTION_STATUSES,
      required: true,
      default: "pending",
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
      maxlength: 100,
    },
    reviewedAt: Date,
    reviewedByAuthUserId: {
      type: String,
      trim: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    refundedAt: Date,
    refundReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

contributionSchema.index(
  { supporterId: 1, idempotencyKey: 1 },
  { unique: true },
);
contributionSchema.index({ campaignId: 1, status: 1, createdAt: -1 });
contributionSchema.index({ supporterId: 1, status: 1, createdAt: -1 });
contributionSchema.index({ creatorId: 1, status: 1, createdAt: -1 });
contributionSchema.index({ supporterEmail: 1, createdAt: -1 });
contributionSchema.index({ creatorEmail: 1, status: 1, createdAt: -1 });
contributionSchema.index({ status: 1, createdAt: -1 });

export const ContributionModel =
  (models.Contribution as Model<IContribution> | undefined) ??
  model<IContribution>("Contribution", contributionSchema);
