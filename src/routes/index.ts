import { Router } from "express";

import { healthRouter } from "./health.routes.js";
import { onboardingRouter } from "./onboarding.routes.js";
import { publicPlatformRouter } from "./public-platform.routes.js";

export const router = Router();

router.use("/health", healthRouter);
router.use("/onboarding", onboardingRouter);
router.use("/public", publicPlatformRouter);
