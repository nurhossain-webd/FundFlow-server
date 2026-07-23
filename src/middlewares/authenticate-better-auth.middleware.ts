import type { RequestHandler } from "express";
import { z } from "zod";

import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { asyncHandler } from "../utils/async-handler.js";

const sessionResponseSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.email(),
    image: z.url().nullish(),
  }),
});

export const authenticateBetterAuth: RequestHandler = asyncHandler(
  async (request, _response, next) => {
    const authorization = request.header("authorization");
    const cookie = request.header("cookie");

    if (!authorization && !cookie) {
      throw new AppError(401, "Authentication required");
    }

    const headers = new Headers();

    if (authorization) {
      headers.set("authorization", authorization);
    }

    if (cookie) {
      headers.set("cookie", cookie);
    }

    let authResponse: Response;

    try {
      authResponse = await fetch(
        new URL("/api/auth/get-session", env.BETTER_AUTH_URL),
        {
          headers,
          signal: AbortSignal.timeout(5_000),
        },
      );
    } catch {
      throw new AppError(503, "Authentication service unavailable");
    }

    if (!authResponse.ok) {
      throw new AppError(401, "Invalid or expired session");
    }

    const sessionResult = sessionResponseSchema.safeParse(
      await authResponse.json(),
    );

    if (!sessionResult.success) {
      throw new AppError(401, "Invalid or expired session");
    }

    const { user } = sessionResult.data;

    request.authUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      ...(user.image ? { image: user.image } : {}),
    };

    next();
  },
);
