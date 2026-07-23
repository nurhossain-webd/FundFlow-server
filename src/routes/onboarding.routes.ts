import { Router } from "express";

import {
  completeOnboarding,
  getOnboardingProfile,
} from "../controllers/onboarding.controller.js";
import { authenticateBetterAuth } from "../middlewares/authenticate-better-auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const onboardingRouter = Router();

onboardingRouter.use(authenticateBetterAuth);
onboardingRouter.get("/profile", asyncHandler(getOnboardingProfile));
onboardingRouter.post("/profile", asyncHandler(completeOnboarding));
