import { describe, it, expect, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../app.module';

describe('Security Headers & Swagger Toggle', () => {
  let app: NestFastifyApplication;

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should emit standard security headers and omit x-powered-by', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    );

    await app.register(
      helmet as unknown as Parameters<NestFastifyApplication['register']>[0],
      {
        contentSecurityPolicy: false,
      }
    );

    app.setGlobalPrefix('api');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/api',
      headers: {
        host: 'localhost:3000',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('should return 404 for /api/docs when SwaggerModule is not setup', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const disabledApp = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    );

    disabledApp.setGlobalPrefix('api');
    await disabledApp.init();
    await disabledApp.getHttpAdapter().getInstance().ready();

    const response = await disabledApp.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/api/docs',
      headers: {
        host: 'localhost:3000',
      },
    });

    expect(response.statusCode).toBe(404);
    await disabledApp.close();
  });

  it('should return 200/302 for /api/docs when SwaggerModule is setup', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const enabledApp = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    );

    enabledApp.setGlobalPrefix('api');
    const mockDoc: OpenAPIObject = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0' },
      paths: {},
    };
    SwaggerModule.setup('api/docs', enabledApp, mockDoc);

    await enabledApp.init();
    await enabledApp.getHttpAdapter().getInstance().ready();

    const response = await enabledApp.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/api/docs',
      headers: {
        host: 'localhost:3000',
      },
    });

    expect([200, 302]).toContain(response.statusCode);
    await enabledApp.close();
  });
});
