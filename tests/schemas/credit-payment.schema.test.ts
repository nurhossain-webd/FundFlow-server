import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CREDIT_PACKAGES } from "../../src/config/credit-packages.js";
import {
  checkoutSessionParamsSchema,
  createCheckoutSessionSchema,
  paymentHistoryQuerySchema,
} from "../../src/schemas/credit-payment.schema.js";

describe("credit purchase validation", () => {
  it("keeps prices and credits in the trusted server catalog", () => {
    assert.deepEqual(CREDIT_PACKAGES, {
      credits_100: {
        id: "credits_100",
        credits: 100,
        amountInCents: 1_000,
        currency: "usd",
      },
      credits_300: {
        id: "credits_300",
        credits: 300,
        amountInCents: 2_500,
        currency: "usd",
      },
      credits_800: {
        id: "credits_800",
        credits: 800,
        amountInCents: 6_000,
        currency: "usd",
      },
      credits_1500: {
        id: "credits_1500",
        credits: 1_500,
        amountInCents: 11_000,
        currency: "usd",
      },
    });
  });

  it("accepts every server-defined credit package ID", () => {
    for (const packageId of Object.keys(CREDIT_PACKAGES)) {
      assert.equal(
        createCheckoutSessionSchema.safeParse({ packageId }).success,
        true,
      );
    }
  });

  it("rejects client-controlled price and credit values", () => {
    assert.equal(
      createCheckoutSessionSchema.safeParse({
        packageId: "credits_100",
        credits: 100_000,
        amountInCents: 1,
      }).success,
      false,
    );
  });

  it("rejects unknown package IDs", () => {
    assert.equal(
      createCheckoutSessionSchema.safeParse({
        packageId: "custom_package",
      }).success,
      false,
    );
  });

  it("accepts Stripe Checkout IDs and rejects unrelated identifiers", () => {
    assert.equal(
      checkoutSessionParamsSchema.safeParse({
        checkoutSessionId: "cs_test_example123",
      }).success,
      true,
    );
    assert.equal(
      checkoutSessionParamsSchema.safeParse({
        checkoutSessionId: "payment-from-query-string",
      }).success,
      false,
    );
  });

  it("coerces and bounds payment history pagination", () => {
    assert.deepEqual(paymentHistoryQuerySchema.parse({}), {
      page: 1,
      limit: 10,
    });
    assert.deepEqual(
      paymentHistoryQuerySchema.parse({ page: "3", limit: "20" }),
      { page: 3, limit: 20 },
    );
    assert.equal(
      paymentHistoryQuerySchema.safeParse({ page: 0, limit: 51 }).success,
      false,
    );
  });
});
