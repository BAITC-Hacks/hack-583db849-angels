import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AI_GATEWAY } from '../src/ai-client/ai-gateway.port';
import { AppModule } from '../src/app.module';
import { ApiKeyGuard } from '../src/auth/api-key.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { contractExample } from '../src/contract-example';
import { PrismaService } from '../src/database/prisma.service';

describe('PR 1 contract routes', () => {
  let app: INestApplication;
  const candidateId = '00000000-0000-4000-8000-00000000000a';
  const candidateRow = {
    id: candidateId, externalId: 'inv-2026-demo-a', label: 'Candidate A',
    createdAt: new Date('2026-09-23T08:00:00Z'),
    profile: { fullName: 'Synthetic Person', email: 'synthetic@example.test' },
    simulations: [],
  };
  const previousKeys = process.env.API_KEYS;
  const previousDemoMode = process.env.DEMO_MODE;

  beforeAll(async () => {
    process.env.API_KEYS = 'platform-key:platform,interviewer-key:interviewer,commission-key:commission,admin-key:admin';
    process.env.DEMO_MODE = 'false';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        candidate: {
          upsert: jest.fn().mockResolvedValue(candidateRow),
          findMany: jest.fn().mockResolvedValue([candidateRow]),
          findUnique: jest.fn().mockResolvedValue(candidateRow),
        },
        simulation: { groupBy: jest.fn().mockResolvedValue([{ scenarioId: 'conflict-resolution', _count: { _all: 1 } }]) },
        auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
      })
      .overrideProvider(AI_GATEWAY)
      .useValue({ scenarios: jest.fn().mockResolvedValue([
        { scenarioId: 'conflict-resolution', title: 'A teammate is about to walk away', status: 'ready' },
      ]) })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalGuards(moduleRef.get(ApiKeyGuard), moduleRef.get(RolesGuard));
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (previousKeys === undefined) delete process.env.API_KEYS;
    else process.env.API_KEYS = previousKeys;
    if (previousDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previousDemoMode;
  });

  it('protects the scenarios list and fills its summary from the ML gateway', async () => {
    const unauthorized = await request(app.getHttpServer()).get('/v1/scenarios').expect(401);
    expect(unauthorized.body.error).toEqual({
      code: 'UNAUTHORIZED', message: expect.any(String), details: {}, traceId: expect.any(String),
    });
    const forbidden = await request(app.getHttpServer()).get('/v1/scenarios').set('X-API-Key', 'platform-key').expect(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
    const response = await request(app.getHttpServer()).get('/v1/scenarios').set('X-API-Key', 'interviewer-key').expect(200);
    expect(response.body).toEqual(contractExample('scenarios.json'));
  });

  it('never exposes profile data in candidate responses or progress', async () => {
    const snapshot = {
      externalId: 'inv-2026-demo-a', profile: candidateRow.profile,
      application: { answers: [] }, test: { answers: [] },
    };
    const created = await request(app.getHttpServer()).post('/v1/candidates').set('X-API-Key', 'platform-key')
      .send(snapshot).expect(201);
    const listed = await request(app.getHttpServer()).get('/v1/candidates?include=progress').set('X-API-Key', 'platform-key').expect(200);
    const found = await request(app.getHttpServer()).get(`/v1/candidates/${candidateId}`).set('X-API-Key', 'platform-key').expect(200);
    const progress = await request(app.getHttpServer()).get(`/v1/candidates/${candidateId}/progress`)
      .set('X-API-Key', 'interviewer-key').expect(200);

    expect(created.body).toEqual({ candidateId, externalId: candidateRow.externalId, label: 'Candidate A', createdAt: candidateRow.createdAt.toISOString() });
    expect(found.body).toEqual(created.body);
    expect(listed.body.items[0]).toEqual({ ...created.body, progress: {
      candidateId, label: 'Candidate A', brief: null, simulation: null, assessment: null,
      interview: null, surprise: null, consistency: { before: null, after: null },
    } });
    expect(progress.body.assessment).toBeNull();
    expect(JSON.stringify([created.body, listed.body, found.body, progress.body])).not.toContain('Synthetic Person');
    expect(JSON.stringify([created.body, listed.body, found.body, progress.body])).not.toContain('profile');
  });

  it('serves simulation contract examples without creating a simulation', async () => {
    const id = '6f1c2a0e-0000-4000-8000-00000000a002';
    const created = await request(app.getHttpServer()).post('/v1/simulations').set('X-API-Key', 'platform-key')
      .send({ candidateId }).expect(201);
    expect(created.body).toEqual(contractExample('simulation-created.json'));

    const turn = await request(app.getHttpServer()).post(`/v1/simulations/${id}/turns`).set('X-API-Key', 'platform-key')
      .send({ text: 'Contract preview' }).expect(200);
    expect(turn.body).toEqual(contractExample('simulation-turn.json'));

    const completed = await request(app.getHttpServer()).post(`/v1/simulations/${id}/complete`).set('X-API-Key', 'platform-key')
      .send({ reason: 'stopped' }).expect(200);
    expect(completed.body).toEqual(contractExample('simulation-completed.json'));
    await request(app.getHttpServer()).get(`/v1/simulations/${id}`).set('X-API-Key', 'platform-key').expect(200)
      .expect(contractExample('simulation-created.json'));
    const audio = await request(app.getHttpServer()).get(`/v1/simulations/${id}/turns/turn_03/audio`)
      .set('X-API-Key', 'platform-key').expect(200);
    expect(audio.headers['content-type']).toMatch(/^audio\/mpeg/);
  });

  it('returns the contract validation envelope for malformed requests', async () => {
    const response = await request(app.getHttpServer()).post('/v1/simulations')
      .set('X-API-Key', 'platform-key').send({ candidateId: 'invalid' }).expect(400);
    expect(response.body.error).toEqual({
      code: 'VALIDATION_ERROR', message: expect.any(String),
      details: { fields: ['candidateId'] }, traceId: expect.any(String),
    });
  });

  it('keeps accommodation access limited to commission and admin', async () => {
    const path = '/v1/candidates/00000000-0000-4000-8000-00000000000a/accommodations';
    const body = { textMode: true, reason: 'Synthetic accessibility request' };
    await request(app.getHttpServer()).put(path).set('X-API-Key', 'platform-key').send(body).expect(403);
    await request(app.getHttpServer()).put(path).set('X-API-Key', 'commission-key').send(body).expect(200)
      .expect(contractExample('accommodation.json'));
  });
});
