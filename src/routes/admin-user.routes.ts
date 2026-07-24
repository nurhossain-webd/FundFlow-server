import { Router } from "express";

import {
  changeAdminUserRole,
  listAdminUsers,
  removeAdminUser,
} from "../controllers/admin-user.controller.js";
import { requireAdmin } from "../middlewares/authorize.middleware.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const adminUserRouter = Router();

adminUserRouter.use(...requireAuth, requireAdmin);
adminUserRouter.get("/", asyncHandler(listAdminUsers));
adminUserRouter.patch("/:userId/role", asyncHandler(changeAdminUserRole));
adminUserRouter.delete("/:userId", asyncHandler(removeAdminUser));
