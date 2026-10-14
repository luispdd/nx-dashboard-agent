import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

async function exportOpenApi() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: false }
  );

  app.setGlobalPrefix('api');

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

  const outputPath = resolve(
    process.cwd(),
    'dist/apps/dashboard-api/openapi.json'
  );
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(swaggerDocument, null, 2), 'utf-8');

  console.log(`OpenAPI specification exported to: ${outputPath}`);
  await app.close();
}

exportOpenApi();
