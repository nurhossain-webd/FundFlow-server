import { Router } from "express";

import { campaignRouter } from "./campaign.routes.js";
import { adminUserRouter } from "./admin-user.routes.js";
import { contributionRouter } from "./contribution.routes.js";
import { creditPaymentRouter } from "./credit-payment.routes.js";
import { dashboardRouter } from "./dashboard.routes.js";
import { healthRouter } from "./health.routes.js";
import { onboardingRouter } from "./onboarding.routes.js";
import { publicPlatformRouter } from "./public-platform.routes.js";
import { reportRouter } from "./report.routes.js";
import { withdrawalRouter } from "./withdrawal.routes.js";

export const router = Router();

router.use("/health", healthRouter);
router.use("/admin/users", adminUserRouter);
router.use("/campaigns", campaignRouter);
router.use("/contributions", contributionRouter);
router.use("/payments", creditPaymentRouter);
router.use("/dashboard", dashboardRouter);
router.use("/onboarding", onboardingRouter);
router.use("/public", publicPlatformRouter);
router.use("/reports", reportRouter);
router.use("/withdrawals", withdrawalRouter);
