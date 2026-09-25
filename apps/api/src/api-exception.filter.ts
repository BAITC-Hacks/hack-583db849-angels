import { randomUUID } from 'node:crypto';

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? objectValue(exception.getResponse()) : {};
    const message = typeof body.message === 'string' ? body.message : 'The request could not be completed.';
    const code = typeof body.code === 'string' ? body.code : this.defaultCode(status);
    const validationMessages = Array.isArray(body.message) ? body.message.filter((item): item is string => typeof item === 'string') : [];
    const details = validationMessages.length
      ? { fields: validationMessages.map((item) => item.split(' ')[0]) }
      : objectValue(body.details);

    response.status(status).json({ error: { code, message, details, traceId: randomUUID() } });
  }

  private defaultCode(status: number): string {
    if (status === HttpStatus.BAD_REQUEST) return 'VALIDATION_ERROR';
    if (status === HttpStatus.UNAUTHORIZED) return 'UNAUTHORIZED';
    if (status === HttpStatus.FORBIDDEN) return 'FORBIDDEN';
    if (status === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
    if (status === HttpStatus.PAYLOAD_TOO_LARGE) return 'PAYLOAD_TOO_LARGE';
    return 'INTERNAL_ERROR';
  }
}
