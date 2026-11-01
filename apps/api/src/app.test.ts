import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, type AppDependencies } from './app.js';
import type { Database } from './db/client.js';
import type { AppConfig } from './lib/env.js';
import { createLogger } from './lib/logger.js';
import type { Mailer } from './lib/mailer.js';

const logger = createLogger({
  level: 'silent',
  appName: 'Eklesia',
  destination: { write() {} },
});

const env: AppConfig = {
  APP_NAME: 'Eklesia',
  APP_BASE_URL: 'http://localhost:5173',
  SESSION_COOKIE_NAME: 'eklesia_session',
  SESSION_TTL_DAYS: 7,
  NODE_ENV: 'test',
};

const mailer: Mailer = {
  isConfigured: false,
  send: async () => undefined,
};

// Aplikasi tidak menyentuh database pada rute yang diuji di berkas ini.
const db = {} as Database;

function buildApp(
  checkDatabase: () => Promise<void> = async () => undefined,
  webDistPath?: string,
) {
  const deps: AppDependencies = {
    appName: 'Eklesia',
    logger,
    db,
    systemDb: db,
    env,
    mailer,
    checkDatabase,
    ...(webDistPath ? { webDistPath } : {}),
  };
  return createApp(deps);
}

describe('GET /api/health', () => {
  it('menjawab 200 ketika database sehat', async () => {
    const app = buildApp();
    const response = await app.request('/api/health');

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(body.database).toBe('ok');
    expect(body.app).toBe('Eklesia');
    expect(typeof body.checkedAt).toBe('string');
  });

  it('menjawab 503 ketika database tidak dapat dihubungi', async () => {
    const app = buildApp(async () => {
      throw new Error('connection refused');
    });
    const response = await app.request('/api/health');

    expect(response.status).toBe(503);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe('degraded');
    expect(JSON.stringify(body)).not.toContain('connection refused');
  });

  it('menyertakan X-Request-Id pada setiap respons', async () => {
    const app = buildApp();
    const response = await app.request('/api/health');
    expect(response.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('mengirim header keamanan dan CSP ketat', async () => {
    const app = buildApp();
    const response = await app.request('/api/health');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });
});

describe('rute API yang tidak dikenal', () => {
  it('mengembalikan 404 JSON, bukan HTML', async () => {
    const app = buildApp();
    const response = await app.request('/api/tidak-ada');

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('penyajian SPA (mode produksi)', () => {
  let webDist: string;

  beforeAll(() => {
    webDist = mkdtempSync(join(tmpdir(), 'eklesia-web-'));
    mkdirSync(join(webDist, 'assets'));
    writeFileSync(
      join(webDist, 'index.html'),
      '<!doctype html><html lang="id"><body><div id="root"></div></body></html>',
    );
    writeFileSync(join(webDist, 'assets', 'app.js'), 'console.log("eklesia");');
  });

  afterAll(() => {
    rmSync(webDist, { recursive: true, force: true });
  });

  it('menyajikan aset statis dengan content-type yang benar', async () => {
    const app = buildApp(undefined, webDist);
    const response = await app.request('/assets/app.js');

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('javascript');
    expect(await response.text()).toContain('eklesia');
  });

  it('mengembalikan index.html untuk rute SPA yang dalam', async () => {
    const app = buildApp(undefined, webDist);
    const response = await app.request('/jemaat/123');

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<div id="root">');
  });

  it('tidak menimpa rute /api yang tidak ada dengan index.html', async () => {
    const app = buildApp(undefined, webDist);
    const response = await app.request('/api/tidak-ada');

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('application/json');
  });

  it('tetap mengembalikan 404 bila folder build tidak ada', async () => {
    const app = buildApp(undefined, join(webDist, 'tidak-ada'));
    const response = await app.request('/jemaat');
    expect(response.status).toBe(404);
  });
});
