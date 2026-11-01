import { z } from 'zod';

/**
 * Skema konfigurasi runtime. Semua konfigurasi lewat environment variable dan
 * divalidasi saat start agar aplikasi gagal cepat bila salah.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_NAME: z.string().trim().min(1).default('Eklesia'),
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z
    .string()
    .trim()
    .refine(
      (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
      'DATABASE_URL harus berupa URL PostgreSQL (postgres:// atau postgresql://).',
    ),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  WEB_DIST_PATH: z.string().trim().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

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
