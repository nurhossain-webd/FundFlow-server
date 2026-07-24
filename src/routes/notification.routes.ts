import { Router } from "express";

import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notification.controller.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const notificationRouter = Router();

notificationRouter.use(...requireAuth);
notificationRouter.get("/", asyncHandler(listNotifications));
notificationRouter.get(
  "/unread-count",
  asyncHandler(getUnreadNotificationCount),
);
notificationRouter.patch(
  "/read-all",
  asyncHandler(markAllNotificationsRead),
);
notificationRouter.patch(
  "/:notificationId/read",
  asyncHandler(markNotificationRead),
);
