import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyMultipart from '@fastify/multipart';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import { HttpExceptionFilter } from './app/common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );
  
  await app.register(
    fastifyMultipart as unknown as Parameters<NestFastifyApplication['register']>[0],
    {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100 MB
      },
    }
  );

  app.enableCors();
  
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
  SwaggerModule.setup('api/docs', app, swaggerDocument);

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

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();

