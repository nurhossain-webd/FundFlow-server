import mongoose from "mongoose";

import { env } from "./env.js";

let databaseConnectionPromise: Promise<void> | undefined;

export const connectToDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  databaseConnectionPromise ??= mongoose
    .connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 10_000,
    })
    .then(() => {
      console.info("MongoDB connected");
    })
    .catch(async () => {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect().catch(() => undefined);
      }

      throw new Error("Unable to connect to MongoDB");
    })
    .finally(() => {
      databaseConnectionPromise = undefined;
    });

  await databaseConnectionPromise;
};

export const disconnectFromDatabase = async (): Promise<void> => {
  databaseConnectionPromise = undefined;

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

export const getDatabaseStatus = (): string => {
  const states: Readonly<Record<number, string>> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return states[mongoose.connection.readyState] ?? "unknown";
};
