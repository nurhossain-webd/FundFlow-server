import type { Request, Response } from "express";

import { getSupporterDashboardStatistics } from "../services/supporter-dashboard.service.js";
import { AppError } from "../utils/app-error.js";

export const getSupporterDashboard = async (
  request: Request,
  response: Response,
): Promise<void> => {
  if (!request.user) {
    throw new AppError(401, "Authentication required");
  }

  const dashboard = await getSupporterDashboardStatistics(
    request.user.profileId,
  );

  response.status(200).json({
    success: true,
    data: dashboard,
  });
};
