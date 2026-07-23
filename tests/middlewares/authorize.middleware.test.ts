import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { NextFunction, Request, Response } from "express";

import {
  allowRoles,
  requireAdmin,
  requireCreator,
  requireSupporter,
} from "../../src/middlewares/authorize.middleware.js";
import type { RequestUser } from "../../src/types/auth-user.js";
import { AppError } from "../../src/utils/app-error.js";

const createUser = (
  role: RequestUser["role"],
  isSuspended = false,
): RequestUser => ({
  profileId: "507f1f77bcf86cd799439011",
  authUserId: "better-auth-user-id",
  displayName: "FundFlow Member",
  email: "member@example.com",
  role,
  credits: 50,
  raisedCredits: 0,
  isSuspended,
});

const runMiddleware = (
  middleware: ReturnType<typeof allowRoles>,
  user?: RequestUser,
): unknown => {
  const request = { user } as Request;
  const response = {} as Response;
  let nextValue: unknown = Symbol("not-called");

  const next: NextFunction = (value?: unknown) => {
    nextValue = value;
  };

  middleware(request, response, next);
  return nextValue;
};

describe("role authorization middleware", () => {
  it("returns 401 when requireSupporter receives no authenticated profile", () => {
    const result = runMiddleware(requireSupporter);

    assert.ok(result instanceof AppError);
    assert.equal(result.statusCode, 401);
    assert.equal(result.message, "Authentication required");
  });

  it("allows a Supporter through requireSupporter", () => {
    const result = runMiddleware(
      requireSupporter,
      createUser("supporter"),
    );

    assert.equal(result, undefined);
  });

  it("returns 403 when a Supporter enters a Creator route", () => {
    const result = runMiddleware(
      requireCreator,
      createUser("supporter"),
    );

    assert.ok(result instanceof AppError);
    assert.equal(result.statusCode, 403);
  });

  it("allows multiple trusted MongoDB roles", () => {
    const middleware = allowRoles("creator", "admin");

    assert.equal(runMiddleware(middleware, createUser("creator")), undefined);
    assert.equal(runMiddleware(middleware, createUser("admin")), undefined);
  });

  it("returns 403 for suspended users even when their role matches", () => {
    const result = runMiddleware(
      requireAdmin,
      createUser("admin", true),
    );

    assert.ok(result instanceof AppError);
    assert.equal(result.statusCode, 403);
    assert.equal(result.message, "Account is suspended");
  });
});
