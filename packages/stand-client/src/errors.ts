import type { components } from './generated/schema';

/** The error envelope exactly as the contract defines it. */
export type ApiErrorBody = components['schemas']['ApiError'];

/**
 * A failed call, normalized.
 *
 * The client never invents a business error: `code` is whatever the contract
 * returned. Only two codes originate here, and both describe the transport
 * rather than the domain — the request never reached the API, or the API
 * answered with something that is not the documented envelope.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorBody['details'];
  readonly traceId: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.traceId = body.traceId;
  }

  /** First message for a field, when the API returned field-level detail. */
  fieldError(field: string): string | undefined {
    const fields = this.details?.fields;
    if (!fields || typeof fields !== 'object') return undefined;
    const messages = (fields as Record<string, unknown>)[field];
    return Array.isArray(messages) && typeof messages[0] === 'string' ? messages[0] : undefined;
  }
}

export const NETWORK_ERROR = 'NETWORK_ERROR';
export const MALFORMED_ERROR = 'MALFORMED_ERROR_RESPONSE';

export function networkError(message: string): ApiError {
  return new ApiError(0, { code: NETWORK_ERROR, message, traceId: 'client_network_error' });
}

/**
 * Accepts a failure body only when it is the documented envelope. Anything else
 * — an HTML error page from a proxy, an empty body, a shape from some other
 * service — becomes MALFORMED_ERROR_RESPONSE rather than being read as if it
 * were a contract error.
 */
export function toApiError(status: number, body: unknown, fallbackMessage: string): ApiError {
  if (
    body !== null &&
    typeof body === 'object' &&
    typeof (body as ApiErrorBody).code === 'string' &&
    typeof (body as ApiErrorBody).message === 'string' &&
    typeof (body as ApiErrorBody).traceId === 'string'
  ) {
    return new ApiError(status, body as ApiErrorBody);
  }

  return new ApiError(status, {
    code: MALFORMED_ERROR,
    message: fallbackMessage,
    traceId: 'client_malformed_response',
  });
}
