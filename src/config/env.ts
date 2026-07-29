import "dotenv/config";
import { z } from "zod";

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    VERCEL: z.literal("1").optional(),
    PORT: z.coerce.number().int().min(1).max(65_535).default(5000),
    MONGODB_URI: z
      .string()
      .min(1, "MONGODB_URI is required")
      .refine(
        (value) =>
          value.startsWith("mongodb://") || value.startsWith("mongodb+srv://"),
        "MONGODB_URI must be a valid MongoDB connection URI",
      ),
    MONGODB_DB_NAME: z.string().trim().min(1).default("fundflow"),
    CLIENT_URL: z.url("CLIENT_URL must be a valid URL"),
    CLIENT_URLS: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) =>
          value === undefined ||
          value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .every((item) => z.url().safeParse(item).success),
        "CLIENT_URLS must be a comma-separated list of valid URLs",
      ),
    BETTER_AUTH_URL: z.url("BETTER_AUTH_URL must be a valid URL"),
    STRIPE_SECRET_KEY: z
      .string()
      .trim()
      .regex(/^sk_/, "STRIPE_SECRET_KEY must be a Stripe secret key")
      .optional(),
    STRIPE_WEBHOOK_SECRET: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim().startsWith("whsec_")
          ? value.trim()
          : undefined,
      z.string().optional(),
    ),
    RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  })
  .superRefine((values, context) => {
    if (values.NODE_ENV !== "production") {
      return;
    }

    for (const key of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const) {
      if (!values[key]) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: `${key} is required in production`,
        });
      }
    }
  });

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = Object.freeze(result.data);

export const isProductionEnvironment =
  env.NODE_ENV === "production" || env.VERCEL === "1";

const localClientOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
] as const;

export const allowedClientOrigins = Array.from(
  new Set(
    [
      env.CLIENT_URL,
      ...(env.CLIENT_URLS?.split(",") ?? []),
      ...localClientOrigins,
    ]
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => new URL(value).origin),
  ),
);
