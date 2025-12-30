export type AuthenticatedUser = {
  userId?: string;
  email?: string;
  name?: string;
  roles: string[];
  tenantId?: string;
  attributes?: Record<string, unknown>;
};
