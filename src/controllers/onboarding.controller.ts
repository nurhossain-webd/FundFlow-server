import type { Request, Response } from "express";
import { z } from "zod";

import {
  createUserProfileOnce,
  getUserProfileByAuthId,
  PUBLIC_REGISTRATION_ROLES,
} from "../services/user-profile.service.js";
import { AppError } from "../utils/app-error.js";

const onboardingSchema = z
  .object({
    role: z.enum(PUBLIC_REGISTRATION_ROLES),
  })
  .strict();

const getAuthenticatedUser = (request: Request) => {
  if (!request.authUser) {
    throw new AppError(401, "Authentication required");
  }

  return request.authUser;
};

export const getOnboardingProfile = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUser = getAuthenticatedUser(request);
  const profile = await getUserProfileByAuthId(authenticatedUser.id);

  if (!profile) {
    throw new AppError(404, "Platform profile not found");
  }

  response.status(200).json({
    success: true,
    data: { profile },
  });
};

export const completeOnboarding = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUser = getAuthenticatedUser(request);
  const { role } = onboardingSchema.parse(request.body);
  const result = await createUserProfileOnce(authenticatedUser, role);

  response.status(result.created ? 201 : 200).json({
    success: true,
    message: result.created
      ? "Platform profile created"
      : "Platform profile already exists",
    data: result,
  });
};
