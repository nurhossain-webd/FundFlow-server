import type { Request, Response } from "express";

import { getAdminDashboardStatistics } from "../services/admin-dashboard.service.js";

export const getAdminDashboard = async (
  _request: Request,
  response: Response,
): Promise<void> => {
  const dashboard = await getAdminDashboardStatistics();

  response.status(200).json({
    success: true,
    data: dashboard,
  });
};
