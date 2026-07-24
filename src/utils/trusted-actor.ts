import type { UserRole } from "../models/user-profile.model.js";
import type { RequestUser } from "../types/auth-user.js";
import { AppError } from "./app-error.js";

export const assertTrustedActor = (
  actor: RequestUser,
  ...allowedRoles: readonly UserRole[]
): void => {
  if (actor.isSuspended) {
    throw new AppError(403, "Account is suspended");
  }

  if (!allowedRoles.includes(actor.role)) {
    throw new AppError(403, "You do not have permission for this action");
  }
};
