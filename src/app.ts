import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/error-handler.middleware.js";
import { notFound } from "./middlewares/not-found.middleware.js";
import { apiRateLimiter } from "./middlewares/rate-limit.middleware.js";
import { requestLogger } from "./middlewares/request-logger.middleware.js";
import { router } from "./routes/index.js";
import { stripeWebhookRouter } from "./routes/stripe-webhook.routes.js";

export const app = express();

app.disable("x-powered-by");

app.use(helmet());
app.use(requestLogger);
app.use(apiRateLimiter);
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: false,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
    maxAge: 600,
  }),
);
app.use(
  "/api/v1/payments/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  stripeWebhookRouter,
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.use("/api/v1", router);

app.use(notFound);
app.use(errorHandler);
