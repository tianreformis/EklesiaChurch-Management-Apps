import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createLogger } from './lib/logger.js';

const logger = createLogger({
  level: 'silent',
  appName: 'Eklesia',
  destination: { write() {} },
});

function buildApp(checkDatabase: () => Promise<void> = async () => undefined) {
  return createApp({ appName: 'Eklesia', logger, checkDatabase });
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
    const app = createApp({
      appName: 'Eklesia',
      logger,
      checkDatabase: async () => undefined,
      webDistPath: webDist,
    });
    const response = await app.request('/assets/app.js');

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('javascript');
    expect(await response.text()).toContain('eklesia');
  });

  it('mengembalikan index.html untuk rute SPA yang dalam', async () => {
    const app = createApp({
      appName: 'Eklesia',
      logger,
      checkDatabase: async () => undefined,
      webDistPath: webDist,
    });
    const response = await app.request('/jemaat/123');

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<div id="root">');
  });

  it('tidak menimpa rute /api yang tidak ada dengan index.html', async () => {
    const app = createApp({
      appName: 'Eklesia',
      logger,
      checkDatabase: async () => undefined,
      webDistPath: webDist,
    });
    const response = await app.request('/api/tidak-ada');

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('application/json');
  });

  it('tetap mengembalikan 404 bila folder build tidak ada', async () => {
    const app = createApp({
      appName: 'Eklesia',
      logger,
      checkDatabase: async () => undefined,
      webDistPath: join(webDist, 'tidak-ada'),
    });
    const response = await app.request('/jemaat');
    expect(response.status).toBe(404);
  });
});
