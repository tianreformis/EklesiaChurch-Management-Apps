import type { Church, SuperAdmin, User } from './db/schema/index.js';
import type { TenantDb } from './db/tenant.js';

export interface AuthUser {
  kind: 'user';
  user: User;
  church: Church;
}

export interface AuthSuperAdmin {
  kind: 'super_admin';
  superAdmin: SuperAdmin;
}

export type AuthContext = AuthUser | AuthSuperAdmin;

/**
 * Variabel konteks Hono. `db` hanya tersedia setelah middleware tenant berjalan
 * dan selalu merupakan fasad yang menyaring `church_id` dari sesi.
 */
export type AppEnv = {
  Variables: {
    auth: AuthContext | null;
    db: TenantDb;
    user: User;
    church: Church;
  };
};
