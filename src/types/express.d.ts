import type { AuthenticatedUser, RequestUser } from "./auth-user.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
      user?: RequestUser;
    }
  }
}

export {};
