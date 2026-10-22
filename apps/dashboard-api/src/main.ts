import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyMultipart from '@fastify/multipart';
import helmet from '@fastify/helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import { HttpExceptionFilter } from './app/common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );

  await app.register(
    helmet as unknown as Parameters<NestFastifyApplication['register']>[0],
    {
      contentSecurityPolicy: false,
    }
  );
  
  await app.register(
    fastifyMultipart as unknown as Parameters<NestFastifyApplication['register']>[0],
    {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100 MB
      },
    }
  );

  const { getSecurityConfig } = await import('./app/common/security.config');
  const { registerHostOriginHook } = await import(
    './app/common/host-origin.hook'
  );
  const securityConfig = getSecurityConfig();

  registerHostOriginHook(app.getHttpAdapter().getInstance());

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || securityConfig.allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin '${origin}' not allowed by CORS`), false);
      }
    },
    credentials: true,
  });
  
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('IoT Dashboard API')
    .setDescription('Read-only API for IoT measurements and device metrics')
    .setVersion('1.0')
    .addTag('metrics')
    .addTag('devices')
    .addTag('series')
    .addTag('stats')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  if (securityConfig.swaggerEnabled) {
    SwaggerModule.setup('api/docs', app, swaggerDocument);
  }

  if (process.env.EXPORT_OPENAPI === 'true') {
    const fs = await import('fs');
    const path = await import('path');
    const outputPath = path.resolve(
      process.cwd(),
      'dist/apps/dashboard-api/openapi.json'
    );
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(
      outputPath,
      JSON.stringify(swaggerDocument, null, 2),
      'utf-8'
    );
    Logger.log(`📄 OpenAPI specification exported to: ${outputPath}`);
    await app.close();
    process.exit(0);
  }

  const port = securityConfig.port;
  const host = securityConfig.host;

  if (!securityConfig.isLoopbackOnly) {
    Logger.warn(
      `⚠️  Security Warning: API is binding to non-loopback address '${host}'. This service is exposed to the network.`
    );
  }

  await app.listen(port, host);
  Logger.log(
    `🚀 Application is running on: http://${host}:${port}/${globalPrefix}`
  );
}

bootstrap();

