import { z } from 'zod';

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional();

/**
 * Skema konfigurasi runtime. Semua konfigurasi lewat environment variable dan
 * divalidasi saat start agar aplikasi gagal cepat bila salah.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_NAME: z.string().trim().min(1).default('Eklesia'),
  APP_BASE_URL: z.string().trim().url().default('http://localhost:5173'),
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),

  /** Koneksi aplikasi (peran terbatas, RLS aktif). */
  DATABASE_URL: z
    .string()
    .trim()
    .refine(
      (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
      'DATABASE_URL harus berupa URL PostgreSQL (postgres:// atau postgresql://).',
    ),
  /** Koneksi pemilik skema untuk migrasi/seed (melewati RLS). */
  MIGRATION_DATABASE_URL: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || value.startsWith('postgres://') || value.startsWith('postgresql://'),
      'MIGRATION_DATABASE_URL harus berupa URL PostgreSQL.',
    )
    .optional(),
  APP_DB_USER: z.string().trim().min(1).default('eklesia_app'),
  APP_DB_PASSWORD: optionalString,

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  WEB_DIST_PATH: optionalString,

  SESSION_COOKIE_NAME: z.string().trim().min(1).default('eklesia_session'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),

  /** Pengaturan SMTP opsional. Tanpa SMTP, undangan dikirim manual oleh admin. */
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM: optionalString,
});

export type Env = z.infer<typeof envSchema>;

/** Konfigurasi minimum yang dibutuhkan lapisan aplikasi (mudah diuji). */
export type AppConfig = Pick<
  Env,
  'APP_NAME' | 'APP_BASE_URL' | 'SESSION_COOKIE_NAME' | 'SESSION_TTL_DAYS' | 'NODE_ENV'
>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Konfigurasi environment tidak valid:\n- ${issues.join('\n- ')}`);
    this.name = 'EnvValidationError';
  }
}

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return result.data;
}

/**
 * Dipakai di entrypoint: cetak kesalahan konfigurasi lalu hentikan proses.
 * Tidak pernah mencetak nilai env karena bisa berisi kredensial.
 */
export function loadEnvOrExit(source: NodeJS.ProcessEnv = process.env): Env {
  try {
    return parseEnv(source);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}
