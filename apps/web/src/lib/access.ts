import type { UserRole } from "../types/auth";

export const DEV_ROLES: UserRole[] = ["DESENVOLVIMENTO"];

export function canAccessDev(role: UserRole): boolean {
  return DEV_ROLES.includes(role);
}

export function canAccessOwner(role: UserRole): boolean {
  return role === "PROPRIETARIO" || canAccessDev(role);
}
