import { test, expect } from '@playwright/test';

test.describe('Live Backend API Services Suite', () => {
  test.describe('Dashboard API (NestJS)', () => {
    test('should return root status message', async ({ request }) => {
      const response = await request.get('http://localhost:3000/api');
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ message: 'Hello API' });
    });

    test('should retrieve active devices catalog', async ({ request }) => {
      const response = await request.get('http://localhost:3000/api/devices');
      expect(response.status()).toBe(200);
      const devices = await response.json();
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBeGreaterThan(0);
      expect(typeof devices[0]).toBe('string');
    });

    test('should retrieve metrics catalog with units', async ({ request }) => {
      const response = await request.get('http://localhost:3000/api/metrics');
      expect(response.status()).toBe(200);
      const metrics = await response.json();
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0]).toHaveProperty('metric_key');
      expect(metrics[0]).toHaveProperty('unit');
    });
  });

  test.describe('Agent Service (FastAPI)', () => {
    test('should return health status and active configuration', async ({ request }) => {
      const response = await request.get('http://localhost:8000/health');
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('provider');
      expect(body).toHaveProperty('model');
      expect(body).toHaveProperty('active_sessions');
      // Ensure secrets are never leaked
      expect(body).not.toHaveProperty('api_key');
      const text = await response.text();
      expect(text).not.toContain('super-secret');
    });

    test('should support CORS headers for frontend origins', async ({ request }) => {
      const response = await request.get('http://localhost:8000/health', {
        headers: {
          Origin: 'http://localhost:4200',
        },
      });
      expect(response.status()).toBe(200);
      expect(response.headers()['access-control-allow-origin']).toBe('http://localhost:4200');
      expect(response.headers()['access-control-allow-credentials']).toBe('true');
    });
  });
});
