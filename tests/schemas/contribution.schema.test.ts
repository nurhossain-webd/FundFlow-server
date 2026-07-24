import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  contributionIdempotencyKeySchema,
  contributionIdParamsSchema,
  contributionListQuerySchema,
  createContributionSchema,
  rejectContributionSchema,
} from "../../src/schemas/contribution.schema.js";

describe("contribution validation", () => {
  it("accepts a valid campaign and positive whole-credit amount", () => {
    const result = createContributionSchema.parse({
      campaignId: "507f1f77bcf86cd799439011",
      amount: 75,
    });

    assert.equal(result.amount, 75);
  });

  it("rejects client-controlled status and supporter identity", () => {
    const result = createContributionSchema.safeParse({
      campaignId: "507f1f77bcf86cd799439011",
      amount: 75,
      status: "approved",
      supporterEmail: "attacker@example.com",
    });

    assert.equal(result.success, false);
  });

  it("rejects fractional, zero, and unsafe credit amounts", () => {
    assert.equal(
      createContributionSchema.safeParse({
        campaignId: "507f1f77bcf86cd799439011",
        amount: 1.5,
      }).success,
      false,
    );
    assert.equal(
      createContributionSchema.safeParse({
        campaignId: "507f1f77bcf86cd799439011",
        amount: 0,
      }).success,
      false,
    );
    assert.equal(
      createContributionSchema.safeParse({
        campaignId: "507f1f77bcf86cd799439011",
        amount: Number.MAX_SAFE_INTEGER + 1,
      }).success,
      false,
    );
  });

  it("validates identifiers and bounded pagination", () => {
    assert.equal(
      contributionIdParamsSchema.safeParse({
        contributionId: "not-an-object-id",
      }).success,
      false,
    );

    const query = contributionListQuerySchema.parse({
      page: "2",
      limit: "25",
    });
    assert.deepEqual(query, { page: 2, limit: 25 });
  });

  it("requires reusable-request protection and a meaningful rejection reason", () => {
    assert.equal(
      contributionIdempotencyKeySchema.safeParse(
        "contribution:7d019ecc-2494-4cd7-98d4",
      ).success,
      true,
    );
    assert.equal(
      contributionIdempotencyKeySchema.safeParse("short").success,
      false,
    );
    assert.equal(
      rejectContributionSchema.safeParse({ reason: "No" }).success,
      false,
    );
  });
});
