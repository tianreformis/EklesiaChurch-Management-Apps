import { eq } from 'drizzle-orm';
import type { UpdateChurchInput } from '@eklesia/shared';
import type { TenantDb } from '../../db/tenant.js';
import type { Church } from '../../db/schema/index.js';
import { churches } from '../../db/schema/index.js';
import { notFound } from '../../lib/errors.js';
import { recordAudit } from '../audit/service.js';

export interface ChurchProfile {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  timezone: string;
  plan: Church['plan'];
  status: Church['status'];
}

export function toChurchProfile(church: Church): ChurchProfile {
  return {
    id: church.id,
    name: church.name,
    slug: church.slug,
    address: church.address,
    phone: church.phone,
    timezone: church.timezone,
    plan: church.plan,
    status: church.status,
  };
}

export async function getChurch(tenant: TenantDb): Promise<ChurchProfile> {
  const [church] = await tenant.select().from(churches).where(eq(churches.id, tenant.churchId)).limit(1);
  if (!church) {
    throw notFound('Data gereja tidak ditemukan.');
  }
  return toChurchProfile(church);
}

export async function updateChurch(
  tenant: TenantDb,
  actorId: string,
  input: UpdateChurchInput,
): Promise<ChurchProfile> {
  const [before] = await tenant.select().from(churches).where(eq(churches.id, tenant.churchId)).limit(1);
  if (!before) {
    throw notFound('Data gereja tidak ditemukan.');
  }

  const [updated] = await tenant
    .update(churches)
    .set({
      name: input.name,
      address: input.address ?? null,
      phone: input.phone ?? null,
      timezone: input.timezone,
      updatedAt: new Date(),
    })
    .where(eq(churches.id, tenant.churchId))
    .returning();

  if (!updated) {
    throw notFound('Data gereja tidak ditemukan.');
  }

  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actorId,
    entity: 'church',
    entityId: tenant.churchId,
    action: 'church.updated',
    before: { name: before.name, address: before.address, phone: before.phone },
    after: { name: updated.name, address: updated.address, phone: updated.phone },
  });

  return toChurchProfile(updated);
}
