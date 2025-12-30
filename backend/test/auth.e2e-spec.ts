import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth Register (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject invalid email', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'badmail',
        password: '123456',
        firstName: 'Meryl',
        lastName: 'Hassid',
      })
      .expect(400);
  });

  it('should reject short password', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test_short@mail.com',
        password: '123',
        firstName: 'Meryl',
        lastName: 'Hassid',
      })
      .expect(400);
  });

  it('should reject non-letter firstName', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test_name@mail.com',
        password: '123456',
        firstName: 'Mer1l',
        lastName: 'Hassid',
      })
      .expect(400);
  });

  it('should create user with valid input', async () => {
    const email = `test_${Date.now()}@mail.com`;

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: '123456',
        firstName: 'Meryl',
        lastName: 'Hassid',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.email).toBe(email);
    expect(res.body).not.toHaveProperty('password_hash');
    expect(res.body).not.toHaveProperty('password');
  });

  it('should reject duplicate email', async () => {
    const email = `dup_${Date.now()}@mail.com`;

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: '123456',
        firstName: 'Meryl',
        lastName: 'Hassid',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: '123456',
        firstName: 'Meryl',
        lastName: 'Hassid',
      })
      .expect(400);
  });
});
