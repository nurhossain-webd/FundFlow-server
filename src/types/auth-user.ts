import type { UserRole } from "../models/user-profile.model.js";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export interface RequestUser {
  profileId: string;
  authUserId: string;
  displayName: string;
  email: string;
  role: UserRole;
  credits: number;
  raisedCredits: number;
  isSuspended: boolean;
}
