import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

describe('OpenAPI Contract Verification', () => {
  let app: NestFastifyApplication;
  let openApiSpec: { paths: Record<string, unknown> };

  beforeAll(async () => {
    // 1. Verify openapi.json exists and parse it
    let currentDir = process.cwd();
    while (
      currentDir !== '/' &&
      !existsSync(resolve(currentDir, 'dist/apps/dashboard-api/openapi.json'))
    ) {
      const parent = resolve(currentDir, '..');
      if (parent === currentDir) break;
      currentDir = parent;
    }
    const specPath = resolve(
      currentDir,
      'dist/apps/dashboard-api/openapi.json'
    );
    expect(existsSync(specPath)).toBe(true);
    openApiSpec = JSON.parse(readFileSync(specPath, 'utf-8'));

    // 2. Initialize NestJS with Fastify and matching production setup
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    );

    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should declare all core endpoints in OpenAPI paths', () => {
    const paths = Object.keys(openApiSpec.paths);
    expect(paths).toContain('/api/metrics');
    expect(paths).toContain('/api/devices');
    expect(paths).toContain('/api/series');
    expect(paths).toContain('/api/stats');
    expect(paths).toContain('/api/database/status');
  });

  it('should verify /api/metrics response matches contract', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    for (const item of body) {
      expect(typeof item.metric_key).toBe('string');
      expect(typeof item.unit).toBe('string');
      expect(item.metric_key.length).toBeGreaterThan(0);
      expect(item.unit.length).toBeGreaterThan(0);
    }
  });

  it('should verify /api/devices response matches contract', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/devices',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    for (const device of body) {
      expect(typeof device).toBe('string');
    }
  });

  it('should verify /api/series response matches contract with sparse UTC points', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/series?metric=temperature&bucket=1h',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    expect(body.metric).toBe('temperature');
    expect(body.unit).toBe('°C');
    expect(body.bucket).toBe('1h');
    expect(Array.isArray(body.series)).toBe(true);
    expect(body.series.length).toBeGreaterThan(0);

    for (const s of body.series) {
      expect(typeof s.device_id).toBe('string');
      expect(Array.isArray(s.points)).toBe(true);
      for (const p of s.points) {
        expect(p.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        expect(typeof p.value).toBe('number');
      }
    }
  });

  it('should verify /api/stats response matches contract with statistical fields', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/stats?metric=temperature',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    expect(body.metric).toBe('temperature');
    expect(body.unit).toBe('°C');
    expect(Array.isArray(body.stats)).toBe(true);
    expect(body.stats.length).toBeGreaterThan(0);

    for (const s of body.stats) {
      expect(typeof s.device_id).toBe('string');
      expect(typeof s.count).toBe('number');
      expect(typeof s.missing_ratio).toBe('number');
      expect(s.missing_ratio).toBeGreaterThanOrEqual(0);
      expect(s.missing_ratio).toBeLessThanOrEqual(1);

      if (s.count > 0) {
        expect(typeof s.min).toBe('number');
        expect(typeof s.max).toBe('number');
        expect(typeof s.mean).toBe('number');
        expect(typeof s.std).toBe('number');
      }
    }
  });

  it('should verify bad request error formatting matches contract', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/series?metric=invalid_metric',
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.statusCode).toBe(400);
    expect(body.code).toBe('BAD_REQUEST');
    expect(typeof body.message).toBe('string');
  });

  it('should verify /api/database/status response matches contract', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/database/status',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(typeof body.isDemo).toBe('boolean');
    expect(typeof body.readingCount).toBe('number');
    expect(typeof body.deviceCount).toBe('number');
    expect(
      body.lastImportedAt === null || typeof body.lastImportedAt === 'string'
    ).toBe(true);
  });
});

