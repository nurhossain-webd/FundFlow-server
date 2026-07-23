import type { RequestHandler } from "express";

import type { UserRole } from "../models/user-profile.model.js";
import { AppError } from "../utils/app-error.js";

export const authorizeRoles =
  (...allowedRoles: readonly UserRole[]): RequestHandler =>
  (request, _response, next) => {
    if (!request.user) {
      next(new AppError(401, "Authentication required"));
      return;
    }

    if (!allowedRoles.includes(request.user.role)) {
      next(new AppError(403, "You do not have permission for this action"));
      return;
    }

    next();
  };
