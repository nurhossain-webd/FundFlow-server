import mongoose from "mongoose";

import { env } from "./env.js";

export const connectToDatabase = async (): Promise<void> => {
  await mongoose.connect(env.MONGODB_URI);
  console.info("Connected to MongoDB");
};

export const disconnectFromDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
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
