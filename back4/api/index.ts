import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import express from 'express';
import type { Request, Response } from 'express';

const server = express();
let isBootstrapped = false;

async function bootstrap() {
  if (isBootstrapped) return;
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn'],
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // CORS manejado en el handler de Vercel antes de llegar a NestJS

  await app.init();
  isBootstrapped = true;
}

export default async (req: Request, res: Response) => {
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  const allowedOrigins = corsOrigin === '*' ? null : corsOrigin.split(',').map(s => s.trim());
  const requestOrigin = req.headers['origin'] as string | undefined;

  const originToSet =
    !allowedOrigins ? '*' :
    requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : '';

  if (originToSet) {
    res.setHeader('Access-Control-Allow-Origin', originToSet);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  await bootstrap();
  server(req, res);
};
