import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  adminUserIdParamsSchema,
  adminUserListQuerySchema,
  changeUserRoleSchema,
} from "../../src/schemas/admin-user.schema.js";

describe("Admin user management validation", () => {
  it("coerces pagination and accepts search and role filters", () => {
    assert.deepEqual(
      adminUserListQuerySchema.parse({
        page: "2",
        limit: "20",
        search: "amina@example.com",
        role: "creator",
      }),
      {
        page: 2,
        limit: 20,
        search: "amina@example.com",
        role: "creator",
      },
    );
  });

  it("rejects unsupported roles and untrusted extra fields", () => {
    assert.equal(
      changeUserRoleSchema.safeParse({ role: "owner" }).success,
      false,
    );
    assert.equal(
      changeUserRoleSchema.safeParse({
        role: "admin",
        credits: 1_000_000,
      }).success,
      false,
    );
  });

  it("validates user identifiers and pagination bounds", () => {
    assert.equal(
      adminUserIdParamsSchema.safeParse({
        userId: "507f1f77bcf86cd799439011",
      }).success,
      true,
    );
    assert.equal(
      adminUserListQuerySchema.safeParse({ page: 0, limit: 51 }).success,
      false,
    );
  });
});
