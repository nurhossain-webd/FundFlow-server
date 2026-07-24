import mongoose, { type Model } from "mongoose";

import { EMAIL_PATTERN, isPositiveSafeInteger } from "./model.utils.js";

const { model, models, Schema } = mongoose;

export const CREDIT_PAYMENT_STATUSES = [
  "created",
  "pending",
  "completed",
  "failed",
  "refunded",
] as const;

export type CreditPaymentStatus = (typeof CREDIT_PAYMENT_STATUSES)[number];

export interface ICreditPayment {
  packageId: string;
  supporterId: mongoose.Types.ObjectId;
  supporterAuthUserId: string;
  supporterEmail: string;
  creditsPurchased: number;
  amountInCents: number;
  currency: string;
  paymentMethod?: string;
  status: CreditPaymentStatus;
  idempotencyKey: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  completedAt?: Date;
  failureReason?: string;
  refundedAt?: Date;
  processedStripeEventId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const creditPaymentSchema = new Schema<ICreditPayment>(
  {
    packageId: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
      maxlength: 50,
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
    supporterEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: EMAIL_PATTERN,
      immutable: true,
    },
    creditsPurchased: {
      type: Number,
      required: true,
      immutable: true,
      validate: {
        validator: isPositiveSafeInteger,
        message: "Purchased credits must be a positive safe integer",
      },
    },
    amountInCents: {
      type: Number,
      required: true,
      immutable: true,
      validate: {
        validator: isPositiveSafeInteger,
        message: "Payment amount must be a positive safe integer",
      },
    },
    currency: {
      type: String,
      required: true,
      default: "usd",
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      immutable: true,
    },
    paymentMethod: {
      type: String,
      trim: true,
      maxlength: 50,
      immutable: true,
    },
    status: {
      type: String,
      enum: CREDIT_PAYMENT_STATUSES,
      required: true,
      default: "created",
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      immutable: true,
    },
    stripeCheckoutSessionId: {
      type: String,
      trim: true,
      immutable: true,
    },
    stripePaymentIntentId: {
      type: String,
      trim: true,
    },
    completedAt: Date,
    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    refundedAt: Date,
    processedStripeEventId: {
      type: String,
      trim: true,
      maxlength: 255,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

creditPaymentSchema.index(
  { supporterId: 1, idempotencyKey: 1 },
  { unique: true },
);
creditPaymentSchema.index(
  { stripeCheckoutSessionId: 1 },
  { unique: true, sparse: true },
);
creditPaymentSchema.index(
  { stripePaymentIntentId: 1 },
  { unique: true, sparse: true },
);
creditPaymentSchema.index({ supporterEmail: 1, createdAt: -1 });
creditPaymentSchema.index({ supporterId: 1, createdAt: -1 });
creditPaymentSchema.index({ status: 1, createdAt: -1 });
creditPaymentSchema.index(
  { processedStripeEventId: 1 },
  { unique: true, sparse: true },
);

export const CreditPaymentModel =
  (models.CreditPayment as Model<ICreditPayment> | undefined) ??
  model<ICreditPayment>("CreditPayment", creditPaymentSchema);
