import { Router } from "express";

import { getHealth } from "../controllers/health.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

export const healthRouter = Router();

healthRouter.get("/", asyncHandler(getHealth));
