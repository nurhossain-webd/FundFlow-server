import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { redactRequestTarget } from "../../src/middlewares/request-logger.middleware.js";
import type { RequestUser } from "../../src/types/auth-user.js";
import { AppError } from "../../src/utils/app-error.js";
import { isSafeInternalPath } from "../../src/utils/internal-path.js";
import { assertTrustedActor } from "../../src/utils/trusted-actor.js";

const supporter: RequestUser = {
  profileId: "507f1f77bcf86cd799439011",
  authUserId: "auth-user",
  displayName: "Amina Rahman",
  email: "amina@example.com",
  role: "supporter",
  credits: 50,
  raisedCredits: 0,
  isSuspended: false,
};

describe("security hardening utilities", () => {
  it("accepts local paths and rejects external or ambiguous navigation", () => {
    assert.equal(isSafeInternalPath("/dashboard/supporter"), true);
    assert.equal(isSafeInternalPath("//evil.example/phish"), false);
    assert.equal(isSafeInternalPath("/\\evil.example"), false);
    assert.equal(isSafeInternalPath("https://evil.example"), false);
    assert.equal(isSafeInternalPath("/dashboard\u0000/creator"), false);
  });

  it("redacts query strings and Stripe Checkout identifiers from logs", () => {
    assert.equal(
      redactRequestTarget(
        "/api/v1/payments/checkout-session/cs_test_sensitive123?token=secret",
      ),
      "/api/v1/payments/checkout-session/[REDACTED]",
    );
  });

  it("rejects the wrong role and suspended actors at the service boundary", () => {
    assert.throws(
      () => assertTrustedActor(supporter, "admin"),
      (error: unknown) => error instanceof AppError && error.statusCode === 403,
    );
    assert.throws(
      () =>
        assertTrustedActor({ ...supporter, isSuspended: true }, "supporter"),
      (error: unknown) => error instanceof AppError && error.statusCode === 403,
    );
  });
});
