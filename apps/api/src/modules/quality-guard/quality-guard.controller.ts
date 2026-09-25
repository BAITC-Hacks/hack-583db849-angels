import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../auth/roles.decorator';
import { EntityId } from '../../entity-id.pipe';
import { IdempotencyService } from '../../idempotency/idempotency.service';
import { CalibrationCheckDto, InterviewCheckDto, QualityCheckDto, QualityCheckListDto, QualityCheckQueryDto } from './dto/quality-check.dto';
import { QualityGuardService } from './quality-guard.service';

/**
 * M5. The process, not the candidate: signals about how an interview was run
 * and how an interviewer's scale sits against the panel's. For the commission
 * and the admin only — the interviewers being checked do not run it on
 * themselves, and the candidate's channel never sees it.
 */
@ApiTags('quality-checks')
@Controller('quality-checks')
@Roles('commission', 'admin')
export class QualityGuardController {
  constructor(private readonly quality: QualityGuardService, private readonly idempotency: IdempotencyService) {}

  @Post('interview')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiCreatedResponse({ type: QualityCheckDto })
  interview(@Body() input: InterviewCheckDto, @Headers('idempotency-key') key: string | undefined): Promise<QualityCheckDto> {
    return this.idempotency.execute(key, { operation: 'quality.interview', interviewId: input.interviewId },
      () => this.quality.interview(input.interviewId));
  }

  @Post('calibration')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiCreatedResponse({ type: QualityCheckDto })
  calibration(@Body() input: CalibrationCheckDto, @Headers('idempotency-key') key: string | undefined): Promise<QualityCheckDto> {
    return this.idempotency.execute(key, { operation: 'quality.calibration', ...input }, () => this.quality.calibration(input));
  }

  @Get()
  @ApiOkResponse({ type: QualityCheckListDto })
  list(@Query() query: QualityCheckQueryDto): Promise<QualityCheckListDto> {
    return this.quality.list(query);
  }

  @Get(':qualityCheckId')
  @ApiParam({ name: 'qualityCheckId', type: String })
  @ApiOkResponse({ type: QualityCheckDto })
  get(@Param('qualityCheckId', EntityId) qualityCheckId: string): Promise<QualityCheckDto> {
    return this.quality.get(qualityCheckId);
  }
}
