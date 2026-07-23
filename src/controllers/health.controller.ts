import type { Request, Response } from "express";

import { getDatabaseStatus } from "../config/database.js";
import { env } from "../config/env.js";

export const getHealth = (_request: Request, response: Response): void => {
  const databaseStatus = getDatabaseStatus();
  const isHealthy = databaseStatus === "connected";

  response.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    data: {
      service: "fundflow-api",
      status: isHealthy ? "healthy" : "degraded",
      environment: env.NODE_ENV,
      database: databaseStatus,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
};
