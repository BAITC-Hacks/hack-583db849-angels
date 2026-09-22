import { describe, expect, it, vi } from 'vitest';
import { proxyToApi } from '../lib/api/proxy';

function call(request: Request, path: string[], answer: Response) {
  const fetchImpl = vi.fn(async () => answer) as unknown as typeof fetch;
  return { fetchImpl, result: proxyToApi(request, path, { baseUrl: 'http://api:3001', apiKey: 'key-for-role', fetchImpl }) };
}

describe('the BFF proxy', () => {
  it('adds the role key and keeps the path and the query', async () => {
    const request = new Request('http://web/api/v1/candidates?include=progress');
    const { fetchImpl, result } = call(request, ['candidates'], new Response('[]', { status: 200 }));
    await result;

    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api:3001/v1/candidates?include=progress');
    expect(new Headers(init.headers).get('x-api-key')).toBe('key-for-role');
  });

  it('forwards Idempotency-Key and Content-Type, and never the cookie', async () => {
    const request = new Request('http://web/api/v1/simulations', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'a-key',
        cookie: 'invision-demo-role=admin',
      },
      body: JSON.stringify({ candidateId: 'c1' }),
    });
    const { fetchImpl, result } = call(request, ['simulations'], new Response('{}', { status: 201 }));
    await result;

    const headers = new Headers((vi.mocked(fetchImpl).mock.calls[0] as unknown as [string, RequestInit])[1].headers);
    expect(headers.get('idempotency-key')).toBe('a-key');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('cookie')).toBeNull();
  });

  it('streams the body instead of reading it', async () => {
    const request = new Request('http://web/api/v1/simulations/s1/turns', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=x' },
      body: 'audio bytes',
    });
    const { fetchImpl, result } = call(request, ['simulations', 's1', 'turns'], new Response('{}', { status: 200 }));
    await result;

    const init = (vi.mocked(fetchImpl).mock.calls[0] as unknown as [string, RequestInit & { duplex?: string }])[1];
    expect(init.duplex).toBe('half');
    expect(init.body).toBe(request.body);
    expect(request.bodyUsed).toBe(false);
  });

  it('passes the status and the body back unchanged', async () => {
    const body = JSON.stringify({ error: { code: 'DRAFT_LOCKED', message: 'no', traceId: 'a1b2' } });
    const request = new Request('http://web/api/v1/interviews/i1/assessment-draft');
    const { result } = call(request, ['interviews', 'i1', 'assessment-draft'], new Response(body, {
      status: 409,
      headers: { 'content-type': 'application/json', 'x-trace-id': 'a1b2', 'set-cookie': 'leak=1' },
    }));

    const answer = await result;
    expect(answer.status).toBe(409);
    expect(await answer.text()).toBe(body);
    expect(answer.headers.get('x-trace-id')).toBe('a1b2');
    expect(answer.headers.get('set-cookie')).toBeNull();
  });

  it('sends no body on a GET', async () => {
    const request = new Request('http://web/api/v1/health');
    const { fetchImpl, result } = call(request, ['health'], new Response('{}', { status: 200 }));
    await result;

    const init = (vi.mocked(fetchImpl).mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.body).toBeUndefined();
  });
});
