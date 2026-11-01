import { eq, sql } from 'drizzle-orm';
import type { Role } from '@eklesia/shared';
import { loadEnvFile } from '../lib/load-env.js';
import { loadEnvOrExit } from '../lib/env.js';
import { hashPassword } from '../lib/passwords.js';
import { createDatabase } from './client.js';
import { churches, superAdmins, users } from './schema/index.js';

/**
 * Data demo fiktif untuk pengembangan. Tidak boleh memakai data jemaat asli.
 * Idempoten: aman dijalankan berulang kali.
 */
const DEMO_PASSWORD = 'Eklesia2026';

const demoChurches = [
  {
    name: 'GKI Contoh Sejahtera',
    slug: 'gki-contoh-sejahtera',
    address: 'Jl. Melati No. 1, Jakarta Pusat',
    phone: '021-0000001',
    plan: 'free' as const,
    status: 'active' as const,
  },
  {
    name: 'GPdI Contoh Damai',
    slug: 'gpdi-contoh-damai',
    address: 'Jl. Kenanga No. 2, Bandung',
    phone: '022-0000002',
    plan: 'free' as const,
    status: 'active' as const,
  },
];

interface DemoUser {
  churchSlug: string;
  name: string;
  email: string;
  role: Role;
}

const demoUsers: DemoUser[] = [
  {
    churchSlug: 'gki-contoh-sejahtera',
    name: 'Yohanes Pratama',
    email: 'admin@gki-contoh.test',
    role: 'admin_gereja',
  },
  {
    churchSlug: 'gki-contoh-sejahtera',
    name: 'Maria Simanjuntak',
    email: 'bendahara@gki-contoh.test',
    role: 'bendahara',
  },
  {
    churchSlug: 'gki-contoh-sejahtera',
    name: 'Daniel Hutapea',
    email: 'majelis@gki-contoh.test',
    role: 'majelis',
  },
  {
    churchSlug: 'gki-contoh-sejahtera',
    name: 'Ruth Lumbantobing',
    email: 'sekretaris@gki-contoh.test',
    role: 'sekretaris',
  },
  {
    churchSlug: 'gki-contoh-sejahtera',
    name: 'Andreas Sitorus',
    email: 'koordinator@gki-contoh.test',
    role: 'koordinator_komisi',
  },
  {
    churchSlug: 'gki-contoh-sejahtera',
    name: 'Sarah Nainggolan',
    email: 'pelayan@gki-contoh.test',
    role: 'pelayan',
  },
  {
    churchSlug: 'gki-contoh-sejahtera',
    name: 'Binsar Situmorang',
    email: 'jemaat@gki-contoh.test',
    role: 'jemaat',
  },
  {
    churchSlug: 'gpdi-contoh-damai',
    name: 'Petrus Wenda',
    email: 'admin@gpdi-contoh.test',
    role: 'admin_gereja',
  },
];

const demoSuperAdmin = {
  name: 'Pengelola Platform',
  email: 'platform@eklesia.test',
};

async function main(): Promise<void> {
  loadEnvFile();
  const env = loadEnvOrExit();
  // Seed memakai koneksi pemilik skema agar tidak terhalang RLS.
  const { db, close } = createDatabase(env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL);
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  try {
    const churchIds = new Map<string, string>();

    for (const church of demoChurches) {
      const [saved] = await db
        .insert(churches)
        .values(church)
        .onConflictDoUpdate({
          target: churches.slug,
          set: {
            name: church.name,
            address: church.address,
            phone: church.phone,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: churches.id, slug: churches.slug });
      if (saved) {
        churchIds.set(saved.slug, saved.id);
      }
    }

    for (const user of demoUsers) {
      const churchId = churchIds.get(user.churchSlug);
      if (!churchId) {
        throw new Error(`Gereja ${user.churchSlug} tidak ditemukan saat seed.`);
      }
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${user.email}`)
        .limit(1);

      if (existing) {
        await db
          .update(users)
          .set({
            name: user.name,
            role: user.role,
            churchId,
            passwordHash,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing.id));
      } else {
        await db.insert(users).values({
          churchId,
          name: user.name,
          email: user.email,
          role: user.role,
          passwordHash,
          isActive: true,
        });
      }
    }

    const [existingAdmin] = await db
      .select({ id: superAdmins.id })
      .from(superAdmins)
      .where(sql`lower(${superAdmins.email}) = ${demoSuperAdmin.email}`)
      .limit(1);

    if (existingAdmin) {
      await db
        .update(superAdmins)
        .set({ name: demoSuperAdmin.name, passwordHash, isActive: true })
        .where(eq(superAdmins.id, existingAdmin.id));
    } else {
      await db.insert(superAdmins).values({
        name: demoSuperAdmin.name,
        email: demoSuperAdmin.email,
        passwordHash,
      });
    }

    console.warn(`Seed selesai: ${demoChurches.length} gereja dan ${demoUsers.length} pengguna demo.`);
    console.warn(`Akun demo memakai password: ${DEMO_PASSWORD}`);
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error('Seed database gagal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
