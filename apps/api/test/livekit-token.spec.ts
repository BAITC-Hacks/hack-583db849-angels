import { createHmac } from 'node:crypto';

import { liveKitToken } from '../src/modules/interview-slots/livekit-token';

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString());

describe('the LiveKit room token', () => {
  const now = new Date('2026-09-29T04:55:00Z');
  const token = liveKitToken({ apiKey: 'APIsynthetic', apiSecret: 'synthetic-secret', identity: 'candidate', name: 'Candidate', room: 'slot-1', ttlSeconds: 3900, now });
  const [header, payload, signature] = token.split('.');

  it('is an HS256 JWT signed with the API secret', () => {
    expect(decode(header)).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(signature).toBe(createHmac('sha256', 'synthetic-secret').update(`${header}.${payload}`).digest('base64url'));
  });

  it('lets one participant, named only by their side, into one room until it expires', () => {
    const claims = decode(payload);
    expect(claims).toMatchObject({ iss: 'APIsynthetic', sub: 'candidate', name: 'Candidate', nbf: now.getTime() / 1000, exp: now.getTime() / 1000 + 3900 });
    expect(claims.video).toEqual({ room: 'slot-1', roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
  });
});
