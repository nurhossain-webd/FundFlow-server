import morgan from "morgan";

import { env } from "../config/env.js";

const CHECKOUT_SESSION_PATTERN = /cs_(?:test|live)_[A-Za-z0-9]+/g;

export const redactRequestTarget = (target: string): string => {
  const [path] = target.split("?", 1);
  return (path ?? "/").replace(CHECKOUT_SESSION_PATTERN, "[REDACTED]");
};

morgan.token("safe-url", (request) => redactRequestTarget(request.url ?? "/"));

const developmentFormat = ":method :safe-url :status :response-time ms";
const productionFormat =
  ':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';

export const requestLogger = morgan(
  env.NODE_ENV === "production" ? productionFormat : developmentFormat,
);
