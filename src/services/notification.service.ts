import mongoose, { type ClientSession } from "mongoose";

import {
  NotificationModel,
  type NotificationEntityType,
  type NotificationType,
} from "../models/notification.model.js";
import type { NotificationListQuery } from "../schemas/notification.schema.js";
import type { RequestUser } from "../types/auth-user.js";
import { AppError } from "../utils/app-error.js";

export interface CreateNotificationInput {
  recipientId: mongoose.Types.ObjectId;
  recipientAuthUserId: string;
  toEmail: string;
  type: NotificationType;
  title: string;
  message: string;
  actionRoute?: string;
  relatedEntityType?: NotificationEntityType;
  relatedEntityId?: mongoose.Types.ObjectId;
}

export const createNotification = async (
  input: CreateNotificationInput,
  session?: ClientSession,
) => {
  const notification = new NotificationModel({
    recipientId: input.recipientId,
    recipientAuthUserId: input.recipientAuthUserId,
    toEmail: input.toEmail,
    type: input.type,
    title: input.title,
    message: input.message,
    ...(input.actionRoute ? { actionPath: input.actionRoute } : {}),
    ...(input.relatedEntityType
      ? { relatedEntityType: input.relatedEntityType }
      : {}),
    ...(input.relatedEntityId
      ? { relatedEntityId: input.relatedEntityId }
      : {}),
    isRead: false,
  });
  await notification.save(session ? { session } : {});
  return notification;
};

export const createNotifications = async (
  inputs: CreateNotificationInput[],
  session?: ClientSession,
) => {
  if (inputs.length === 0) {
    return [];
  }

  const documents = inputs.map((input) => ({
      recipientId: input.recipientId,
      recipientAuthUserId: input.recipientAuthUserId,
      toEmail: input.toEmail,
      type: input.type,
      title: input.title,
      message: input.message,
      ...(input.actionRoute ? { actionPath: input.actionRoute } : {}),
      ...(input.relatedEntityType
        ? { relatedEntityType: input.relatedEntityType }
        : {}),
      ...(input.relatedEntityId
        ? { relatedEntityId: input.relatedEntityId }
        : {}),
      isRead: false,
    }));

  return NotificationModel.insertMany(
    documents,
    session ? { session } : {},
  );
};

const getOwnerFilter = (user: RequestUser) => ({
  recipientId: new mongoose.Types.ObjectId(user.profileId),
  recipientAuthUserId: user.authUserId,
});

const toPublicNotification = (
  notification: {
    _id: mongoose.Types.ObjectId;
    title: string;
    message: string;
    toEmail?: string;
    actionPath?: string;
    type: NotificationType;
    isRead: boolean;
    createdAt: Date;
  },
  fallbackEmail: string,
) => ({
  id: notification._id.toString(),
  title: notification.title,
  message: notification.message,
  toEmail: notification.toEmail ?? fallbackEmail,
  actionRoute: notification.actionPath ?? null,
  type: notification.type,
  isRead: notification.isRead,
  time: notification.createdAt.toISOString(),
});

export const getUserNotifications = async (
  user: RequestUser,
  query: NotificationListQuery,
) => {
  const filter = getOwnerFilter(user);
  const skip = (query.page - 1) * query.limit;
  const [notifications, total] = await Promise.all([
    NotificationModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit)
      .select({
        title: 1,
        message: 1,
        toEmail: 1,
        actionPath: 1,
        type: 1,
        isRead: 1,
        createdAt: 1,
      })
      .lean()
      .exec(),
    NotificationModel.countDocuments(filter).exec(),
  ]);

  return {
    notifications: notifications.map((notification) =>
      toPublicNotification(notification, user.email),
    ),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const getUserUnreadNotificationCount = (user: RequestUser) =>
  NotificationModel.countDocuments({
    ...getOwnerFilter(user),
    isRead: false,
  }).exec();

export const markUserNotificationRead = async (
  user: RequestUser,
  notificationId: string,
) => {
  const notification = await NotificationModel.findOneAndUpdate(
    {
      _id: notificationId,
      ...getOwnerFilter(user),
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    },
    { new: true },
  )
    .lean()
    .exec();

  if (!notification) {
    throw new AppError(404, "Notification not found");
  }

  return toPublicNotification(notification, user.email);
};

export const markAllUserNotificationsRead = async (user: RequestUser) => {
  const result = await NotificationModel.updateMany(
    {
      ...getOwnerFilter(user),
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    },
  ).exec();

  return { updatedCount: result.modifiedCount };
};
