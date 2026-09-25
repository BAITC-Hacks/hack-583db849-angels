import { ForbiddenException, INestApplication, NotFoundException, StreamableFile, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AI_GATEWAY } from '../src/ai-client/ai-gateway.port';
import { AppModule } from '../src/app.module';
import { ApiKeyGuard } from '../src/auth/api-key.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { contractExample } from '../src/contract-example';
import { PrismaService } from '../src/database/prisma.service';
import { BriefsService } from '../src/modules/briefs/briefs.service';
import { SimulationsService } from '../src/modules/simulations/simulations.service';
import { SimulationAssessmentsService } from '../src/modules/simulation-assessments/simulation-assessments.service';
import { SurpriseService } from '../src/modules/surprise/surprise.service';
import { QualityGuardService } from '../src/modules/quality-guard/quality-guard.service';
import { InterviewsService } from '../src/modules/interviews/interviews.service';

const briefs = {
  startFor: jest.fn().mockResolvedValue(undefined),
  latestFor: jest.fn().mockRejectedValue(new NotFoundException({ code: 'BRIEF_NOT_FOUND', message: 'There is no brief for this candidate yet.' })),
  get: jest.fn(),
  rerun: jest.fn(),
};

const surprise = {
  create: jest.fn().mockImplementation(() => contractExample('surprise-question.created.json')),
  start: jest.fn().mockImplementation(() => contractExample('surprise-question.started.json')),
  answer: jest.fn(),
  get: jest.fn().mockImplementation(() => contractExample('surprise-question.staff.json')),
  video: jest.fn().mockImplementation((_id: string, role: string) => {
    if (role === 'platform') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'This role does not see the video.' });
    return new StreamableFile(Buffer.from('synthetic video'), { type: 'video/webm' });
  }),
};

const quality = {
  interview: jest.fn().mockImplementation(() => contractExample('quality-check-interview.json')),
  calibration: jest.fn().mockImplementation(() => contractExample('quality-check-calibration.json')),
  list: jest.fn().mockResolvedValue({ items: [] }),
  get: jest.fn().mockImplementation(() => contractExample('quality-check-interview.json')),
};

const interviews = {
  create: jest.fn().mockImplementation(() => contractExample('interview.json')),
  recording: jest.fn().mockImplementation(() => ({ ...contractExample<Record<string, unknown>>('interview.json'), transcriptStatus: 'transcribing' })),
  get: jest.fn().mockImplementation(() => contractExample('interview.json')),
  saveScores: jest.fn().mockImplementation(() => contractExample('interviewer-scores.json')),
  createDraft: jest.fn().mockImplementation(() => contractExample('assessment-draft.json')),
  getDraft: jest.fn().mockImplementation(() => contractExample('assessment-draft.json')),
};

describe('PR 1 contract routes', () => {
  let app: INestApplication;
  const candidateId = '00000000-0000-4000-8000-00000000000a';
  const candidateRow = {
    id: candidateId, externalId: 'inv-2026-demo-a', label: 'Candidate A',
    createdAt: new Date('2026-09-23T08:00:00Z'),
    profile: { fullName: 'Synthetic Person', email: 'synthetic@example.test' },
    simulations: [],
    assessments: [],
    briefs: [],
    interviews: [],
  };
  const previousKeys = process.env.API_KEYS;
  const previousDemoMode = process.env.DEMO_MODE;

  beforeAll(async () => {
    process.env.API_KEYS = 'platform-key:platform,interviewer-key:interviewer,commission-key:commission,admin-key:admin';
    process.env.DEMO_MODE = 'false';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SimulationsService)
      .useValue({
        create: jest.fn().mockImplementation(() => contractExample('simulation-created.json')),
        turn: jest.fn().mockImplementation(() => contractExample('simulation-turn.json')),
        complete: jest.fn().mockImplementation(() => contractExample('simulation-completed.json')),
        get: jest.fn().mockImplementation(() => contractExample('simulation-created.json')),
        characterAudio: jest.fn().mockReturnValue(Buffer.from('synthetic audio')),
        accommodation: jest.fn().mockImplementation(() => contractExample('accommodation.json')),
        idempotencyBody: jest.fn().mockReturnValue({ operation: 'simulation.turn' }),
      })
      .overrideProvider(SimulationAssessmentsService)
      .useValue({
        rerun: jest.fn().mockImplementation(() => contractExample('assessment.json')),
        get: jest.fn().mockImplementation(() => contractExample('assessment.json')),
        feedback: jest.fn().mockImplementation(() => contractExample('candidate-feedback.json')),
      })
      .overrideProvider(BriefsService)
      .useValue(briefs)
      .overrideProvider(SurpriseService)
      .useValue(surprise)
      .overrideProvider(QualityGuardService)
      .useValue(quality)
      .overrideProvider(InterviewsService)
      .useValue(interviews)
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
      interview: null, surprise: null, consistency: { before: null, after: null }, accommodation: null,
    } });
    expect(progress.body.assessment).toBeNull();
    expect(JSON.stringify([created.body, listed.body, found.body, progress.body])).not.toContain('Synthetic Person');
    expect(JSON.stringify([created.body, listed.body, found.body, progress.body])).not.toContain('profile');
  });

  it('makes a brief by itself for a new candidate, and keeps briefs from the candidate channel', async () => {
    const server = app.getHttpServer();
    await request(server).post('/v1/candidates').set('X-API-Key', 'platform-key')
      .send({ externalId: 'inv-2026-demo-a', profile: candidateRow.profile, application: { answers: [] }, test: { answers: [] } })
      .expect(201);
    expect(briefs.startFor).toHaveBeenCalledWith(candidateId);

    await request(server).get(`/v1/candidates/${candidateId}/brief`).set('X-API-Key', 'platform-key').expect(403);
    await request(server).get('/v1/briefs/6f1c2a0e-0000-4000-8000-00000000b001').set('X-API-Key', 'platform-key').expect(403);
    await request(server).post('/v1/briefs').set('X-API-Key', 'commission-key').send({ candidateId }).expect(403);
    const missing = await request(server).get(`/v1/candidates/${candidateId}/brief`).set('X-API-Key', 'interviewer-key').expect(404);
    expect(missing.body.error.code).toBe('BRIEF_NOT_FOUND');
  });

  it('lets the candidate channel run the surprise question, and keeps the video for staff', async () => {
    const server = app.getHttpServer();
    const surpriseId = '6f1c2a0e-0000-4000-8000-00000000a007';
    await request(server).post('/v1/surprise-questions').set('X-API-Key', 'platform-key').send({ candidateId }).expect(201);
    await request(server).post(`/v1/surprise-questions/${surpriseId}/start`).set('X-API-Key', 'platform-key').expect(200);
    for (const role of ['interviewer-key', 'commission-key']) {
      await request(server).post('/v1/surprise-questions').set('X-API-Key', role).send({ candidateId }).expect(403);
      await request(server).post(`/v1/surprise-questions/${surpriseId}/start`).set('X-API-Key', role).expect(403);
      await request(server).post(`/v1/surprise-questions/${surpriseId}/answer`).set('X-API-Key', role).expect(403);
      await request(server).get(`/v1/surprise-questions/${surpriseId}`).set('X-API-Key', role).expect(200);
    }
    await request(server).get(`/v1/surprise-questions/${surpriseId}/video`).set('X-API-Key', 'platform-key').expect(403);
    const video = await request(server).get(`/v1/surprise-questions/${surpriseId}/video`).set('X-API-Key', 'interviewer-key').expect(200);
    expect(video.headers['content-type']).toBe('video/webm');
    expect(surprise.video).toHaveBeenCalledWith(surpriseId, 'interviewer');
  });

  it('keeps quality checks to the commission and the admin, and validates the period', async () => {
    const server = app.getHttpServer();
    const interviewId = '6f1c2a0e-0000-4000-8000-00000000a004';
    const period = { interviewerRef: 'interviewer-2', from: '2026-09-01', to: '2026-10-01' };
    for (const role of ['platform-key', 'interviewer-key']) {
      await request(server).post('/v1/quality-checks/interview').set('X-API-Key', role).send({ interviewId }).expect(403);
      await request(server).post('/v1/quality-checks/calibration').set('X-API-Key', role).send(period).expect(403);
      await request(server).get('/v1/quality-checks').set('X-API-Key', role).expect(403);
    }
    await request(server).post('/v1/quality-checks/interview').set('X-API-Key', 'commission-key').send({ interviewId }).expect(201);
    await request(server).post('/v1/quality-checks/calibration').set('X-API-Key', 'admin-key').send(period).expect(201);
    await request(server).get('/v1/quality-checks?kind=calibration&limit=5').set('X-API-Key', 'commission-key').expect(200);
    expect(quality.list).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'calibration', limit: 5 }));
    const invalid = await request(server).post('/v1/quality-checks/calibration').set('X-API-Key', 'admin-key')
      .send({ ...period, from: '1 September' }).expect(400);
    expect(invalid.body.error.fields ?? invalid.body.error.details.fields).toContain('from');
  });

  it('lets the interviewer record and score, the commission only read, and the candidate channel nothing', async () => {
    const server = app.getHttpServer();
    const interviewId = '6f1c2a0e-0000-4000-8000-00000000a004';
    const scores = { scores: { D: 3, R: 2, I: 2, V: null, E: 3 } };
    await request(server).post('/v1/interviews').set('X-API-Key', 'interviewer-key')
      .send({ candidateId, heldAt: '2026-09-26T09:30:00Z', interviewerRef: 'interviewer-2' }).expect(201);
    await request(server).post(`/v1/interviews/${interviewId}/recording`).set('X-API-Key', 'interviewer-key')
      .field('consent', 'true').attach('audio', Buffer.from('synthetic'), 'interview.webm').expect(202);
    await request(server).post(`/v1/interviews/${interviewId}/interviewer-scores`).set('X-API-Key', 'interviewer-key').send(scores).expect(201);
    expect(interviews.saveScores).toHaveBeenLastCalledWith(interviewId, scores.scores, 'interviewer');
    await request(server).post(`/v1/interviews/${interviewId}/assessment-draft`).set('X-API-Key', 'interviewer-key').expect(201);

    for (const path of ['', '/assessment-draft']) {
      await request(server).get(`/v1/interviews/${interviewId}${path}`).set('X-API-Key', 'commission-key').expect(200);
      await request(server).get(`/v1/interviews/${interviewId}${path}`).set('X-API-Key', 'platform-key').expect(403);
    }
    await request(server).post('/v1/interviews').set('X-API-Key', 'commission-key').send({ candidateId, heldAt: '2026-09-26T09:30:00Z' }).expect(403);
    await request(server).post(`/v1/interviews/${interviewId}/interviewer-scores`).set('X-API-Key', 'commission-key').send(scores).expect(403);
    await request(server).post('/v1/interviews').set('X-API-Key', 'platform-key').send({ candidateId, heldAt: '2026-09-26T09:30:00Z' }).expect(403);
    await request(server).post('/v1/interviews').set('X-API-Key', 'interviewer-key').send({ candidateId, heldAt: 'yesterday' }).expect(400);
  });

  it('answers 404, not 500, for an id that is not a UUID', async () => {
    const server = app.getHttpServer();
    const checks = [
      () => request(server).get('/v1/candidates/not-a-uuid').set('X-API-Key', 'commission-key'),
      () => request(server).get('/v1/candidates/not-a-uuid/progress').set('X-API-Key', 'commission-key'),
      () => request(server).put('/v1/candidates/not-a-uuid/accommodations').set('X-API-Key', 'commission-key')
        .send({ textMode: true, reason: 'No microphone' }),
      () => request(server).get('/v1/simulations/preview').set('X-API-Key', 'platform-key'),
      () => request(server).get('/v1/simulation-assessments/preview').set('X-API-Key', 'commission-key'),
      () => request(server).get('/v1/surprise-questions/preview').set('X-API-Key', 'platform-key'),
      () => request(server).get('/v1/surprise-questions/preview/video').set('X-API-Key', 'commission-key'),
      () => request(server).get('/v1/quality-checks/preview').set('X-API-Key', 'commission-key'),
      () => request(server).get('/v1/interviews/preview').set('X-API-Key', 'commission-key'),
      () => request(server).get('/v1/interviews/preview/assessment-draft').set('X-API-Key', 'interviewer-key'),
    ];
    for (const check of checks) {
      const response = await check();
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    }
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
    expect(audio.body).toEqual(Buffer.from('synthetic audio'));
  });

  it('returns the contract validation envelope for malformed requests', async () => {
    const response = await request(app.getHttpServer()).post('/v1/simulations')
      .set('X-API-Key', 'platform-key').send({ candidateId: 'invalid' }).expect(400);
    expect(response.body.error).toEqual({
      code: 'VALIDATION_ERROR', message: expect.any(String),
      details: { fields: ['candidateId'] }, traceId: expect.any(String),
    });
    const multipartText = await request(app.getHttpServer()).post('/v1/simulations/6f1c2a0e-0000-4000-8000-00000000a002/turns')
      .set('X-API-Key', 'platform-key').field('text', 'Text belongs in JSON').expect(400);
    expect(multipartText.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('keeps accommodation access limited to commission and admin', async () => {
    const path = '/v1/candidates/00000000-0000-4000-8000-00000000000a/accommodations';
    const body = { textMode: true, reason: 'Synthetic accessibility request' };
    await request(app.getHttpServer()).put(path).set('X-API-Key', 'platform-key').send(body).expect(403);
    await request(app.getHttpServer()).put(path).set('X-API-Key', 'commission-key').send(body).expect(200)
      .expect(contractExample('accommodation.json'));
  });
  it('serves the assessment example to commission and admin, but not blind or platform roles', async () => {
    const id = '6f1c2a0e-0000-4000-8000-00000000a003';
    const path = `/v1/simulation-assessments/${id}`;
    await request(app.getHttpServer()).get(path).expect(401);
    await request(app.getHttpServer()).get(path).set('X-API-Key', 'platform-key').expect(403);
    await request(app.getHttpServer()).get(path).set('X-API-Key', 'interviewer-key').expect(403);
    await request(app.getHttpServer()).get(path).set('X-API-Key', 'commission-key').expect(200)
      .expect(contractExample('assessment.json'));
    await request(app.getHttpServer()).get(path).set('X-API-Key', 'admin-key').expect(200)
      .expect(contractExample('assessment.json'));
  });

  it('accepts only admin assessment re-runs and validates the simulation id', async () => {
    const path = '/v1/simulation-assessments';
    const simulationId = '6f1c2a0e-0000-4000-8000-00000000a002';
    await request(app.getHttpServer()).post(path).set('X-API-Key', 'commission-key')
      .send({ simulationId }).expect(403);
    await request(app.getHttpServer()).post(path).set('X-API-Key', 'admin-key')
      .send({ simulationId: 'invalid' }).expect(400);
    await request(app.getHttpServer()).post(path).set('X-API-Key', 'admin-key')
      .send({ simulationId }).expect(201).expect(contractExample('assessment.json'));
  });

  it('serves score-free candidate feedback to every authenticated role', async () => {
    const path = '/v1/simulation-assessments/6f1c2a0e-0000-4000-8000-00000000a003/candidate-feedback';
    await request(app.getHttpServer()).get(path).expect(401);
    for (const key of ['platform-key', 'interviewer-key', 'commission-key', 'admin-key']) {
      const response = await request(app.getHttpServer()).get(path).set('X-API-Key', key).expect(200);
      expect(response.body).toEqual(contractExample('candidate-feedback.json'));
      expect(response.body).not.toHaveProperty('scores');
      expect(response.body).not.toHaveProperty('english');
    }
  });

});
