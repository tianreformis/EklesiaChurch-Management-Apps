import { defineConfig } from '@playwright/test';

/**
 * E2E alur kritis melawan aplikasi produksi lokal (Docker, satu origin).
 * Prasyarat: `docker compose up -d` sehat dan `pnpm db:seed` sudah jalan.
 * Memakai Chrome yang terpasang (channel chrome) agar tidak mengunduh browser.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    channel: 'chrome',
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'desktop', use: { viewport: { width: 1280, height: 800 } } }],
});
