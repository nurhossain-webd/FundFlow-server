import type { ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";

import { isProductionEnvironment } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

interface ErrorResponse {
  success: false;
  message: string;
  details?: unknown;
  stack?: string;
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  let statusCode = 500;
  let message = "Internal server error";
  let details: unknown;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = "Request validation failed";
    details = error.issues;
  } else if (error instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = "Database validation failed";
    details = Object.values(error.errors).map((item) => item.message);
  } else if (error instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${error.path}`;
  }

  const body: ErrorResponse = {
    success: false,
    message,
  };

  if (details !== undefined) {
    body.details = details;
  }

  if (
    !isProductionEnvironment &&
    error instanceof Error &&
    error.stack !== undefined
  ) {
    body.stack = error.stack;
  }

  if (statusCode >= 500) {
    console.error(
      "[FundFlow API] Request failed",
      error instanceof Error
        ? {
            name: error.name,
            ...(!isProductionEnvironment
              ? { message: error.message, stack: error.stack }
              : {}),
          }
        : { name: "UnknownError" },
    );
  }

  response.status(statusCode).json(body);
};
