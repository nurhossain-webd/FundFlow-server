import type { Request, Response } from "express";
import { z } from "zod";

import { env } from "../config/env.js";
import {
  createDemoUserProfileOnce,
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

const demoOnboardingSchema = z
  .object({
    role: z.enum(["supporter", "admin"]),
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

export const provisionDemoProfile = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUser = getAuthenticatedUser(request);
  const { role } = demoOnboardingSchema.parse(request.body);
  const expectedEmail =
    role === "admin" ? env.DEMO_ADMIN_EMAIL : env.DEMO_SUPPORTER_EMAIL;

  if (authenticatedUser.email.toLowerCase() !== expectedEmail.toLowerCase()) {
    throw new AppError(
      403,
      "This account is not configured for the selected demo role",
    );
  }

  const result = await createDemoUserProfileOnce(authenticatedUser, role);

  response.status(result.created ? 201 : 200).json({
    success: true,
    message: result.created
      ? "Demo platform profile created"
      : "Demo platform profile already exists",
    data: result,
  });
};
