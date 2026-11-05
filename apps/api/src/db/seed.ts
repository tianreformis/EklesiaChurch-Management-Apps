import { eq, sql } from 'drizzle-orm';
import type { Role } from '@eklesia/shared';
import { loadEnvFile } from '../lib/load-env.js';
import { loadEnvOrExit } from '../lib/env.js';
import { hashPassword } from '../lib/passwords.js';
import { createDatabase, type Database } from './client.js';
import {
  cashAccounts,
  churches,
  families,
  financeCategories,
  groupMembers,
  groups,
  members,
  regions,
  serviceAssignments,
  serviceRoles,
  services,
  superAdmins,
  transactions,
  users,
} from './schema/index.js';

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

const FIRST_NAMES = [
  'Yohanes', 'Maria', 'Daniel', 'Ruth', 'Andreas', 'Sarah', 'Binsar', 'Marta',
  'Petrus', 'Anna', 'Samuel', 'Debora', 'Yusuf', 'Rahel', 'Timotius', 'Ester',
  'Paulus', 'Lidia', 'Markus', 'Hanna',
];
const LAST_NAMES = [
  'Pratama', 'Simanjuntak', 'Hutapea', 'Lumbantobing', 'Sitorus', 'Nainggolan',
  'Situmorang', 'Panjaitan', 'Siregar', 'Manullang',
];

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/**
 * Mengisi data demo satu gereja: ±60 anggota, 6 keluarga, 3 wilayah, 5 komisi,
 * peran + 2 bulan ibadah mingguan, dan 3 bulan transaksi. Dilewati bila
 * gereja sudah punya anggota agar aman dijalankan ulang.
 */
async function seedChurchContent(
  db: Database,
  churchId: string,
  slug: string,
  createdByUserId: string,
): Promise<void> {
  const existing = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.churchId, churchId))
    .limit(1);
  if (existing.length > 0) {
    return;
  }

  const regionRows = await db
    .insert(regions)
    .values(['Wilayah 1', 'Wilayah 2', 'Wilayah 3'].map((name) => ({ churchId, name })))
    .returning({ id: regions.id, name: regions.name });
  const familyRows = await db
    .insert(families)
    .values(
      LAST_NAMES.slice(0, 6).map((name) => ({ churchId, name: `Keluarga ${name}` })),
    )
    .returning({ id: families.id });

  const memberValues = [];
  for (let index = 0; index < 60; index += 1) {
    const first = FIRST_NAMES[index % FIRST_NAMES.length]!;
    const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length]!;
    const month = String((index % 12) + 1).padStart(2, '0');
    const day = String((index % 27) + 1).padStart(2, '0');
    memberValues.push({
      churchId,
      fullName: `${first} ${last} ${index >= 20 ? String(Math.floor(index / 20)) : ''}`.trim(),
      gender: (index % 2 === 0 ? 'laki_laki' : 'perempuan') as 'laki_laki' | 'perempuan',
      birthDate: `${1965 + (index % 40)}-${month}-${day}`,
      phone: `0812${String(10000000 + index * 137).slice(0, 8)}`,
      email: `anggota${index + 1}@contoh.test`,
      status: (index % 15 === 14 ? 'tidak_aktif' : 'aktif') as 'aktif' | 'tidak_aktif',
      familyId: familyRows[index % familyRows.length]!.id,
      regionId: regionRows[index % regionRows.length]!.id,
      baptismDate: '2005-04-10',
    });
  }
  const memberRows = await db.insert(members).values(memberValues).returning({ id: members.id, fullName: members.fullName });

  const groupDefs = [
    { name: 'Sekolah Minggu', type: 'komisi' as const },
    { name: 'Pemuda', type: 'komisi' as const },
    { name: 'Kaum Ibu', type: 'komisi' as const },
    { name: 'Tim Musik', type: 'tim_pelayanan' as const },
    { name: 'Tim Multimedia', type: 'tim_pelayanan' as const },
  ];
  const groupRows = await db
    .insert(groups)
    .values(groupDefs.map((group) => ({ churchId, ...group })))
    .returning({ id: groups.id, name: groups.name });

  // Anggota pertama di tiap komisi menjadi koordinatornya.
  const gmValues: { churchId: string; groupId: string; memberId: string; roleInGroup?: string }[] = [];
  groupRows.forEach((group, groupIndex) => {
    for (let offset = 0; offset < 8; offset += 1) {
      const member = memberRows[(groupIndex * 8 + offset) % memberRows.length]!;
      gmValues.push({
        churchId,
        groupId: group.id,
        memberId: member.id,
        ...(offset === 0 ? { roleInGroup: 'koordinator' } : {}),
      });
    }
  });
  await db.insert(groupMembers).values(gmValues);

  const musik = groupRows.find((group) => group.name === 'Tim Musik')!;
  const roleRows = await db
    .insert(serviceRoles)
    .values([
      { churchId, name: 'Pemimpin Liturgi', sortOrder: 1 },
      { churchId, name: 'Pemusik', groupId: musik.id, sortOrder: 2 },
      { churchId, name: 'Singer', groupId: musik.id, sortOrder: 3 },
      { churchId, name: 'Multimedia', sortOrder: 4 },
      { churchId, name: 'Penerima Tamu', sortOrder: 5 },
    ])
    .returning({ id: serviceRoles.id, name: serviceRoles.name });

  // Ibadah Minggu selama ±2 bulan (November–Desember 2026).
  const serviceValues = [];
  for (let week = 0; week < 9; week += 1) {
    serviceValues.push({
      churchId,
      title: 'Ibadah Minggu Pagi',
      date: addDays('2026-11-01', week * 7),
      startTime: '09:00',
      endTime: '11:00',
      location: 'Gedung Utama',
      preacher: 'Pdt. Contoh Melayani',
    });
  }
  const serviceRows = await db.insert(services).values(serviceValues).returning({ id: services.id });

  const assignmentValues: (typeof serviceAssignments.$inferInsert)[] = [];
  for (const service of serviceRows) {
    roleRows.forEach((role, roleIndex) => {
      const member = memberRows[(roleIndex * 3 + serviceRows.indexOf(service)) % memberRows.length]!;
      assignmentValues.push({
        churchId,
        serviceId: service.id,
        serviceRoleId: role.id,
        memberId: member.id,
        status: 'menunggu' as const,
      });
    });
  }
  await db.insert(serviceAssignments).values(assignmentValues);

  // Keuangan: akun, kategori bawaan, 3 bulan transaksi deterministik.
  const [account] = await db
    .insert(cashAccounts)
    .values({ churchId, name: 'Kas Utama', openingBalance: 5_000_000 })
    .returning({ id: cashAccounts.id });
  const incomeNames = ['Perpuluhan', 'Persembahan Minggu', 'Ucapan Syukur'];
  const expenseNames = ['Operasional', 'Listrik/Air', 'Diakonia'];
  const categoryRows = await db
    .insert(financeCategories)
    .values([
      ...incomeNames.map((name) => ({ churchId, name, type: 'in' as const })),
      ...expenseNames.map((name) => ({ churchId, name, type: 'out' as const })),
      { churchId, name: 'Pembangunan', type: 'in' as const },
      { churchId, name: 'Pembangunan', type: 'out' as const },
      { churchId, name: 'Misi', type: 'in' as const },
      { churchId, name: 'Misi', type: 'out' as const },
      { churchId, name: 'Gaji/Honor', type: 'out' as const },
      { churchId, name: 'Lain-lain', type: 'in' as const },
      { churchId, name: 'Lain-lain', type: 'out' as const },
    ])
    .returning({ id: financeCategories.id, name: financeCategories.name, type: financeCategories.type });

  const findCategory = (name: string, type: 'in' | 'out') =>
    categoryRows.find((category) => category.name === name && category.type === type)!;

  const txValues: (typeof transactions.$inferInsert)[] = [];
  const months = ['2026-09', '2026-10', '2026-11'];
  months.forEach((month, monthIndex) => {
    txValues.push(
      {
        churchId,
        accountId: account!.id,
        categoryId: findCategory('Perpuluhan', 'in').id,
        type: 'in' as const,
        amount: 2_500_000 + monthIndex * 100_000,
        date: `${month}-05`,
        description: 'Perpuluhan bulanan',
        createdBy: createdByUserId,
      },
      {
        churchId,
        accountId: account!.id,
        categoryId: findCategory('Persembahan Minggu', 'in').id,
        type: 'in' as const,
        amount: 850_000 + monthIndex * 25_000,
        date: `${month}-12`,
        description: 'Persembahan Minggu',
        createdBy: createdByUserId,
      },
      {
        churchId,
        accountId: account!.id,
        categoryId: findCategory('Operasional', 'out').id,
        type: 'out' as const,
        amount: 450_000,
        date: `${month}-15`,
        description: 'Kebutuhan operasional',
        createdBy: createdByUserId,
      },
      {
        churchId,
        accountId: account!.id,
        categoryId: findCategory('Listrik/Air', 'out').id,
        type: 'out' as const,
        amount: 325_000,
        date: `${month}-18`,
        description: 'Listrik dan air',
        createdBy: createdByUserId,
      },
    );
  });
  await db.insert(transactions).values(txValues);

  // Hubungkan akun demo pelayan & koordinator ke anggota pertama komisi musik.
  const domain = slug.replace('-contoh-sejahtera', '').replace('-contoh-damai', '');
  void domain;
  const linkByEmail = async (email: string, memberId: string | undefined) => {
    if (!memberId) return;
    await db.update(users).set({ memberId }).where(sql`lower(${users.email}) = ${email}`);
  };
  const musikMembers = gmValues.filter((row) => row.groupId === musik.id);
  await linkByEmail(
    slug.startsWith('gki') ? 'pelayan@gki-contoh.test' : '',
    musikMembers[1]?.memberId ?? memberRows[1]!.id,
  );
  await linkByEmail(
    slug.startsWith('gki') ? 'koordinator@gki-contoh.test' : '',
    musikMembers[0]?.memberId ?? memberRows[0]!.id,
  );

  console.warn(`Seed isi gereja ${slug} selesai: ${memberRows.length} anggota.`);
}

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

    // Isi demo per gereja (anggota, komisi, jadwal, transaksi) — idempoten.
    for (const church of demoChurches) {
      const churchId = churchIds.get(church.slug)!;
      const [admin] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.churchId, churchId))
        .orderBy(users.createdAt)
        .limit(1);
      await seedChurchContent(db, churchId, church.slug, admin!.id);
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
