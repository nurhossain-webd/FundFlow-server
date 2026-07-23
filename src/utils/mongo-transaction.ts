import mongoose, { type ClientSession } from "mongoose";

import { AppError } from "./app-error.js";

export type TransactionWork<TResult> = (
  session: ClientSession,
) => Promise<TResult>;

type TransactionOptions = NonNullable<
  Parameters<ClientSession["withTransaction"]>[1]
>;

const DEFAULT_TRANSACTION_OPTIONS = {
  readPreference: "primary",
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" },
  maxCommitTimeMS: 10_000,
} satisfies TransactionOptions;

/**
 * Runs database work in a MongoDB transaction and always releases its session.
 *
 * MongoDB may execute `work` more than once when retrying a transient transaction
 * error. Keep the callback limited to idempotent database operations and perform
 * external side effects only after this function resolves.
 */
export const withMongoTransaction = async <TResult>(
  work: TransactionWork<TResult>,
  options: TransactionOptions = DEFAULT_TRANSACTION_OPTIONS,
): Promise<TResult> => {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(503, "Database connection is unavailable");
  }

  const session = await mongoose.startSession();
  let outcome: { value: TResult } | undefined;

  try {
    await session.withTransaction(async () => {
      outcome = {
        value: await work(session),
      };
    }, options);

    if (outcome === undefined) {
      throw new AppError(500, "Database transaction did not complete");
    }

    return outcome.value;
  } finally {
    await session.endSession();
  }
};

/**
 * Guards lower-level financial helpers against being called without the
 * transaction session required to keep their related writes atomic.
 */
export const assertActiveTransaction = (
  session: ClientSession,
): ClientSession => {
  if (!session.inTransaction()) {
    throw new AppError(500, "An active database transaction is required");
  }

  return session;
};
