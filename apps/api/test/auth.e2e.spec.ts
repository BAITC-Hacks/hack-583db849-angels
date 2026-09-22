import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { ApiKeyGuard } from '../src/auth/api-key.guard';
import { Roles } from '../src/auth/roles.decorator';
import { RolesGuard } from '../src/auth/roles.guard';
import { AppModule } from '../src/app.module';

@Controller('test-access')
class TestAccessController {
  @Get()
  getAuthenticated(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('admin')
  @Roles('admin')
  getAdminOnly(): { status: 'ok' } {
    return { status: 'ok' };
  }
}

describe('API key access', () => {
  let app: INestApplication;
  const previousKeys = process.env.API_KEYS;

  beforeAll(async () => {
    process.env.API_KEYS = 'platform-key:platform,admin-key:admin';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestAccessController],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalGuards(moduleRef.get(ApiKeyGuard), moduleRef.get(RolesGuard));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (previousKeys === undefined) delete process.env.API_KEYS;
    else process.env.API_KEYS = previousKeys;
  });

  it('allows public health without a key', async () => {
    await request(app.getHttpServer()).get('/v1/health').expect(200);
  });

  it('rejects a missing API key', async () => {
    await request(app.getHttpServer()).get('/v1/test-access').expect(401);
  });

  it('rejects a key whose role is insufficient', async () => {
    await request(app.getHttpServer())
      .get('/v1/test-access/admin')
      .set('X-API-Key', 'platform-key')
      .expect(403);
  });

  it('allows the required role', async () => {
    await request(app.getHttpServer())
      .get('/v1/test-access/admin')
      .set('X-API-Key', 'admin-key')
      .expect(200);
  });
});
