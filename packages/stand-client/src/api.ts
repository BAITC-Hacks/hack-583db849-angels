import type { components } from './generated/schema';
import { createRawClient, unwrap, type ApiClientOptions, type RawClient } from './client';

type Schemas = components['schemas'];

export type Health = Schemas['Health'];
export type UserPublic = Schemas['UserPublic'];
export type AuthSession = Schemas['AuthSession'];
export type RegisterApplicantRequest = Schemas['RegisterApplicantRequest'];
export type LoginRequest = Schemas['LoginRequest'];
export type Role = Schemas['Role'];
export type ActiveCycle = Schemas['ActiveCycle'];
export type FormVersion = Schemas['FormVersion'];
export type FormQuestion = Schemas['FormQuestion'];
export type FormOption = Schemas['FormOption'];
export type ApplicationDraft = Schemas['ApplicationDraft'];
export type DraftAnswers = Schemas['DraftAnswers'];
export type DraftAnswerPatch = Schemas['DraftAnswerPatch'];
export type SaveAnswersRequest = Schemas['SaveAnswersRequest'];
export type TestAttemptSummary = Schemas['TestAttemptSummary'];
export type TestAttemptStatus = Schemas['TestAttemptStatus'];
export type TestVersionSummary = Schemas['TestVersionSummary'];
export type CurrentTestBlock = Schemas['CurrentTestBlock'];
export type CurrentTestBlockResponse = Schemas['CurrentTestBlockResponse'];
export type ForcedChoiceStatement = Schemas['ForcedChoiceStatement'];
export type SubmitTestBlockRequest = Schemas['SubmitTestBlockRequest'];
export type SubmitTestBlockResponse = Schemas['SubmitTestBlockResponse'];
export type TestBlockOutcome = Schemas['TestBlockOutcome'];

/**
 * Thin facades over the generated client.
 *
 * They exist for call-site ergonomics only: every input and output above is a
 * generated type, none of them redefines a schema, and none invents a business
 * error. Adding an endpoint here without adding it to openapi.yaml first is a
 * governance error, not a shortcut.
 */
export interface Api {
  raw: RawClient;
  health: {
    get(): Promise<Health>;
  };
  auth: {
    register(payload: RegisterApplicantRequest): Promise<AuthSession>;
    login(payload: LoginRequest): Promise<AuthSession>;
    refresh(): Promise<AuthSession>;
    logout(): Promise<void>;
    me(): Promise<UserPublic>;
  };
  cycles: {
    active(): Promise<ActiveCycle>;
  };
  applications: {
    createDraft(cycleId: string): Promise<ApplicationDraft>;
    current(): Promise<ApplicationDraft>;
    saveAnswers(applicationId: string, payload: SaveAnswersRequest): Promise<ApplicationDraft>;
  };
  /**
   * The forced-choice attempt. Progress is read through the application that
   * owns it; the block itself is started and resumed through the attempt, which
   * is what keeps a reload from touching a deadline the server already set.
   */
  tests: {
    createAttempt(applicationId: string): Promise<TestAttemptSummary>;
    attempt(applicationId: string): Promise<TestAttemptSummary>;
    currentBlock(attemptId: string): Promise<CurrentTestBlockResponse>;
    submitBlock(
      attemptId: string,
      blockId: string,
      payload: SubmitTestBlockRequest,
    ): Promise<SubmitTestBlockResponse>;
  };
}

export function createApi(options: ApiClientOptions = {}): Api {
  const raw = createRawClient(options);

  return {
    raw,
    health: {
      get: () => unwrap(raw.GET('/health')),
    },
    auth: {
      register: (body) => unwrap(raw.POST('/auth/register', { body })),
      login: (body) => unwrap(raw.POST('/auth/login', { body })),
      refresh: () => unwrap(raw.POST('/auth/refresh')),
      logout: async () => {
        await unwrap(raw.POST('/auth/logout'));
      },
      me: () => unwrap(raw.GET('/auth/me')),
    },
    cycles: {
      active: () => unwrap(raw.GET('/application-cycles/active')),
    },
    applications: {
      createDraft: (cycleId) => unwrap(raw.POST('/applications', { body: { cycleId } })),
      current: () => unwrap(raw.GET('/applications/current')),
      saveAnswers: (applicationId, body) =>
        unwrap(
          raw.PATCH('/applications/{applicationId}/answers', {
            params: { path: { applicationId } },
            body,
          }),
        ),
    },
    tests: {
      createAttempt: (applicationId) =>
        unwrap(
          raw.POST('/applications/{applicationId}/test-attempt', {
            params: { path: { applicationId } },
          }),
        ),
      attempt: (applicationId) =>
        unwrap(
          raw.GET('/applications/{applicationId}/test-attempt', {
            params: { path: { applicationId } },
          }),
        ),
      currentBlock: (attemptId) =>
        unwrap(
          raw.POST('/test-attempts/{attemptId}/current-block', {
            params: { path: { attemptId } },
          }),
        ),
      submitBlock: (attemptId, blockId, body) =>
        unwrap(
          raw.PUT('/test-attempts/{attemptId}/blocks/{blockId}/response', {
            params: { path: { attemptId, blockId } },
            body,
          }),
        ),
    },
  };
}
