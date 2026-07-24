import type { Request, Response } from "express";

import { getCreatorDashboardStatistics } from "../services/creator-dashboard.service.js";
import { AppError } from "../utils/app-error.js";

export const getCreatorDashboard = async (
  request: Request,
  response: Response,
): Promise<void> => {
  if (!request.user) {
    throw new AppError(401, "Authentication required");
  }

  const dashboard = await getCreatorDashboardStatistics(request.user.profileId);

  response.status(200).json({
    success: true,
    data: dashboard,
  });
};
