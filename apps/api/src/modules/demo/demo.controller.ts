import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiHeader, ApiNoContentResponse, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { Request } from 'express';

import { ApiRole } from '../../auth/roles';
import { Roles } from '../../auth/roles.decorator';
import { IdempotencyService } from '../../idempotency/idempotency.service';
import { CandidateProgressDto } from '../candidates/dto/candidate.dto';
import { DemoService } from './demo.service';

export class RecordedSessionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() candidateId!: string;
}

type RoleRequest = Request & { apiRole: ApiRole };

/** The demo's controls; they answer 404 unless DEMO_MODE is on. */
@ApiTags('demo')
@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoService, private readonly idempotency: IdempotencyService) {}

  @Post('reset')
  @HttpCode(204)
  @Roles('admin')
  @ApiNoContentResponse()
  reset(@Req() request: RoleRequest): Promise<void> {
    return this.demo.reset(request.apiRole);
  }

  @Post('recorded-session')
  @HttpCode(200)
  @Roles('commission', 'admin')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiOkResponse({ type: CandidateProgressDto })
  recordedSession(@Body() input: RecordedSessionDto, @Headers('idempotency-key') key: string | undefined, @Req() request: RoleRequest): Promise<CandidateProgressDto> {
    return this.idempotency.execute(key, { operation: 'demo.recorded-session', candidateId: input.candidateId },
      () => this.demo.recordedSession(input.candidateId, request.apiRole), 200);
  }
}
