import { Body, Controller, Get, Headers, NotFoundException, Param, Post, Put, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { CreateCandidateDto } from './create-candidate.dto';
import { CandidatesService } from './candidates.service';
import { IdempotencyService } from '../../idempotency/idempotency.service';
import { AuditService } from '../audit/audit.service';
import { ApiRole } from '../../auth/roles';
import { contractExample } from '../../contract-example';
import { AccommodationDto, UpdateAccommodationDto } from './dto/accommodation.dto';
import { CandidateDto, CandidateListDto, CandidateProgressDto } from './dto/candidate.dto';

@ApiTags('candidates')
@Controller('candidates')
@Roles('platform', 'interviewer', 'commission', 'admin')
export class CandidatesController {
  constructor(private readonly candidates: CandidatesService, private readonly idempotency: IdempotencyService, private readonly audit: AuditService) {}
  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiCreatedResponse({ type: CandidateDto })
  async create(@Body() input: CreateCandidateDto, @Headers('idempotency-key') key: string | undefined, @Req() request: Request & { apiRole: ApiRole }): Promise<CandidateDto> {
    const stored = await this.idempotency.execute(key, input, () => this.candidates.upsert(input)) as CandidateDto & { id?: string };
    // An idempotency entry from F0 may still contain a raw Prisma record.
    const candidate = await this.candidates.find(stored.candidateId ?? stored.id ?? '');
    if (!candidate) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Candidate was not found.' });
    await this.audit.record({ action: 'candidate.upsert', targetType: 'candidate', targetId: candidate.candidateId, candidateId: candidate.candidateId, actorRole: request.apiRole });
    return candidate;
  }
  @Get()
  @ApiQuery({ name: 'include', required: false, enum: ['progress'] })
  @ApiOkResponse({ type: CandidateListDto })
  list(@Query('include') include: string | undefined, @Req() request: Request & { apiRole: ApiRole }): Promise<CandidateListDto> {
    return this.candidates.list(include === 'progress', request.apiRole);
  }

  @Get(':candidateId/progress')
  @ApiOkResponse({ type: CandidateProgressDto })
  async progress(@Param('candidateId') candidateId: string, @Req() request: Request & { apiRole: ApiRole }): Promise<CandidateProgressDto> {
    const progress = await this.candidates.progress(candidateId, request.apiRole);
    if (!progress) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Candidate was not found.' });
    return progress;
  }

  @Put(':candidateId/accommodations')
  @Roles('commission', 'admin')
  @ApiOkResponse({ type: AccommodationDto })
  accommodation(@Param('candidateId') _candidateId: string, @Body() _input: UpdateAccommodationDto): AccommodationDto {
    void _candidateId;
    void _input;
    return contractExample<AccommodationDto>('accommodation.json');
  }

  @Get(':candidateId')
  @ApiOkResponse({ type: CandidateDto })
  async get(@Param('candidateId') candidateId: string): Promise<CandidateDto> {
    const candidate = await this.candidates.find(candidateId);
    if (!candidate) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Candidate was not found.' });
    return candidate;
  }
}
