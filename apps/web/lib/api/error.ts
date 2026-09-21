/**
 * The error type now lives in the generated client package, so the app and the
 * contract cannot drift apart. This file stays as the import path the app
 * already uses.
 */
export { ApiError, MALFORMED_ERROR, NETWORK_ERROR, networkError } from '@invision/stand-client';
export type { ApiErrorBody } from '@invision/stand-client';
