import type { ClientSession } from "mongoose";

import {
  UserProfileModel,
  type IUserProfile,
  type UserRole,
} from "../models/user-profile.model.js";
import type { AuthenticatedUser } from "../types/auth-user.js";
import { AppError } from "../utils/app-error.js";
import { withMongoTransaction } from "../utils/mongo-transaction.js";

export const PUBLIC_REGISTRATION_ROLES = ["supporter", "creator"] as const;
export type PublicRegistrationRole = (typeof PUBLIC_REGISTRATION_ROLES)[number];

const INITIAL_CREDITS: Readonly<Record<PublicRegistrationRole, number>> = {
  supporter: 50,
  creator: 20,
};

interface ProfileCreationResult {
  profile: IUserProfile;
  created: boolean;
}

type DemoRole = Extract<UserRole, "supporter" | "admin">;

const findExistingProfile = async (
  authUserId: string,
  session?: ClientSession,
): Promise<IUserProfile | null> =>
  UserProfileModel.findOne({ authUserId })
    .session(session ?? null)
    .lean<IUserProfile>()
    .exec();

const isDuplicateKeyError = (error: unknown): error is { code: number } =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11_000;

export const getUserProfileByAuthId = async (
  authUserId: string,
): Promise<IUserProfile | null> => findExistingProfile(authUserId);

export const createUserProfileOnce = async (
  authenticatedUser: AuthenticatedUser,
  role: PublicRegistrationRole,
): Promise<ProfileCreationResult> => {
  const credits = INITIAL_CREDITS[role];

  try {
    return await withMongoTransaction(async (session) => {
      const existingProfile = await findExistingProfile(
        authenticatedUser.id,
        session,
      );

      if (existingProfile) {
        return {
          profile: existingProfile,
          created: false,
        };
      }

      const emailOwner = await UserProfileModel.findOne({
        email: authenticatedUser.email.toLowerCase(),
      })
        .session(session)
        .lean<IUserProfile>()
        .exec();

      if (emailOwner) {
        throw new AppError(409, "A platform profile already uses this email");
      }

      const [profile] = await UserProfileModel.create(
        [
          {
            authUserId: authenticatedUser.id,
            displayName: authenticatedUser.name,
            email: authenticatedUser.email,
            ...(authenticatedUser.image
              ? { photoURL: authenticatedUser.image }
              : {}),
            role: role satisfies UserRole,
            credits,
            raisedCredits: 0,
            isSuspended: false,
          },
        ],
        { session },
      );

      if (!profile) {
        throw new AppError(500, "Unable to create platform profile");
      }

      return {
        profile: profile.toObject(),
        created: true,
      };
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const existingProfile = await findExistingProfile(authenticatedUser.id);

    if (!existingProfile) {
      throw new AppError(409, "A platform profile already exists");
    }

    return {
      profile: existingProfile,
      created: false,
    };
  }
};

export const createDemoUserProfileOnce = async (
  authenticatedUser: AuthenticatedUser,
  role: DemoRole,
): Promise<ProfileCreationResult> => {
  const existingProfile = await findExistingProfile(authenticatedUser.id);

  if (existingProfile) {
    if (existingProfile.role !== role) {
      throw new AppError(409, "Demo account role does not match its profile");
    }

    return { profile: existingProfile, created: false };
  }

  try {
    const profile = await UserProfileModel.create({
      authUserId: authenticatedUser.id,
      displayName: authenticatedUser.name,
      email: authenticatedUser.email,
      ...(authenticatedUser.image ? { photoURL: authenticatedUser.image } : {}),
      role,
      credits: role === "supporter" ? INITIAL_CREDITS.supporter : 0,
      raisedCredits: 0,
      reservedRaisedCredits: 0,
      isSuspended: false,
      isDeleted: false,
    });

    return { profile: profile.toObject(), created: true };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const concurrentProfile = await findExistingProfile(authenticatedUser.id);

    if (!concurrentProfile || concurrentProfile.role !== role) {
      throw new AppError(
        409,
        "A platform profile already uses this demo account",
      );
    }

    return { profile: concurrentProfile, created: false };
  }
};
