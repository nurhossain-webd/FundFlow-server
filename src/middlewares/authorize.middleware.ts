import type { RequestHandler } from "express";

import type { UserRole } from "../models/user-profile.model.js";
import { AppError } from "../utils/app-error.js";

export const allowRoles =
  (...allowedRoles: readonly UserRole[]): RequestHandler =>
  (request, _response, next) => {
    if (!request.user) {
      next(new AppError(401, "Authentication required"));
      return;
    }

    if (request.user.isSuspended) {
      next(new AppError(403, "Account is suspended"));
      return;
    }

    if (!allowedRoles.includes(request.user.role)) {
      next(new AppError(403, "You do not have permission for this action"));
      return;
    }

    next();
  };

export const requireSupporter = allowRoles("supporter");
export const requireCreator = allowRoles("creator");
export const requireAdmin = allowRoles("admin");

export const authorizeRoles = allowRoles;
