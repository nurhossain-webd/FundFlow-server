import mongoose, { type Model } from "mongoose";

import { EMAIL_PATTERN, isPositiveSafeInteger } from "./model.utils.js";

const { model, models, Schema } = mongoose;

export const WITHDRAWAL_STATUSES = [
  "pending",
  "approved",
  "processing",
  "completed",
  "rejected",
  "failed",
] as const;

export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export const WITHDRAWAL_PAYMENT_SYSTEMS = [
  "stripe",
  "bkash",
  "rocket",
  "nagad",
] as const;

export type WithdrawalPaymentSystem =
  (typeof WITHDRAWAL_PAYMENT_SYSTEMS)[number];

export interface IWithdrawal {
  creatorId: mongoose.Types.ObjectId;
  creatorAuthUserId: string;
  creatorName: string;
  creatorEmail: string;
  requestedCredits: number;
  amountInCents: number;
  creditsPerDollar: number;
  paymentSystem: WithdrawalPaymentSystem;
  accountNumber: string;
  accountNumberLast4: string;
  status: WithdrawalStatus;
  idempotencyKey: string;
  reviewedByAuthUserId?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  payoutReference?: string;
  completedAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const withdrawalSchema = new Schema<IWithdrawal>(
  {
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
      immutable: true,
    },
    creatorAuthUserId: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    creatorName: {
      type: String,
      required: true,
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
    requestedCredits: {
      type: Number,
      required: true,
      min: 200,
      immutable: true,
      validate: {
        validator: isPositiveSafeInteger,
        message: "Requested credits must be a positive safe integer",
      },
    },
    amountInCents: {
      type: Number,
      required: true,
      immutable: true,
      validate: {
        validator: isPositiveSafeInteger,
        message: "Withdrawal amount must be a positive safe integer",
      },
    },
    creditsPerDollar: {
      type: Number,
      required: true,
      default: 20,
      immutable: true,
      validate: {
        validator: isPositiveSafeInteger,
        message: "Credits per dollar must be a positive safe integer",
      },
    },
    paymentSystem: {
      type: String,
      enum: WITHDRAWAL_PAYMENT_SYSTEMS,
      required: true,
      immutable: true,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
      minlength: 4,
      maxlength: 120,
      immutable: true,
      select: false,
    },
    accountNumberLast4: {
      type: String,
      required: true,
      minlength: 4,
      maxlength: 4,
      immutable: true,
      select: false,
    },
    status: {
      type: String,
      enum: WITHDRAWAL_STATUSES,
      required: true,
      default: "pending",
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      immutable: true,
    },
    reviewedByAuthUserId: {
      type: String,
      trim: true,
    },
    reviewedAt: Date,
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    payoutReference: {
      type: String,
      trim: true,
    },
    completedAt: Date,
    failureReason: {
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

withdrawalSchema.index({ creatorId: 1, idempotencyKey: 1 }, { unique: true });
withdrawalSchema.index({ creatorEmail: 1, createdAt: -1 });
withdrawalSchema.index({ creatorId: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1, createdAt: -1 });
withdrawalSchema.index({ payoutReference: 1 }, { unique: true, sparse: true });

export const WithdrawalModel =
  (models.Withdrawal as Model<IWithdrawal> | undefined) ??
  model<IWithdrawal>("Withdrawal", withdrawalSchema);
