import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRED_ROLES } from './roles.decorator';
import { AuthenticatedRequest } from './api-key.guard';
import { ApiRole } from './roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<ApiRole[]>(REQUIRED_ROLES, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.apiRole || !required.includes(request.apiRole)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'This role cannot call the endpoint.' });
    }
    return true;
  }
}
