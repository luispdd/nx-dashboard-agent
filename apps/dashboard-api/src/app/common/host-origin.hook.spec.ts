import Fastify, { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerHostOriginHook } from './host-origin.hook';

describe('registerHostOriginHook', () => {
  let app: FastifyInstance;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.ALLOWED_ORIGINS = 'http://localhost:4200,http://127.0.0.1:4200';
    process.env.ALLOWED_HOSTS = 'localhost:3000,127.0.0.1:3000';

    app = Fastify();
    registerHostOriginHook(app);
    app.get('/test', async () => ({ status: 'ok' }));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    process.env = { ...originalEnv };
  });

  it('allows request with valid Host and valid Origin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:4200',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('allows request without Origin header (curl / server-to-server)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        host: '127.0.0.1:3000',
      },
    });

    expect(res.statusCode).toBe(200);
  });

  it('rejects foreign origin with 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        host: 'localhost:3000',
        origin: 'http://malicious.website.example',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('http://malicious.website.example');
  });

  it('rejects unrecognized Host with 403 Forbidden (DNS rebinding protection)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        host: 'evil-rebind.attacker.com',
        origin: 'http://localhost:4200',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('evil-rebind.attacker.com');
  });
});
