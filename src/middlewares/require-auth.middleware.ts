import type { RequestHandler } from "express";

import {
  requireUserProfile,
  verifyBetterAuthToken,
} from "./authenticate-better-auth.middleware.js";

export const requireAuth: RequestHandler[] = [
  verifyBetterAuthToken,
  requireUserProfile,
];
