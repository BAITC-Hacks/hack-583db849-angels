import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC } from './public.decorator';
import { ApiRole, API_ROLES } from './roles';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  apiRole?: ApiRole;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const key = request.headers['x-api-key'];
    const value = Array.isArray(key) ? key[0] : key;
    const role = this.apiKeys().get(value ?? '');
    if (!role) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Missing or unknown X-API-Key.' });
    }

    request.apiRole = role;
    return true;
  }

  private apiKeys(): Map<string, ApiRole> {
    const pairs = this.config.get<string>('API_KEYS', '');
    return new Map(
      pairs.split(',').flatMap((pair) => {
        const [key, role] = pair.trim().split(':');
        return key && role && API_ROLES.includes(role as ApiRole) ? [[key, role as ApiRole]] : [];
      }),
    );
  }
}
