import mongoose, { type Model } from "mongoose";

import {
  EMAIL_PATTERN,
  HTTP_URL_PATTERN,
  isNonNegativeSafeInteger,
} from "./model.utils.js";

const { model, models, Schema } = mongoose;

export const USER_ROLES = ["supporter", "creator", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface IUserProfile {
  authUserId: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: UserRole;
  credits: number;
  raisedCredits: number;
  isSuspended: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userProfileSchema = new Schema<IUserProfile>(
  {
    authUserId: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: EMAIL_PATTERN,
    },
    photoURL: {
      type: String,
      trim: true,
      match: HTTP_URL_PATTERN,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
      immutable: true,
    },
    credits: {
      type: Number,
      required: true,
      default: 0,
      validate: {
        validator: isNonNegativeSafeInteger,
        message: "Credits must be a non-negative safe integer",
      },
    },
    raisedCredits: {
      type: Number,
      required: true,
      default: 0,
      validate: {
        validator: isNonNegativeSafeInteger,
        message: "Raised credits must be a non-negative safe integer",
      },
    },
    isSuspended: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userProfileSchema.index({ authUserId: 1 }, { unique: true });
userProfileSchema.index({ email: 1 }, { unique: true });
userProfileSchema.index({ role: 1, isSuspended: 1 });
userProfileSchema.index({ createdAt: -1 });

export const UserProfileModel =
  (models.UserProfile as Model<IUserProfile> | undefined) ??
  model<IUserProfile>("UserProfile", userProfileSchema);
