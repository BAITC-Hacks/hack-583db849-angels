/**
 * The whole of what the BFF does, as a plain function so it can be tested
 * without a server: take the browser's request, add the API key, and hand back
 * what the API answered — same status, same body, nothing rewritten.
 *
 * Audio and video go through here too, so the body is passed as a stream and
 * never read into memory.
 */

/** Sent on: what the API needs. `cookie` and `authorization` stay in the browser. */
const requestHeaders = ['content-type', 'accept', 'accept-language', 'idempotency-key', 'range'];

/** Sent back: what the screen needs, including the ones that make video seekable. */
const responseHeaders = [
  'content-type',
  'content-length',
  'content-disposition',
  'content-range',
  'accept-ranges',
  'cache-control',
  'etag',
  'x-trace-id',
];

const methodsWithoutBody = new Set(['GET', 'HEAD']);

export interface ProxyOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export async function proxyToApi(
  request: Request,
  path: string[],
  { baseUrl, apiKey, fetchImpl = fetch }: ProxyOptions,
): Promise<Response> {
  const search = new URL(request.url).search;
  const target = `${baseUrl}/v1/${path.map(encodeURIComponent).join('/')}${search}`;

  const headers = new Headers();
  for (const name of requestHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-api-key', apiKey);

  const init: RequestInit & { duplex?: 'half' } = { method: request.method, headers, redirect: 'manual' };
  if (!methodsWithoutBody.has(request.method)) {
    init.body = request.body;
    // Required by fetch to send a stream it has not buffered.
    init.duplex = 'half';
  }

  const answer = await fetchImpl(target, init);

  const out = new Headers();
  for (const name of responseHeaders) {
    const value = answer.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(answer.body, { status: answer.status, statusText: answer.statusText, headers: out });
}
