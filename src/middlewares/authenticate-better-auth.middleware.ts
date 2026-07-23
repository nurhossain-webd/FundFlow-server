import type { RequestHandler } from "express";
import { z } from "zod";

import { env } from "../config/env.js";
import { UserProfileModel } from "../models/user-profile.model.js";
import { AppError } from "../utils/app-error.js";
import { asyncHandler } from "../utils/async-handler.js";

const sessionResponseSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.email(),
    image: z.url().nullish(),
  }),
});

export const verifyBetterAuthToken: RequestHandler = asyncHandler(
  async (request, _response, next) => {
    const authorization = request.header("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      throw new AppError(401, "Authentication required");
    }

    const headers = new Headers({ authorization });

    let authResponse: Response;

    try {
      authResponse = await fetch(
        new URL("/api/auth/get-session", env.BETTER_AUTH_URL),
        {
          headers,
          signal: AbortSignal.timeout(5_000),
        },
      );
    } catch {
      throw new AppError(503, "Authentication service unavailable");
    }

    if (!authResponse.ok) {
      throw new AppError(401, "Invalid or expired session");
    }

    const sessionResult = sessionResponseSchema.safeParse(
      await authResponse.json(),
    );

    if (!sessionResult.success) {
      throw new AppError(401, "Invalid or expired session");
    }

    const { user } = sessionResult.data;

    request.authUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      ...(user.image ? { image: user.image } : {}),
    };

    next();
  },
);

export const requireUserProfile: RequestHandler = asyncHandler(
  async (request, _response, next) => {
    if (!request.authUser) {
      throw new AppError(401, "Authentication required");
    }

    const profile = await UserProfileModel.findOne({
      authUserId: request.authUser.id,
    })
      .lean()
      .exec();

    if (!profile) {
      throw new AppError(403, "Platform onboarding required");
    }

    if (profile.isSuspended) {
      throw new AppError(403, "Account is suspended");
    }

    request.user = {
      profileId: profile._id.toString(),
      authUserId: profile.authUserId,
      displayName: profile.displayName,
      email: profile.email,
      role: profile.role,
      credits: profile.credits,
      raisedCredits: profile.raisedCredits,
      isSuspended: profile.isSuspended,
    };

    next();
  },
);

export const authenticatedUserMiddlewares = [
  verifyBetterAuthToken,
  requireUserProfile,
] as const;
