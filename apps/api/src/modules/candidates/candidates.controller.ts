import { Body, Controller, Get, Headers, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { CreateCandidateDto } from './create-candidate.dto';
import { CandidatesService } from './candidates.service';
import { IdempotencyService } from '../../idempotency/idempotency.service';
import { AuditService } from '../audit/audit.service';
import { ApiRole } from '../../auth/roles';

@ApiTags('candidates')
@Controller('candidates')
@Roles('platform', 'interviewer', 'commission', 'admin')
export class CandidatesController {
  constructor(private readonly candidates: CandidatesService, private readonly idempotency: IdempotencyService, private readonly audit: AuditService) {}
  @Post()
  @ApiCreatedResponse()
  async create(@Body() input: CreateCandidateDto, @Headers('idempotency-key') key: string | undefined, @Req() request: Request & { apiRole?: ApiRole }) {
    const candidate = await this.idempotency.execute(key, input, () => this.candidates.upsert(input));
    await this.audit.record({ action: 'candidate.upsert', targetType: 'candidate', targetId: candidate.id, candidateId: candidate.id, actorRole: request.apiRole });
    return candidate;
  }
  @Get() @ApiOkResponse() list() { return this.candidates.list(); }
  @Get(':candidateId')
  async get(@Param('candidateId') candidateId: string) {
    const candidate = await this.candidates.find(candidateId);
    if (!candidate) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Candidate was not found.' });
    return candidate;
  }
}
