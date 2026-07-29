import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type RequestHandler } from "express";
import helmetModule from "helmet";

import { connectToDatabase } from "./config/database.js";
import { allowedClientOrigins } from "./config/env.js";
import { errorHandler } from "./middlewares/error-handler.middleware.js";
import { notFound } from "./middlewares/not-found.middleware.js";
import { apiRateLimiter } from "./middlewares/rate-limit.middleware.js";
import { requestLogger } from "./middlewares/request-logger.middleware.js";
import { router } from "./routes/index.js";
import { stripeWebhookRouter } from "./routes/stripe-webhook.routes.js";
import { asyncHandler } from "./utils/async-handler.js";

type HelmetFactory = () => RequestHandler;

// Vercel resolves Helmet through its CommonJS declaration while NodeNext uses
// the ESM default export. Normalize both module shapes.
const helmet =
  (
    helmetModule as unknown as {
      default?: HelmetFactory;
    }
  ).default ?? (helmetModule as unknown as HelmetFactory);

export const app = express();

app.disable("x-powered-by");

app.use(helmet());
app.use(requestLogger);
app.use(apiRateLimiter);
app.use(
  cors({
    origin: allowedClientOrigins,
    credentials: false,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
    maxAge: 600,
  }),
);
app.get("/", (_request, response) => {
  response.status(200).json({
    success: true,
    data: {
      service: "fundflow-api",
      health: "/api/v1/health",
      apiBase: "/api/v1",
    },
  });
});
app.use(
  asyncHandler(async (_request, _response, next) => {
    await connectToDatabase();
    next();
  }),
);
app.use(
  "/api/v1/payments/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  stripeWebhookRouter,
);
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));
app.use(cookieParser());

app.use("/api/v1", router);

app.use(notFound);
app.use(errorHandler);

export default app;
