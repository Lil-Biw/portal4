import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // En producción el filesystem es efímero — usar S3/Cloudinary para uploads
  if (process.env.NODE_ENV !== 'production') {
    app.useStaticAssets(path.join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  }

  // Prefix global para todos los endpoints
  app.setGlobalPrefix('api/v1');

  // Validación automática de DTOs con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // elimina campos no declarados en el DTO
      forbidNonWhitelisted: true,
      transform: true,        // convierte tipos automáticamente (string → number, etc.)
    }),
  );

  // CORS — ajustar origins en producción
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  const origin = corsOrigin === '*'
    ? '*'
    : corsOrigin.split(',').map((item) => item.trim()).filter(Boolean);

  app.enableCors({
    origin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Portal API corriendo en http://localhost:${port}/api/v1`);
}

bootstrap();
