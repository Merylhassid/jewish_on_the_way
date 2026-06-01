import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';

const parseCorsOrigins = () =>
  (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // req 9.1.2 / 13.3 — HTTPS enforcement + security headers
  app.use((req: any, res: any, next: () => void) => {
    // In production, redirect plain HTTP requests to HTTPS
    if (
      process.env.NODE_ENV === 'production' &&
      req.headers['x-forwarded-proto'] === 'http'
    ) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  const isProduction = process.env.NODE_ENV === 'production';

  app.enableCors({
    origin: isProduction ? parseCorsOrigins() : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Swagger API docs — http://host:port/api
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Jewish On The Way — API')
    .setDescription('Backend API for kosher restaurants, synagogues, minyans and Shabbat hosting worldwide')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`✅ Server running on http://localhost:${port}`);
}
bootstrap();
