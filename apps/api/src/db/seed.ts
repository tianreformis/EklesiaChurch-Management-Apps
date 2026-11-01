import { sql } from 'drizzle-orm';
import { loadEnvFile } from '../lib/load-env.js';
import { loadEnvOrExit } from '../lib/env.js';
import { createDatabase } from './client.js';
import { churches } from './schema/index.js';

/**
 * Data demo fiktif untuk pengembangan. Tidak boleh memakai data jemaat asli.
 * Idempoten: aman dijalankan berulang kali.
 */
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

async function main(): Promise<void> {
  loadEnvFile();
  const env = loadEnvOrExit();
  const { db, close } = createDatabase(env.DATABASE_URL);

  try {
    for (const church of demoChurches) {
      await db
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
        });
    }

    console.warn(`Seed selesai: ${demoChurches.length} gereja demo tersedia.`);
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error('Seed database gagal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
