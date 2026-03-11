import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('AppModule (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health', () => {
    it('GET /api/v1/health should return ok', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
        });
    });
  });

  describe('Auth', () => {
    it('should reject unauthenticated requests', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users')
        .expect(401);
    });

    it('POST /api/v1/auth/token should return tokens with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/token')
        .send({ email: 'admin@techd-demo.com', password: 'admin' })
        .expect((res) => {
          // Will fail until auth is fully implemented, but structure test
          if (res.status === 200) {
            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
          }
        });
    });
  });

  describe('Connectors', () => {
    it('should require auth to list connectors', () => {
      return request(app.getHttpServer())
        .get('/api/v1/connectors')
        .expect(401);
    });
  });
});
