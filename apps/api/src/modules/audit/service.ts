import { desc, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import type { TenantDb } from '../../db/tenant.js';
import { auditLogs } from '../../db/schema/index.js';
import { paginationMeta, type Pagination } from '@eklesia/shared';

export interface AuditEntry {
  churchId?: string | null;
  userId?: string | null;
  entity: string;
  entityId?: string | null;
  action: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Mencatat aksi sensitif. `before`/`after` tidak boleh memuat password, token,
 * atau data pribadi yang tidak perlu (nomor telepon lengkap).
 */
export async function recordAudit(db: Database, entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values({
    churchId: entry.churchId ?? null,
    userId: entry.userId ?? null,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    action: entry.action,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}

export interface AuditLogItem {
  id: string;
  entity: string;
  entityId: string | null;
  action: string;
  userId: string | null;
  before: unknown;
  after: unknown;
  createdAt: Date;
}

export async function listAuditLogs(db: TenantDb, pagination: Pagination) {
  const offset = (pagination.page - 1) * pagination.perPage;

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        action: auditLogs.action,
        userId: auditLogs.userId,
        before: auditLogs.before,
        after: auditLogs.after,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pagination.perPage)
      .offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(auditLogs),
  ]);

  return {
    items: rows,
    meta: paginationMeta(pagination.page, pagination.perPage, countRows[0]?.total ?? 0),
  };
}
