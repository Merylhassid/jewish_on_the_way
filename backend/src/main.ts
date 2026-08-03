import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import * as express from 'express';

const parseCorsOrigins = () =>
  (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  // Production traffic reaches Nest through the local Nginx reverse proxy.
  // Trust exactly that single hop so req.ip and HTTPS detection use the
  // forwarded values without accepting an arbitrary proxy chain.
  if (isProduction) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

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

  app.enableCors({
    origin: isProduction ? parseCorsOrigins() : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Jewish On The Way — API')
      .setDescription('Backend API for kosher restaurants, synagogues, minyans and Shabbat hosting worldwide')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);
  }

  const port = Number(process.env.PORT) || 3001;
  const host = process.env.HOST?.trim() || '0.0.0.0';
  await app.listen(port, host);

  console.log(`✅ Server running on http://${host}:${port}`);
}
bootstrap();
