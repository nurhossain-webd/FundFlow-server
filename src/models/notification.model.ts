import mongoose, { type Model } from "mongoose";

import { EMAIL_PATTERN } from "./model.utils.js";
import { isSafeInternalPath } from "../utils/internal-path.js";

const { model, models, Schema } = mongoose;

export const NOTIFICATION_TYPES = [
  "campaign_submitted",
  "campaign_approved",
  "campaign_rejected",
  "campaign_deleted",
  "campaign_reported",
  "campaign_suspended",
  "contribution_received",
  "contribution_approved",
  "contribution_rejected",
  "contribution_refunded",
  "payment_completed",
  "payment_failed",
  "withdrawal_requested",
  "withdrawal_approved",
  "withdrawal_rejected",
  "withdrawal_completed",
  "account_suspended",
  "system",
  "report_resolved",
] as const;

export const NOTIFICATION_ENTITY_TYPES = [
  "campaign",
  "contribution",
  "creditPayment",
  "withdrawal",
  "userProfile",
  "report",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationEntityType = (typeof NOTIFICATION_ENTITY_TYPES)[number];

export interface INotification {
  recipientId: mongoose.Types.ObjectId;
  recipientAuthUserId: string;
  toEmail: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: NotificationEntityType;
  relatedEntityId?: mongoose.Types.ObjectId;
  actionPath?: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
      immutable: true,
    },
    recipientAuthUserId: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    toEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: EMAIL_PATTERN,
      immutable: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      immutable: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1_000,
    },
    relatedEntityType: {
      type: String,
      enum: NOTIFICATION_ENTITY_TYPES,
    },
    relatedEntityId: Schema.Types.ObjectId,
    actionPath: {
      type: String,
      trim: true,
      maxlength: 300,
      validate: {
        validator: isSafeInternalPath,
        message: "Notification action path must be an internal path",
      },
    },
    isRead: {
      type: Boolean,
      required: true,
      default: false,
    },
    readAt: Date,
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({
  recipientAuthUserId: 1,
  isRead: 1,
  createdAt: -1,
});
notificationSchema.index({ createdAt: -1 });

export const NotificationModel =
  (models.Notification as Model<INotification> | undefined) ??
  model<INotification>("Notification", notificationSchema);
