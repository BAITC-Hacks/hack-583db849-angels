#!/usr/bin/env node
/**
 * The whole pitch path, against a running stack, through the public API only.
 *
 *   API=http://localhost:3001/v1 node scripts/e2e/pitch-path.mjs
 *
 * The stack runs with DEMO_MODE=true and GATEWAY_MODE=replay, so it costs
 * nothing and needs no network. The API keys default to the local ones in
 * `.env.example`; set E2E_KEY_PLATFORM, E2E_KEY_INTERVIEWER,
 * E2E_KEY_COMMISSION and E2E_KEY_ADMIN for another stack.
 *
 * For each of A, B and C: the brief, the simulation from its recording and
 * the report, the candidate's feedback without a score, a surprise question
 * written from their own application, the interview with
 * the draft locked until the blind scores, the consistency after the
 * interview, the interview's quality check — and the commission's
 * calibration after each. Then an applicant arrives from the platform (the
 * stand's hand-over) and a demo reset takes them away again.
 *
 * The surprise answer and the video presentation are transcribed from their
 * audio, and a replayed transcription only matches audio cut by the same
 * ffmpeg that recorded it. They run when E2E_MEDIA_DIR names a folder with
 * `answer.webm` and `presentation.webm` recorded on this stack.
 *
 * Exits 1 when a step fails, listing every failure.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const API = (process.env.API ?? 'http://localhost:3001/v1').replace(/\/+$/, '');
const SEED = process.env.E2E_SEED_DIR ?? join(ROOT, 'seed');
const MEDIA = process.env.E2E_MEDIA_DIR ?? null;
const keys = {
  platform: process.env.E2E_KEY_PLATFORM ?? 'local-platform',
  interviewer: process.env.E2E_KEY_INTERVIEWER ?? 'local-interviewer',
  commission: process.env.E2E_KEY_COMMISSION ?? 'local-commission',
  admin: process.env.E2E_KEY_ADMIN ?? 'local-admin',
};
const failures = [];

async function call(role, method, path, body, { form, expect } = {}) {
  const headers = { 'X-API-Key': keys[role] };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(API + path, { method, headers, body: payload });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (expect && !expect.includes(response.status)) throw new Error(`${method} ${path} → ${response.status} ${text.slice(0, 200)}`);
  return { status: response.status, data };
}

async function until(what, check, seconds = 60) {
  for (let i = 0; i < seconds * 2; i += 1) {
    const value = await check();
    if (value) return value;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`timed out waiting for ${what}`);
}

async function step(name, fn) {
  try {
    const note = await fn();
    console.log(`  ✓ ${name}${note ? ` — ${note}` : ''}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.log(`  ✗ ${name} — ${error.message}`);
  }
}

const seed = (letter, name) => JSON.parse(readFileSync(join(SEED, 'candidates', letter, name), 'utf8'));
const progress = async (id) => (await call('admin', 'GET', `/candidates/${id}/progress`, undefined, { expect: [200] })).data;
const media = (name) => (MEDIA && existsSync(join(MEDIA, name)) ? new Blob([readFileSync(join(MEDIA, name))], { type: 'video/webm' }) : null);
// Three seconds of 16 kHz mono silence: the recording an interview needs. In DEMO_MODE the seed's transcript stands in for it.
function silence() {
  const samples = 3 * 16000;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + samples * 2, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(16000, 24); buffer.writeUInt32LE(32000, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  return new Blob([buffer], { type: 'audio/wav' });
}
const canonical = (value) => JSON.stringify(value, (key, item) => (item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort()) : item));

async function calibrate(when) {
  await step(`calibration ${when}`, async () => {
    const day = 86_400_000;
    const from = new Date(Date.now() - 30 * day).toISOString().slice(0, 10);
    const to = new Date(Date.now() + day).toISOString().slice(0, 10);
    const check = (await call('commission', 'POST', '/quality-checks/calibration', { interviewerRef: 'synthetic-interviewer-a', from, to }, { expect: [201] })).data;
    return `${check.signals.length} signals, ${check.interviews} interviews`;
  });
}

console.log(`Pitch path against ${API}${MEDIA ? ', with media' : ''}`);
await call('admin', 'POST', '/demo/reset', undefined, { expect: [204] });
await calibrate('after the reset');
const list = (await call('admin', 'GET', '/candidates?include=progress', undefined, { expect: [200] })).data.items;
const questions = {};

for (const letter of ['a', 'b', 'c']) {
  const candidate = list.find((item) => item.label === `Candidate ${letter.toUpperCase()}`);
  console.log(`Candidate ${letter.toUpperCase()}`);
  if (!candidate) {
    failures.push(`candidate ${letter.toUpperCase()} is not seeded`);
    continue;
  }
  const id = candidate.candidateId;

  await step('brief', async () => {
    await until('brief', async () => (await progress(id)).brief?.status === 'ready');
    const brief = (await call('interviewer', 'GET', `/candidates/${id}/brief`, undefined, { expect: [200] })).data;
    return `${brief.questions.length} questions`;
  });

  await step('simulation from the recording, the report, and feedback without a score', async () => {
    await call('commission', 'POST', '/demo/recorded-session', { candidateId: id }, { expect: [200] });
    const assessmentId = await until('assessment', async () => {
      const p = await progress(id);
      return p.assessment?.status === 'ready' && p.assessment.assessmentId;
    });
    const report = (await call('commission', 'GET', `/simulation-assessments/${assessmentId}`, undefined, { expect: [200] })).data;
    const feedback = (await call('platform', 'GET', `/simulation-assessments/${assessmentId}/candidate-feedback`, undefined, { expect: [200] })).data;
    if (/"score"|"scores"|"confidence"/.test(JSON.stringify(feedback))) throw new Error('the candidate’s feedback carries a score');
    return report.scores.map((s) => `${s.competency}${s.score ?? '·'}`).join(' ');
  });

  let surpriseId;
  await step('surprise question, written from the candidate’s own application', async () => {
    surpriseId = (await call('platform', 'POST', '/surprise-questions', { candidateId: id }, { expect: [201] })).data.surpriseId;
    const started = (await call('platform', 'POST', `/surprise-questions/${surpriseId}/start`, undefined, { expect: [200, 201] })).data;
    if (!started.question || started.question.split(/\s+/).length > 40) throw new Error(`not a question to answer in 90 seconds: ${started.question}`);
    questions[letter] = started.question;
    return started.question.split(/\s+/).length + ' words';
  });

  if (media('answer.webm') && surpriseId) {
    await step('surprise question, answered on video', async () => {
      const created = { surpriseId };
      const form = new FormData();
      form.append('consentVideo', 'true');
      form.append('consentProcessing', 'true');
      form.append('video', media('answer.webm'), 'answer.webm');
      await call('platform', 'POST', `/surprise-questions/${created.surpriseId}/answer`, undefined, { form, expect: [202] });
      await until('surprise transcript', async () => (await call('interviewer', 'GET', `/surprise-questions/${created.surpriseId}`, undefined, { expect: [200] })).data.status === 'answered');
    });
  }
  if (media('presentation.webm')) {
    await step('video presentation', async () => {
      const form = new FormData();
      form.append('candidateId', id);
      form.append('consentVideo', 'true');
      form.append('consentProcessing', 'true');
      form.append('video', media('presentation.webm'), 'presentation.webm');
      const sent = (await call('platform', 'POST', '/presentations', undefined, { form, expect: [202] })).data;
      await until('presentation transcript', async () => (await call('interviewer', 'GET', `/presentations/${sent.presentationId}`, undefined, { expect: [200] })).data.status === 'ready');
    });
  }

  let interviewId;
  await step('interview recorded, transcribed as the seed', async () => {
    interviewId = (await call('interviewer', 'POST', '/interviews', { candidateId: id, heldAt: new Date().toISOString(), interviewerRef: 'synthetic-interviewer-a' }, { expect: [201] })).data.interviewId;
    const form = new FormData();
    form.append('consent', 'true');
    form.append('audio', silence(), 'interview.wav');
    await call('interviewer', 'POST', `/interviews/${interviewId}/recording`, undefined, { form, expect: [202] });
    const interview = await until('interview transcript', async () => {
      const data = (await call('interviewer', 'GET', `/interviews/${interviewId}`, undefined, { expect: [200] })).data;
      if (data.transcriptStatus === 'failed') throw new Error('transcription failed');
      return data.transcriptStatus === 'ready' ? data : null;
    });
    const expected = seed(letter, 'interview-transcript.json');
    if (canonical(interview.transcript.map((turn) => turn.text)) !== canonical(expected.map((turn) => turn.text))) throw new Error('transcript differs from the seed');
    return `${interview.transcript.length} turns`;
  });

  await step('the draft stays locked until the blind scores, then matches the seed', async () => {
    const locked = await call('interviewer', 'GET', `/interviews/${interviewId}/assessment-draft`);
    if (locked.status !== 409) throw new Error(`the draft was readable before the scores: ${locked.status}`);
    await call('interviewer', 'POST', `/interviews/${interviewId}/interviewer-scores`, { scores: seed(letter, 'interviewer-scores.json').scores }, { expect: [201] });
    const draft = await until('draft', async () => {
      const response = await call('interviewer', 'GET', `/interviews/${interviewId}/assessment-draft`);
      return response.status === 200 && response.data;
    });
    if (canonical(draft.scores) !== canonical(seed(letter, 'expected-interview-draft.json').scores)) throw new Error('draft differs from the seed');
    return draft.scores.map((s) => `${s.competency}${s.score ?? '·'}`).join(' ');
  });

  await step('consistency after the interview', async () => {
    const report = await until('consistency after', async () => {
      const response = await call('commission', 'GET', `/candidates/${id}/consistency?stage=after`);
      return response.status === 200 && response.data;
    });
    return `${report.items.length} items`;
  });

  await step('quality check of the interview', async () => {
    const check = (await call('commission', 'POST', '/quality-checks/interview', { interviewId }, { expect: [201] })).data;
    return `${check.signals.length} signals`;
  });

  await calibrate(`after ${letter.toUpperCase()}`);
}

await step('each of A, B and C has a question of their own', async () => {
  if (new Set(Object.values(questions)).size !== 3) throw new Error(`the questions repeat: ${JSON.stringify(questions)}`);
});

console.log('The stand’s hand-over');
let arrived;
await step('an applicant the platform sends becomes a candidate, with a brief started', async () => {
  const snapshot = {
    externalId: 'stand-e2e-0001',
    profile: { fullName: 'Synthetic Applicant', email: 'synthetic@example.test' },
    application: { answers: [{ fieldId: 'motivation', question: 'Why inVision U?', answer: 'I want to build things people in my town use.' }] },
    test: { answers: [{ itemId: 'block_01', response: 'Most like me: I take the part of the work nobody has claimed.' }] },
  };
  arrived = (await call('platform', 'POST', '/candidates', snapshot, { expect: [201] })).data;
  const listed = (await call('interviewer', 'GET', '/candidates', undefined, { expect: [200] })).data.items.find((item) => item.candidateId === arrived.candidateId);
  if (!listed) throw new Error('the new candidate is not listed');
  if (/^Candidate [ABC]$/.test(listed.label)) throw new Error(`the new candidate is labelled as a seed: ${listed.label}`);
  // The API starts the brief on its own, just after it answers: wait for it rather than race it.
  const brief = await until('the brief to start', async () => (await progress(arrived.candidateId)).brief, 15);
  return `${listed.label}, brief ${brief.status}`;
});
await step('a demo reset takes them away, and keeps A, B and C', async () => {
  await call('admin', 'POST', '/demo/reset', undefined, { expect: [204] });
  const labels = (await call('admin', 'GET', '/candidates', undefined, { expect: [200] })).data.items.map((item) => item.label).sort();
  if (canonical(labels) !== canonical(['Candidate A', 'Candidate B', 'Candidate C'])) throw new Error(`after the reset: ${labels.join(', ')}`);
});

const usage = (await call('admin', 'GET', '/admin/overview', undefined, { expect: [200] })).data.usage;
console.log(`ML usage: ${JSON.stringify(usage)}`);
if (usage?.liveCalls) failures.push(`the path made ${usage.liveCalls} live model calls; it should replay everything`);

if (failures.length) {
  console.log(`\nFAILED:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  process.exit(1);
}
console.log('\nAll steps passed.');
