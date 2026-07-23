import type { Request, Response } from "express";

import {
  getPlatformStatistics,
  getTopFundedCampaigns,
} from "../services/public-platform.service.js";

export const getPublicTopCampaigns = async (
  _request: Request,
  response: Response,
): Promise<void> => {
  const campaigns = await getTopFundedCampaigns();

  response.status(200).json({
    success: true,
    data: {
      campaigns,
    },
  });
};

export const getPublicPlatformStatistics = async (
  _request: Request,
  response: Response,
): Promise<void> => {
  const statistics = await getPlatformStatistics();

  response.status(200).json({
    success: true,
    data: {
      statistics,
    },
  });
};
