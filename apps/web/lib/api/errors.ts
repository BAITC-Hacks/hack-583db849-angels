import type { Copy, StaffLocale } from '../i18n/staffLocale';

/**
 * What the API says when something goes wrong, and what the person reads.
 *
 * A screen never shows the server's `message`: it branches on `code` and shows
 * the text below, in the staff language. Candidate screens always pass `en`.
 * An unknown code still gets an honest sentence plus the `traceId`, which can
 * be read out over a call.
 */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown>; traceId?: string };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly traceId?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(`${status} ${code}`);
    this.name = 'ApiError';
  }
}

/** The browser could not reach our own server, so there is no code to branch on. */
export const NETWORK_ERROR = 'NETWORK_ERROR';

export async function readApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    const error = body.error;
    if (error?.code) return new ApiError(response.status, error.code, error.traceId, error.details);
  } catch {
    // An empty or non-JSON body is still an error; fall through to the status.
  }
  return new ApiError(response.status, codeForStatus(response.status));
}

function codeForStatus(status: number): string {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 413) return 'PAYLOAD_TOO_LARGE';
  return status >= 500 ? 'AI_UNAVAILABLE' : 'VALIDATION_ERROR';
}

const texts: Record<string, Copy<string>> = {
  UNAUTHORIZED: { en: 'This demo client is not signed in to the API.', ru: 'Этот клиент демо не авторизован в API.' },
  FORBIDDEN: { en: 'This role does not see that.', ru: 'Эта роль этого не видит.' },
  VALIDATION_ERROR: { en: 'Check the highlighted fields.', ru: 'Проверьте выделенные поля.' },
  NOT_FOUND: { en: 'Not found.', ru: 'Не найдено.' },
  BRIEF_NOT_FOUND: { en: 'There is no brief for this candidate yet.', ru: 'Брифа для этого кандидата пока нет.' },
  DRAFT_NOT_FOUND: { en: 'The draft has not been generated yet.', ru: 'Черновик ещё не сгенерирован.' },
  CONSISTENCY_NOT_FOUND: { en: 'This stage has not been prepared yet.', ru: 'Эта стадия ещё не готова.' },
  IDEMPOTENCY_KEY_REUSED: {
    en: 'This action was already sent with different data. Reload the page.',
    ru: 'Это действие уже отправлено с другими данными. Обновите страницу.',
  },
  SIMULATION_EXISTS: { en: 'This candidate already has a simulation.', ru: 'У этого кандидата уже есть симуляция.' },
  SIMULATION_FINISHED: { en: 'The simulation is over.', ru: 'Симуляция завершена.' },
  SIMULATION_NOT_FINISHED: {
    en: 'The simulation is still running.',
    ru: 'Симуляция ещё идёт.',
  },
  SIMULATION_STARTED: {
    en: 'The simulation has started, so this can no longer be changed.',
    ru: 'Симуляция началась, это уже нельзя изменить.',
  },
  TURN_IN_FLIGHT: { en: 'Wait for the reply.', ru: 'Подождите ответа.' },
  TEXT_MODE_NOT_ALLOWED: {
    en: 'This simulation is spoken. Staff can switch typing on if it is needed.',
    ru: 'Эта симуляция голосовая. Сотрудник может включить текстовый режим, если он нужен.',
  },
  SPEECH_NOT_RECOGNISED: { en: "We didn't catch that — please record again.", ru: 'Не расслышали — запишите ещё раз.' },
  SCORES_ALREADY_SAVED: {
    en: 'The scores are already saved. Reload to see them.',
    ru: 'Баллы уже сохранены. Обновите страницу, чтобы их увидеть.',
  },
  DRAFT_LOCKED: {
    en: "Save your own scores first — that is what keeps the draft from anchoring them.",
    ru: 'Сначала сохраните свои баллы — именно это не даёт черновику на них повлиять.',
  },
  TRANSCRIPT_MISSING: { en: 'The transcript is not ready yet.', ru: 'Расшифровка ещё не готова.' },
  TRANSCRIPT_EXISTS: { en: 'This interview already has a transcript.', ru: 'У этого интервью уже есть расшифровка.' },
  CONSENT_REQUIRED: { en: 'Consent is required before uploading.', ru: 'Перед загрузкой нужно согласие.' },
  SURPRISE_EXISTS: { en: 'This candidate already has the question.', ru: 'У этого кандидата уже есть вопрос.' },
  ALREADY_STARTED: { en: 'The question was already opened. There is one attempt.', ru: 'Вопрос уже открыт. Попытка одна.' },
  ALREADY_ANSWERED: { en: 'The answer is already recorded.', ru: 'Ответ уже записан.' },
  DEADLINE_PASSED: { en: 'The time for the answer is over.', ru: 'Время на ответ вышло.' },
  PAYLOAD_TOO_LARGE: { en: 'The file is too large.', ru: 'Файл слишком большой.' },
  NO_SCENARIO_READY: {
    en: 'No scenario is ready yet. Staff are told.',
    ru: 'Ни один сценарий пока не готов. Сотрудники предупреждены.',
  },
  AI_INVALID_OUTPUT: { en: 'The model answered badly. Try again.', ru: 'Модель ответила некорректно. Повторите.' },
  AI_UNAVAILABLE: { en: 'The AI service is not answering. Try again.', ru: 'Сервис ИИ не отвечает. Повторите.' },
  AI_BUDGET_EXCEEDED: {
    en: 'The AI budget for the demo is spent.',
    ru: 'Бюджет ИИ для демо израсходован.',
  },
  [NETWORK_ERROR]: { en: 'No connection to the server.', ru: 'Нет связи с сервером.' },
};

const unknown: Copy<(traceId?: string) => string> = {
  en: (traceId) => (traceId ? `Something went wrong. Reference ${traceId}.` : 'Something went wrong. Please try again.'),
  ru: (traceId) => (traceId ? `Что-то пошло не так. Код ${traceId}.` : 'Что-то пошло не так. Повторите попытку.'),
};

export function errorText(error: unknown, locale: StaffLocale = 'en'): string {
  if (!(error instanceof ApiError)) return texts[NETWORK_ERROR][locale];
  return texts[error.code]?.[locale] ?? unknown[locale](error.traceId);
}

/** `GET`s are retried on a network failure or a 5xx, never on a 4xx. */
export function isRetryable(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status >= 500;
}
