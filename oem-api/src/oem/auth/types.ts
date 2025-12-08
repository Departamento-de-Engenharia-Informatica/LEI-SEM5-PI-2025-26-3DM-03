export type AuthenticatedUser = {
  token: string;
  roles: string[];
  permissions: string[];
  userId?: string;
  tenantId?: string;
  attributes?: unknown;
};
