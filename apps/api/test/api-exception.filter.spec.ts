import { PayloadTooLargeException } from '@nestjs/common';

import { ApiExceptionFilter } from '../src/api-exception.filter';

function capture(exception: unknown) {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = { switchToHttp: () => ({ getResponse: () => response }) };
  new ApiExceptionFilter().catch(exception, host as never);
  return { status: response.status.mock.calls[0][0] as number, body: response.json.mock.calls[0][0] as { error: { code: string } } };
}

describe('ApiExceptionFilter', () => {
  it('names an upload over the size limit PAYLOAD_TOO_LARGE, as the contract lists it', () => {
    // Multer throws this for a surprise video over 50 MB or a turn over its limit.
    const { status, body } = capture(new PayloadTooLargeException('File too large'));
    expect(status).toBe(413);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
