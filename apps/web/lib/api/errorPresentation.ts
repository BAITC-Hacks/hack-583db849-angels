'use client';

import { ApiError } from './error';
import type { FieldErrors } from '../validation/identity';

/** What each documented error code means to the person who hit it. */
const errorMessages: Record<string, string> = {
  generic: 'Something went wrong. Please try again.',
  VALIDATION_ERROR: 'Check the highlighted fields.',
  REGISTRATION_FAILED: 'We could not create an account with these details.',
  INVALID_CREDENTIALS: 'We could not sign you in. Check your email and password and try again.',
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  FORBIDDEN: 'This account does not have access to that area.',
  CSRF_VALIDATION_FAILED: 'We could not verify the session. Refresh the page and try again.',
  RATE_LIMITED: 'Too many attempts. Please wait a few minutes.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try later.',
  NO_ACTIVE_APPLICATION_CYCLE: 'Admissions are closed at the moment.',
  APPLICATION_NOT_FOUND: 'The application was not found.',
  APPLICATION_ALREADY_EXISTS: 'An application for this cycle already exists.',
  APPLICATION_NOT_EDITABLE: 'The application can no longer be edited.',
  FORM_VERSION_MISMATCH: 'The form has been updated. We reloaded your application.',
  DRAFT_REVISION_CONFLICT: 'The application was changed elsewhere. We loaded the latest version.',
  UNKNOWN_QUESTION: 'The form has changed. We reloaded your application.',
  INVALID_ANSWER_TYPE: 'That answer is in the wrong format.',
  INVALID_ANSWER_VALUE: 'That answer is not valid for this question.',
  NETWORK_ERROR: 'Could not reach the server. Check your connection and try again.',
  MALFORMED_ERROR_RESPONSE: 'The server answered unexpectedly. Please try later.',
};

export interface ApiErrorPresentation {
  message: string;
  fields: FieldErrors;
}

/**
 * Maps a caught error to copy the user should see, branching on `code`.
 *
 * The contract types `code` as a string and does not constrain it per operation
 * yet — that is #21's work and belongs to the API — so an unrecognised code is
 * handled rather than assumed away. The codes themselves come from
 * docs/contract-governance.md and the S2 specification, which closes CON-006:
 * the frontend no longer carries its own invented union of codes.
 */
export function useApiErrorText(): (error: unknown) => ApiErrorPresentation {
  return (error) => {
    if (!(error instanceof ApiError)) {
      return { message: 'Something went wrong. Please try again.', fields: {} };
    }

    if (error.code === 'NETWORK_ERROR') {
      return { message: 'Could not reach the server. Check your connection and try again.', fields: {} };
    }

    return {
      message: errorMessages[error.code] ?? 'An unexpected error occurred. Please try later.',
      fields: error.code === 'VALIDATION_ERROR' ? readFieldErrors(error.details) : {},
    };
  };
}

/** Pulls field-level messages out of `details` without trusting their shape. */
function readFieldErrors(details: unknown): FieldErrors {
  if (!details || typeof details !== 'object') return {};
  const fields = (details as Record<string, unknown>).fields;
  if (!fields || typeof fields !== 'object') return {};

  const result: FieldErrors = {};
  for (const [field, messages] of Object.entries(fields as Record<string, unknown>)) {
    if (!Array.isArray(messages)) continue;
    const texts = messages.filter((message): message is string => typeof message === 'string');
    if (texts.length > 0) result[field] = texts;
  }
  return result;
}
