export type UserRole =
  | "ADMIN"
  | "COMERCIAL"
  | "DIRETORIA"
  | "DESENVOLVIMENTO"
  | "PROPRIETARIO"
  | "PROFESSOR";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  tenant: Tenant;
}
