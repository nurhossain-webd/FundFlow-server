import mongoose from "mongoose";
import { z } from "zod";

import {
  connectToDatabase,
  disconnectFromDatabase,
} from "../config/database.js";
import { UserProfileModel } from "../models/user-profile.model.js";

const emailArgument = process.argv
  .find((argument) => argument.startsWith("--email="))
  ?.slice("--email=".length);
const isConfirmed = process.argv.includes("--confirm");
const emailResult = z.email().safeParse(emailArgument?.trim().toLowerCase());

const promoteAdmin = async (): Promise<void> => {
  if (!isConfirmed) {
    throw new Error(
      "Admin promotion requires confirmation. Add --confirm to the command.",
    );
  }

  if (!emailResult.success) {
    throw new Error("Provide a valid Better Auth email with --email=<email>");
  }

  await connectToDatabase();

  const authUser = await mongoose.connection.db
    ?.collection<{
      _id: mongoose.mongo.BSON.ObjectId;
      name: string;
      email: string;
      image?: string | null;
    }>("user")
    .findOne({ email: emailResult.data });

  if (!authUser) {
    throw new Error(
      "Better Auth user not found. Register the account before promoting it.",
    );
  }

  const authUserId = authUser._id.toString();
  const profile = await UserProfileModel.findOneAndUpdate(
    {
      $or: [{ authUserId }, { email: emailResult.data }],
    },
    {
      $set: {
        authUserId,
        displayName: authUser.name,
        email: authUser.email,
        ...(authUser.image ? { photoURL: authUser.image } : {}),
        role: "admin",
        isSuspended: false,
        isDeleted: false,
      },
      $setOnInsert: {
        credits: 0,
        raisedCredits: 0,
        reservedRaisedCredits: 0,
      },
      $unset: {
        deletedAt: 1,
        deletedByAuthUserId: 1,
      },
    },
    {
      returnDocument: "after",
      upsert: true,
      runValidators: true,
    },
  )
    .lean()
    .exec();

  if (!profile) {
    throw new Error("Admin profile could not be created");
  }

  console.info("FundFlow Admin profile ready", {
    email: profile.email,
    role: profile.role,
    profileId: profile._id.toString(),
  });
};

try {
  await promoteAdmin();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Admin promotion failed",
  );
  process.exitCode = 1;
} finally {
  await disconnectFromDatabase();
}
