import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  notificationIdParamsSchema,
  notificationListQuerySchema,
} from "../../src/schemas/notification.schema.js";

describe("notification validation", () => {
  it("defaults and bounds notification pagination", () => {
    assert.deepEqual(notificationListQuerySchema.parse({}), {
      page: 1,
      limit: 20,
    });
    assert.deepEqual(
      notificationListQuerySchema.parse({ page: "3", limit: "50" }),
      { page: 3, limit: 50 },
    );
    assert.equal(
      notificationListQuerySchema.safeParse({ page: 0, limit: 101 }).success,
      false,
    );
  });

  it("accepts only MongoDB notification identifiers", () => {
    assert.equal(
      notificationIdParamsSchema.safeParse({
        notificationId: "507f1f77bcf86cd799439011",
      }).success,
      true,
    );
    assert.equal(
      notificationIdParamsSchema.safeParse({
        notificationId: "another-users-notification",
      }).success,
      false,
    );
  });
});
