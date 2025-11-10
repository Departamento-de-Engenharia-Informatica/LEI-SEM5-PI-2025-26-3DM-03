export interface AuthUser {
  name?: string | null;
  email?: string | null;
  role?: string | null;      // primary role
  roles?: string[] | null;   // all roles
  active?: boolean | null;
  avatarUrl?: string | null; // profile picture (e.g. Google picture claim)
}
