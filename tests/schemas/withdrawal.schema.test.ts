import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createWithdrawalSchema,
  withdrawalIdempotencyKeySchema,
  withdrawalIdParamsSchema,
  withdrawalListQuerySchema,
} from "../../src/schemas/withdrawal.schema.js";

describe("withdrawal validation", () => {
  it("accepts a valid creator withdrawal request", () => {
    assert.equal(
      createWithdrawalSchema.safeParse({
        credits: 200,
        paymentSystem: "bank_transfer",
        accountNumber: "ACCT-8291",
      }).success,
      true,
    );
  });

  it("rejects withdrawals below 200 credits and client-calculated fields", () => {
    assert.equal(
      createWithdrawalSchema.safeParse({
        credits: 199,
        amountInCents: 995,
        status: "approved",
        paymentSystem: "paypal",
        accountNumber: "creator@example.com",
      }).success,
      false,
    );
  });

  it("validates supported payout systems and account identifiers", () => {
    assert.equal(
      createWithdrawalSchema.safeParse({
        credits: 300,
        paymentSystem: "cash",
        accountNumber: "123",
      }).success,
      false,
    );
  });

  it("validates IDs, pagination, and idempotency keys", () => {
    assert.deepEqual(withdrawalListQuerySchema.parse({}), {
      page: 1,
      limit: 10,
    });
    assert.equal(
      withdrawalIdParamsSchema.safeParse({
        withdrawalId: "507f1f77bcf86cd799439011",
      }).success,
      true,
    );
    assert.equal(
      withdrawalIdempotencyKeySchema.safeParse("withdrawal:req:123456")
        .success,
      true,
    );
    assert.equal(
      withdrawalListQuerySchema.safeParse({ page: 0, limit: 51 }).success,
      false,
    );
  });
});
