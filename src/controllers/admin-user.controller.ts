import type { Request, Response } from "express";

import {
  adminUserIdParamsSchema,
  adminUserListQuerySchema,
  changeUserRoleSchema,
} from "../schemas/admin-user.schema.js";
import {
  changeManagedUserRole,
  getAdminUsers,
  softDeleteManagedUser,
} from "../services/admin-user.service.js";
import { AppError } from "../utils/app-error.js";

const getAdmin = (request: Request) => {
  if (!request.user) {
    throw new AppError(401, "Authentication required");
  }
  return request.user;
};

export const listAdminUsers = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const admin = getAdmin(request);
  const query = adminUserListQuerySchema.parse(request.query);
  const result = await getAdminUsers(admin, query);

  response.status(200).json({ success: true, data: result });
};

export const changeAdminUserRole = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const admin = getAdmin(request);
  const { userId } = adminUserIdParamsSchema.parse(request.params);
  const { role } = changeUserRoleSchema.parse(request.body);
  const user = await changeManagedUserRole(userId, role, admin);

  response.status(200).json({
    success: true,
    message: "User role updated",
    data: { user },
  });
};

export const removeAdminUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const admin = getAdmin(request);
  const { userId } = adminUserIdParamsSchema.parse(request.params);
  const result = await softDeleteManagedUser(userId, admin);

  response.status(200).json({
    success: true,
    message: "User access removed while historical records were preserved",
    data: result,
  });
};
