import { z } from "zod";

const objectIdPattern = /^[a-f\d]{24}$/i;

const optionalIntegerQuery = (defaultValue: number, maximum: number) =>
  z.preprocess(
    (value) => (value === undefined ? defaultValue : value),
    z.coerce.number().int().min(1).max(maximum),
  );

export const notificationListQuerySchema = z
  .object({
    page: optionalIntegerQuery(1, 10_000),
    limit: optionalIntegerQuery(20, 100),
  })
  .strict();

export const notificationIdParamsSchema = z
  .object({
    notificationId: z
      .string()
      .regex(
        objectIdPattern,
        "Notification ID must be a valid MongoDB ObjectId",
      ),
  })
  .strict();

export type NotificationListQuery = z.infer<
  typeof notificationListQuerySchema
>;
