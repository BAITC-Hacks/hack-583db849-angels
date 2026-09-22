export const API_ROLES = ['platform', 'interviewer', 'commission', 'admin'] as const;

export type ApiRole = (typeof API_ROLES)[number];
