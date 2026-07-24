import type { Request, Response } from "express";

import {
  notificationIdParamsSchema,
  notificationListQuerySchema,
} from "../schemas/notification.schema.js";
import {
  getUserNotifications,
  getUserUnreadNotificationCount,
  markAllUserNotificationsRead,
  markUserNotificationRead,
} from "../services/notification.service.js";
import { AppError } from "../utils/app-error.js";

const getUser = (request: Request) => {
  if (!request.user) {
    throw new AppError(401, "Authentication required");
  }
  return request.user;
};

export const listNotifications = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const user = getUser(request);
  const query = notificationListQuerySchema.parse(request.query);
  const result = await getUserNotifications(user, query);
  response.status(200).json({ success: true, data: result });
};

export const getUnreadNotificationCount = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const unreadCount = await getUserUnreadNotificationCount(getUser(request));
  response.status(200).json({ success: true, data: { unreadCount } });
};

export const markNotificationRead = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const user = getUser(request);
  const { notificationId } = notificationIdParamsSchema.parse(request.params);
  const notification = await markUserNotificationRead(user, notificationId);
  response.status(200).json({
    success: true,
    message: "Notification marked as read",
    data: { notification },
  });
};

export const markAllNotificationsRead = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const result = await markAllUserNotificationsRead(getUser(request));
  response.status(200).json({
    success: true,
    message: "All notifications marked as read",
    data: result,
  });
};
