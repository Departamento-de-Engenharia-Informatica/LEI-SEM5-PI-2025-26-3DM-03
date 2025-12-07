export type AuthenticatedUser = {
  token: string;
  roles: string[];
  permissions: string[];
  tenantId?: string;
  attributes?: unknown;
};
