import { SetMetadata } from '@nestjs/common';

import { ApiRole } from './roles';

export const REQUIRED_ROLES = 'requiredRoles';
export const Roles = (...roles: ApiRole[]): ReturnType<typeof SetMetadata> => SetMetadata(REQUIRED_ROLES, roles);
