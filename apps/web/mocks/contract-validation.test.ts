import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import Ajv2020, { AnySchema } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { setupServer } from 'msw/node';
import YAML from 'yaml';

type RecordValue = Record<string, unknown>;

const schemaId = 'https://invision.local/approved-openapi.json';
const specification = YAML.parse(readFileSync(resolve(process.cwd(), '../../packages/stand-client/openapi.yaml'), 'utf8')) as RecordValue;
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(specification, schemaId);

function resolveReference(value: unknown): RecordValue | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const reference = (value as RecordValue).$ref;
  if (typeof reference !== 'string' || !reference.startsWith('#/')) return value as RecordValue;
  return reference.slice(2).split('/').reduce<unknown>((current, segment) => (
    current && typeof current === 'object'
      ? (current as RecordValue)[segment.replaceAll('~1', '/').replaceAll('~0', '~')]
      : undefined
  ), specification) as RecordValue | undefined;
}

function withRootReferences(value: unknown): AnySchema {
  if (Array.isArray(value)) return value.map(withRootReferences);
  if (!value || typeof value !== 'object') return value as AnySchema;
  return Object.fromEntries(Object.entries(value as RecordValue).map(([key, item]) => [key,
    key === '$ref' && typeof item === 'string' && item.startsWith('#/') ? `${schemaId}${item}` : withRootReferences(item),
  ])) as AnySchema;
}

async function assertContractResponse(method: string, path: string, response: Response): Promise<void> {
  // `path` is the templated path from the specification, not the URL that was
  // fetched: a documented response is documented per operation, and the
  // parameters in it are exactly what the template stands for.
  const operation = ((specification.paths as RecordValue)[path] as RecordValue)[method] as RecordValue;
  const responseDefinition = resolveReference((operation.responses as RecordValue)[String(response.status)]);
  assert.ok(responseDefinition, `${method.toUpperCase()} ${path} returned undocumented ${response.status}`);

  for (const name of Object.keys((responseDefinition.headers ?? {}) as RecordValue)) {
    assert.ok(response.headers.has(name), `${method.toUpperCase()} ${path} ${response.status} misses ${name}`);
  }

  const jsonSchema = ((responseDefinition.content as RecordValue | undefined)?.['application/json'] as RecordValue | undefined)?.schema;
  if (!jsonSchema) {
    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');
    return;
  }

  assert.equal(response.headers.get('content-type')?.split(';', 1)[0], 'application/json');
  const validate = ajv.compile(withRootReferences(jsonSchema));
  assert.equal(validate(await response.json()), true, JSON.stringify(validate.errors));
}

test('S1 MSW fixtures conform to approved OpenAPI responses', async () => {
  const locationDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('http://invision.mock') });
  const { handlers } = await import('./handlers');
  const server = setupServer(...handlers);
  server.listen({ onUnhandledRequest: 'error' });
  try {
    const suffix = crypto.randomUUID();
    const registration = {
      email: `fixture-${suffix}@example.test`, iin: '000000000000', fullName: 'Fixture Applicant',
      birthYear: 2000, password: 'synthetic-fixture-passphrase',
    };
    const requests: Array<[string, string, RequestInit?]> = [
      ['POST', '/auth/register', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(registration) }],
      ['POST', '/auth/register', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...registration, iin: 'bad' }) }],
      ['POST', '/auth/register', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...registration, email: 'servererror@example.test' }) }],
      ['POST', '/auth/login', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'applicant.demo@example.test', password: 'synthetic-demo-passphrase' }) }],
      ['POST', '/auth/login', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'applicant.demo@example.test', password: 'wrong' }) }],
      ['POST', '/auth/refresh'],
      ['POST', '/auth/logout'],
      ['GET', '/auth/me'],
    ];
    for (const [method, path, init] of requests) {
      const response = await fetch(`http://invision.mock${path}`, { method, ...init });
      await assertContractResponse(method.toLowerCase(), path, response);
    }
  } finally {
    server.close();
    if (locationDescriptor) Object.defineProperty(globalThis, 'location', locationDescriptor);
    else Reflect.deleteProperty(globalThis, 'location');
  }
});

test('S2 and S3 MSW fixtures conform to approved OpenAPI responses', async () => {
  const locationDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('http://invision.mock') });
  const { handlers } = await import('./handlers');
  const { s2Handlers } = await import('./s2Handlers');
  const { s3Handlers } = await import('./s3Handlers');
  const { CYCLE_ID } = await import('./s2');
  const server = setupServer(...handlers, ...s2Handlers, ...s3Handlers);
  server.listen({ onUnhandledRequest: 'error' });

  // The handlers read cookies off the request, so the test only has to keep
  // them between calls — which is also what a browser would be doing.
  const jar = new Map<string, string>();

  async function send(method: string, url: string, specPath: string, body?: unknown): Promise<Response> {
    const response = await fetch(`http://invision.mock${url}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(jar.size ? { Cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; ') } : {}),
        ...(jar.has('invision_csrf') ? { 'X-CSRF-Token': jar.get('invision_csrf')! } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    for (const header of response.headers.getSetCookie?.() ?? []) {
      const [pair] = header.split(';');
      const [name, ...rest] = pair.split('=');
      if (name) jar.set(name.trim(), rest.join('='));
    }

    const clone = response.clone();
    await assertContractResponse(method.toLowerCase(), specPath, response);
    return clone;
  }

  try {
    await send('POST', '/auth/login', '/auth/login', {
      email: 'applicant.demo@example.test',
      password: 'synthetic-demo-passphrase',
    });

    const draft = (await (
      await send('POST', '/applications', '/applications', { cycleId: CYCLE_ID })
    ).json()) as { id: string };

    const attemptPath = `/applications/${draft.id}/test-attempt`;
    const specAttempt = '/applications/{applicationId}/test-attempt';
    const attempt = (await (await send('POST', attemptPath, specAttempt)).json()) as { id: string };

    // The second create is the documented conflict, not a mistake in the test.
    await send('POST', attemptPath, specAttempt);
    await send('GET', attemptPath, specAttempt);

    const blockPath = `/test-attempts/${attempt.id}/current-block`;
    const specBlock = '/test-attempts/{attemptId}/current-block';
    const block = (await (await send('POST', blockPath, specBlock)).json()) as {
      attempt: { revision: number };
      currentBlock: { id: string; statements: { id: string }[] };
    };

    const responsePath = `/test-attempts/${attempt.id}/blocks/${block.currentBlock.id}/response`;
    const specResponse = '/test-attempts/{attemptId}/blocks/{blockId}/response';
    const [first, second] = block.currentBlock.statements;

    await send('PUT', responsePath, specResponse, {
      expectedRevision: block.attempt.revision,
      mostStatementId: first.id,
      leastStatementId: first.id,
    });
    await send('PUT', responsePath, specResponse, {
      expectedRevision: block.attempt.revision,
      mostStatementId: first.id,
      leastStatementId: second.id,
    });
    await send('PUT', responsePath, specResponse, {
      expectedRevision: block.attempt.revision,
      mostStatementId: second.id,
      leastStatementId: first.id,
    });
  } finally {
    server.close();
    if (locationDescriptor) Object.defineProperty(globalThis, 'location', locationDescriptor);
    else Reflect.deleteProperty(globalThis, 'location');
  }
});
