import { createHmac } from 'node:crypto';

export interface LiveKitGrant {
  apiKey: string;
  apiSecret: string;
  /** Unique in the room: `candidate` or `interviewer`. Never a name. */
  identity: string;
  name: string;
  room: string;
  ttlSeconds: number;
  now?: Date;
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

/**
 * A LiveKit room token: a JWT signed with HS256 and the API secret, carrying
 * the `video` grant. This is all `livekit-server-sdk`'s `AccessToken` makes,
 * so the API signs it with `node:crypto` instead of taking on the package.
 */
export function liveKitToken({ apiKey, apiSecret, identity, name, room, ttlSeconds, now = new Date() }: LiveKitGrant): string {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: apiKey,
    sub: identity,
    name,
    nbf: issuedAt,
    exp: issuedAt + Math.max(60, Math.floor(ttlSeconds)),
    video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true },
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  return `${unsigned}.${base64url(createHmac('sha256', apiSecret).update(unsigned).digest())}`;
}
