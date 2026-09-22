import { Body, Controller, Get, Headers, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { CreateCandidateDto } from './create-candidate.dto';
import { CandidatesService } from './candidates.service';
import { IdempotencyService } from '../../idempotency/idempotency.service';

@ApiTags('candidates')
@Controller('candidates')
@Roles('platform', 'interviewer', 'commission', 'admin')
export class CandidatesController {
  constructor(private readonly candidates: CandidatesService, private readonly idempotency: IdempotencyService) {}
  @Post()
  @ApiCreatedResponse()
  create(@Body() input: CreateCandidateDto, @Headers('idempotency-key') key?: string) {
    return this.idempotency.execute(key, input, () => this.candidates.upsert(input));
  }
  @Get() @ApiOkResponse() list() { return this.candidates.list(); }
  @Get(':candidateId')
  async get(@Param('candidateId') candidateId: string) {
    const candidate = await this.candidates.find(candidateId);
    if (!candidate) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Candidate was not found.' });
    return candidate;
  }
}
