import mongoose, { type ClientSession } from "mongoose";

import { CampaignModel } from "../models/campaign.model.js";
import { ContributionModel } from "../models/contribution.model.js";
import { CreditPaymentModel } from "../models/credit-payment.model.js";
import { ReportModel } from "../models/report.model.js";
import {
  UserProfileModel,
  type UserRole,
} from "../models/user-profile.model.js";
import { WithdrawalModel } from "../models/withdrawal.model.js";
import type { AdminUserListQuery } from "../schemas/admin-user.schema.js";
import type { RequestUser } from "../types/auth-user.js";
import { AppError } from "../utils/app-error.js";
import {
  assertActiveTransaction,
  withMongoTransaction,
} from "../utils/mongo-transaction.js";

const escapeRegularExpression = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toAdminUser = (
  profile: {
    _id: mongoose.Types.ObjectId;
    authUserId: string;
    displayName: string;
    email: string;
    photoURL?: string;
    role: UserRole;
    credits: number;
    raisedCredits: number;
    isSuspended: boolean;
    createdAt: Date;
  },
  adminAuthUserId: string,
) => ({
  id: profile._id.toString(),
  displayName: profile.displayName,
  email: profile.email,
  ...(profile.photoURL ? { photoURL: profile.photoURL } : {}),
  role: profile.role,
  credits: profile.credits,
  raisedCredits: profile.raisedCredits,
  status: profile.isSuspended ? "suspended" : "active",
  isCurrentAdmin: profile.authUserId === adminAuthUserId,
  createdAt: profile.createdAt.toISOString(),
});

export const getAdminUsers = async (
  admin: RequestUser,
  query: AdminUserListQuery,
) => {
  const searchExpression = query.search
    ? new RegExp(escapeRegularExpression(query.search), "i")
    : undefined;
  const filter: mongoose.QueryFilter<{
    role: UserRole;
    isDeleted: boolean;
  }> = {
    isDeleted: { $ne: true },
    ...(query.role ? { role: query.role } : {}),
    ...(searchExpression
      ? {
          $or: [
            { displayName: searchExpression },
            { email: searchExpression },
          ],
        }
      : {}),
  };
  const skip = (query.page - 1) * query.limit;
  const [profiles, total] = await Promise.all([
    UserProfileModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit)
      .select({
        authUserId: 1,
        displayName: 1,
        email: 1,
        photoURL: 1,
        role: 1,
        credits: 1,
        raisedCredits: 1,
        isSuspended: 1,
        createdAt: 1,
      })
      .lean()
      .exec(),
    UserProfileModel.countDocuments(filter).exec(),
  ]);

  return {
    users: profiles.map((profile) =>
      toAdminUser(profile, admin.authUserId),
    ),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

const hasRoleSensitiveRecords = async (
  userId: mongoose.Types.ObjectId,
  session: ClientSession,
) => {
  const [
    campaigns,
    contributions,
    payments,
    withdrawals,
    reports,
  ] = await Promise.all([
    CampaignModel.exists({ creatorId: userId }).session(session),
    ContributionModel.exists({
      $or: [{ supporterId: userId }, { creatorId: userId }],
    }).session(session),
    CreditPaymentModel.exists({ supporterId: userId }).session(session),
    WithdrawalModel.exists({ creatorId: userId }).session(session),
    ReportModel.exists({ reporterId: userId }).session(session),
  ]);

  return Boolean(
    campaigns || contributions || payments || withdrawals || reports,
  );
};

export const changeManagedUserRole = async (
  userId: string,
  role: UserRole,
  admin: RequestUser,
) =>
  withMongoTransaction(async (session) => {
    assertActiveTransaction(session);

    const profile = await UserProfileModel.findOne({
      _id: userId,
      isDeleted: { $ne: true },
    })
      .session(session)
      .exec();

    if (!profile) {
      throw new AppError(404, "User profile not found");
    }

    if (profile.authUserId === admin.authUserId && role !== "admin") {
      throw new AppError(403, "You cannot demote your own Admin account");
    }

    if (profile.role === role) {
      return toAdminUser(profile, admin.authUserId);
    }

    if (await hasRoleSensitiveRecords(profile._id, session)) {
      throw new AppError(
        409,
        "Role cannot be changed because this user has linked platform records",
      );
    }

    profile.role = role;
    await profile.save({ session });
    return toAdminUser(profile, admin.authUserId);
  });

const hasActiveFinancialWork = async (
  userId: mongoose.Types.ObjectId,
  session: ClientSession,
) => {
  const [campaign, contribution, payment, withdrawal] = await Promise.all([
    CampaignModel.exists({
      creatorId: userId,
      status: { $in: ["pending", "approved", "suspended"] },
    }).session(session),
    ContributionModel.exists({
      $or: [{ supporterId: userId }, { creatorId: userId }],
      status: "pending",
    }).session(session),
    CreditPaymentModel.exists({
      supporterId: userId,
      status: { $in: ["created", "pending"] },
    }).session(session),
    WithdrawalModel.exists({
      creatorId: userId,
      status: { $in: ["pending", "processing"] },
    }).session(session),
  ]);

  return Boolean(campaign || contribution || payment || withdrawal);
};

export const softDeleteManagedUser = async (
  userId: string,
  admin: RequestUser,
) =>
  withMongoTransaction(async (session) => {
    assertActiveTransaction(session);

    const profile = await UserProfileModel.findOne({
      _id: userId,
      isDeleted: { $ne: true },
    })
      .session(session)
      .exec();

    if (!profile) {
      throw new AppError(404, "User profile not found");
    }

    if (profile.authUserId === admin.authUserId) {
      throw new AppError(403, "You cannot remove your own Admin account");
    }

    if (await hasActiveFinancialWork(profile._id, session)) {
      throw new AppError(
        409,
        "User cannot be removed while active financial or campaign records remain",
      );
    }

    profile.isDeleted = true;
    profile.isSuspended = true;
    profile.deletedAt = new Date();
    profile.deletedByAuthUserId = admin.authUserId;
    await profile.save({ session });

    return { userId: profile._id.toString(), softDeleted: true };
  });
