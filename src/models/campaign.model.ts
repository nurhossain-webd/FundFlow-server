import mongoose, { type Model } from "mongoose";

import {
  EMAIL_PATTERN,
  HTTP_URL_PATTERN,
  isNonNegativeSafeInteger,
  isPositiveSafeInteger,
} from "./model.utils.js";

const { model, models, Schema } = mongoose;

export const CAMPAIGN_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "suspended",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export interface ICampaign {
  title: string;
  story: string;
  category: string;
  fundingGoal: number;
  minimumContribution: number;
  deadline: Date;
  rewardInfo: string;
  imageURL: string;
  creatorId: mongoose.Types.ObjectId;
  creatorName: string;
  creatorEmail: string;
  amountRaised: number;
  status: CampaignStatus;
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new Schema<ICampaign>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 120,
    },
    story: {
      type: String,
      required: true,
      trim: true,
      minlength: 50,
      maxlength: 20_000,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    fundingGoal: {
      type: Number,
      required: true,
      immutable: true,
      validate: {
        validator: isPositiveSafeInteger,
        message: "Funding goal must be a positive safe integer",
      },
    },
    minimumContribution: {
      type: Number,
      required: true,
      immutable: true,
      validate: {
        validator: isPositiveSafeInteger,
        message: "Minimum contribution must be a positive safe integer",
      },
    },
    deadline: {
      type: Date,
      required: true,
    },
    rewardInfo: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2_000,
    },
    imageURL: {
      type: String,
      required: true,
      trim: true,
      match: HTTP_URL_PATTERN,
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
      immutable: true,
    },
    creatorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    creatorEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: EMAIL_PATTERN,
      immutable: true,
    },
    amountRaised: {
      type: Number,
      required: true,
      default: 0,
      validate: {
        validator: isNonNegativeSafeInteger,
        message: "Amount raised must be a non-negative safe integer",
      },
    },
    status: {
      type: String,
      enum: CAMPAIGN_STATUSES,
      required: true,
      default: "pending",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

campaignSchema.index({ status: 1, createdAt: -1 });
campaignSchema.index({ creatorId: 1, status: 1, createdAt: -1 });
campaignSchema.index({ creatorEmail: 1, createdAt: -1 });
campaignSchema.index({ deadline: 1, status: 1 });
campaignSchema.index({ category: 1, status: 1 });

export const CampaignModel =
  (models.Campaign as Model<ICampaign> | undefined) ??
  model<ICampaign>("Campaign", campaignSchema);
