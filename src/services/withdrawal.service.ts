import mongoose from "mongoose";

import { NotificationModel } from "../models/notification.model.js";
import { UserProfileModel } from "../models/user-profile.model.js";
import {
  WithdrawalModel,
  type IWithdrawal,
} from "../models/withdrawal.model.js";
import type {
  CreateWithdrawalInput,
  WithdrawalListQuery,
} from "../schemas/withdrawal.schema.js";
import type { RequestUser } from "../types/auth-user.js";
import { AppError } from "../utils/app-error.js";
import {
  assertActiveTransaction,
  withMongoTransaction,
} from "../utils/mongo-transaction.js";

const CREDITS_PER_DOLLAR = 20;
const CENTS_PER_DOLLAR = 100;

const isDuplicateKeyError = (
  error: unknown,
): error is { code: number } =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11_000;

const getMaskedAccountNumber = (lastFour: string) => `•••• ${lastFour}`;

const toSafeWithdrawal = (
  withdrawal: Pick<
    IWithdrawal,
    | "creatorName"
    | "creatorEmail"
    | "requestedCredits"
    | "amountInCents"
    | "creditsPerDollar"
    | "paymentSystem"
    | "accountNumberLast4"
    | "status"
    | "reviewedAt"
    | "createdAt"
    | "updatedAt"
  > & { _id: mongoose.Types.ObjectId },
) => ({
  id: withdrawal._id.toString(),
  creatorName: withdrawal.creatorName,
  creatorEmail: withdrawal.creatorEmail,
  withdrawalCredits: withdrawal.requestedCredits,
  amountInCents: withdrawal.amountInCents,
  creditsPerDollar: withdrawal.creditsPerDollar,
  paymentSystem: withdrawal.paymentSystem,
  accountNumber: getMaskedAccountNumber(withdrawal.accountNumberLast4),
  status: withdrawal.status,
  date: withdrawal.createdAt.toISOString(),
  reviewedAt: withdrawal.reviewedAt?.toISOString() ?? null,
  updatedAt: withdrawal.updatedAt.toISOString(),
});

const assertMatchingIdempotentWithdrawal = (
  withdrawal: IWithdrawal,
  input: CreateWithdrawalInput,
) => {
  if (
    withdrawal.requestedCredits !== input.credits ||
    withdrawal.paymentSystem !== input.paymentSystem ||
    withdrawal.accountNumber !== input.accountNumber
  ) {
    throw new AppError(
      409,
      "Idempotency-Key has already been used for another withdrawal",
    );
  }
};

export const createWithdrawalRequest = async (
  creator: RequestUser,
  input: CreateWithdrawalInput,
  idempotencyKey: string,
) => {
  const amountInCents =
    (input.credits * CENTS_PER_DOLLAR) / CREDITS_PER_DOLLAR;
  const normalizedAccountNumber = input.accountNumber.trim();
  const accountCharacters = normalizedAccountNumber.replace(/\s/g, "");
  const accountNumberLast4 = accountCharacters.slice(-4);

  if (!Number.isSafeInteger(amountInCents)) {
    throw new AppError(400, "Withdrawal credits produce an invalid amount");
  }

  const normalizedInput = {
    ...input,
    accountNumber: normalizedAccountNumber,
  };

  try {
    return await withMongoTransaction(async (session) => {
      assertActiveTransaction(session);

      const existing = await WithdrawalModel.findOne({
        creatorId: creator.profileId,
        idempotencyKey,
      })
        .select("+accountNumber +accountNumberLast4")
        .session(session)
        .exec();

      if (existing) {
        assertMatchingIdempotentWithdrawal(existing, normalizedInput);
        return { withdrawal: toSafeWithdrawal(existing), created: false };
      }

      const creatorProfile = await UserProfileModel.findOneAndUpdate(
        {
          _id: creator.profileId,
          authUserId: creator.authUserId,
          role: "creator",
          isSuspended: false,
          $expr: {
            $gte: [
              {
                $subtract: [
                  "$raisedCredits",
                  { $ifNull: ["$reservedRaisedCredits", 0] },
                ],
              },
              input.credits,
            ],
          },
        },
        { $inc: { reservedRaisedCredits: input.credits } },
        { new: true, session },
      ).exec();

      if (!creatorProfile) {
        throw new AppError(
          409,
          "Withdrawal exceeds your unreserved raised credits",
        );
      }

      const [withdrawal] = await WithdrawalModel.create(
        [
          {
            creatorId: creatorProfile._id,
            creatorAuthUserId: creator.authUserId,
            creatorName: creatorProfile.displayName,
            creatorEmail: creatorProfile.email,
            requestedCredits: input.credits,
            amountInCents,
            creditsPerDollar: CREDITS_PER_DOLLAR,
            paymentSystem: input.paymentSystem,
            accountNumber: normalizedAccountNumber,
            accountNumberLast4,
            status: "pending",
            idempotencyKey,
          },
        ],
        { session },
      );

      if (!withdrawal) {
        throw new AppError(500, "Unable to create withdrawal request");
      }

      return {
        withdrawal: toSafeWithdrawal(withdrawal),
        created: true,
      };
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const existing = await WithdrawalModel.findOne({
      creatorId: creator.profileId,
      idempotencyKey,
    })
      .select("+accountNumber +accountNumberLast4")
      .exec();

    if (!existing) {
      throw new AppError(409, "Duplicate withdrawal request");
    }

    assertMatchingIdempotentWithdrawal(existing, normalizedInput);
    return { withdrawal: toSafeWithdrawal(existing), created: false };
  }
};

const getPaginatedWithdrawals = async (
  filter: Record<string, unknown>,
  query: WithdrawalListQuery,
) => {
  const skip = (query.page - 1) * query.limit;
  const [withdrawals, total] = await Promise.all([
    WithdrawalModel.find(filter)
      .select("+accountNumberLast4")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean()
      .exec(),
    WithdrawalModel.countDocuments(filter).exec(),
  ]);

  return {
    withdrawals: withdrawals.map(toSafeWithdrawal),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const getCreatorWithdrawalHistory = (
  creator: RequestUser,
  query: WithdrawalListQuery,
) =>
  getPaginatedWithdrawals(
    {
      creatorId: new mongoose.Types.ObjectId(creator.profileId),
      creatorAuthUserId: creator.authUserId,
      ...(query.status ? { status: query.status } : {}),
    },
    query,
  );

export const getCreatorWithdrawalSummary = async (creator: RequestUser) => {
  const profile = await UserProfileModel.findOne({
    _id: creator.profileId,
    authUserId: creator.authUserId,
    role: "creator",
  })
    .select({ raisedCredits: 1, reservedRaisedCredits: 1 })
    .lean()
    .exec();

  if (!profile) {
    throw new AppError(404, "Creator profile not found");
  }

  const reservedRaisedCredits = profile.reservedRaisedCredits ?? 0;
  const withdrawableCredits = Math.max(
    0,
    profile.raisedCredits - reservedRaisedCredits,
  );
  const equivalentAmountInCents =
    (withdrawableCredits * CENTS_PER_DOLLAR) / CREDITS_PER_DOLLAR;

  if (!Number.isSafeInteger(equivalentAmountInCents)) {
    throw new AppError(409, "Withdrawable credit value is invalid");
  }

  return {
    currentRaisedCredits: profile.raisedCredits,
    reservedRaisedCredits,
    withdrawableCredits,
    equivalentAmountInCents,
    minimumWithdrawalCredits: 200,
    creditsPerDollar: CREDITS_PER_DOLLAR,
  };
};

export const getPendingWithdrawalRequests = (query: WithdrawalListQuery) =>
  getPaginatedWithdrawals({ status: "pending" }, query);

export const approveWithdrawalRequest = async (
  withdrawalId: string,
  admin: RequestUser,
) =>
  withMongoTransaction(async (session) => {
    assertActiveTransaction(session);

    const withdrawal = await WithdrawalModel.findOne({
      _id: withdrawalId,
      status: "pending",
    })
      .select("+accountNumberLast4")
      .session(session)
      .exec();

    if (!withdrawal) {
      const existing = await WithdrawalModel.exists({ _id: withdrawalId })
        .session(session)
        .exec();

      throw new AppError(
        existing ? 409 : 404,
        existing
          ? "Withdrawal request is no longer pending"
          : "Withdrawal request not found",
      );
    }

    const creatorUpdate = await UserProfileModel.updateOne(
      {
        _id: withdrawal.creatorId,
        authUserId: withdrawal.creatorAuthUserId,
        role: "creator",
        raisedCredits: { $gte: withdrawal.requestedCredits },
        reservedRaisedCredits: { $gte: withdrawal.requestedCredits },
      },
      {
        $inc: {
          raisedCredits: -withdrawal.requestedCredits,
          reservedRaisedCredits: -withdrawal.requestedCredits,
        },
      },
      { session },
    );

    if (creatorUpdate.modifiedCount !== 1) {
      throw new AppError(
        409,
        "Creator raised credits are unavailable for this withdrawal",
      );
    }

    const reviewedAt = new Date();
    const withdrawalUpdate = await WithdrawalModel.updateOne(
      { _id: withdrawal._id, status: "pending" },
      {
        $set: {
          status: "approved",
          reviewedByAuthUserId: admin.authUserId,
          reviewedAt,
        },
      },
      { session },
    );

    if (withdrawalUpdate.modifiedCount !== 1) {
      throw new AppError(409, "Withdrawal request was already processed");
    }

    await NotificationModel.create(
      [
        {
          recipientId: withdrawal.creatorId,
          recipientAuthUserId: withdrawal.creatorAuthUserId,
          type: "withdrawal_approved",
          title: "Withdrawal approved",
          message: `Your withdrawal of ${withdrawal.requestedCredits.toLocaleString()} raised credits has been approved.`,
          relatedEntityType: "withdrawal",
          relatedEntityId: withdrawal._id,
          actionPath: "/dashboard/creator/withdrawals",
          isRead: false,
        },
      ],
      { session },
    );

    withdrawal.status = "approved";
    withdrawal.reviewedAt = reviewedAt;
    return toSafeWithdrawal(withdrawal);
  });
