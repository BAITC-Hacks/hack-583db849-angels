import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { ApiCreatedResponse, ApiHeader, ApiNoContentResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { ApiRole } from '../../auth/roles';
import { Roles } from '../../auth/roles.decorator';
import { EntityId } from '../../entity-id.pipe';
import { IdempotencyService } from '../../idempotency/idempotency.service';
import { BookSlotDto, CallAccessDto, CreateSlotDto, InterviewSlotDto, InterviewSlotListDto, JoinCallDto, SlotQueryDto } from './interview-slot.dto';
import { InterviewSlotsService } from './interview-slots.service';

type RoleRequest = Request & { apiRole: ApiRole };

/** V. Interviewers offer slots, the candidate's channel books one, and both sides join the call. */
@ApiTags('interview-slots')
@Controller('interview-slots')
export class InterviewSlotsController {
  constructor(private readonly slots: InterviewSlotsService, private readonly idempotency: IdempotencyService) {}

  @Post()
  @Roles('interviewer', 'admin')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiCreatedResponse({ type: InterviewSlotDto })
  create(@Body() input: CreateSlotDto, @Headers('idempotency-key') key: string | undefined, @Req() request: RoleRequest): Promise<InterviewSlotDto> {
    return this.idempotency.execute(key, { operation: 'slot.create', ...input }, () => this.slots.create(input, request.apiRole));
  }

  @Get()
  @Roles('platform', 'interviewer', 'commission', 'admin')
  @ApiOkResponse({ type: InterviewSlotListDto })
  list(@Query() query: SlotQueryDto, @Req() request: RoleRequest): Promise<InterviewSlotListDto> {
    return this.slots.list(query, request.apiRole);
  }

  @Get(':slotId')
  @Roles('platform', 'interviewer', 'commission', 'admin')
  @ApiParam({ name: 'slotId', type: String })
  @ApiOkResponse({ type: InterviewSlotDto })
  get(@Param('slotId', EntityId) slotId: string, @Req() request: RoleRequest): Promise<InterviewSlotDto> {
    return this.slots.get(slotId, request.apiRole);
  }

  @Delete(':slotId')
  @HttpCode(204)
  @Roles('interviewer', 'admin')
  @ApiParam({ name: 'slotId', type: String })
  @ApiNoContentResponse()
  remove(@Param('slotId', EntityId) slotId: string): Promise<void> {
    return this.slots.remove(slotId);
  }

  @Post(':slotId/booking')
  @HttpCode(200)
  @Roles('platform', 'admin')
  @ApiParam({ name: 'slotId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiOkResponse({ type: InterviewSlotDto })
  book(@Param('slotId', EntityId) slotId: string, @Body() { candidateId }: BookSlotDto, @Headers('idempotency-key') key: string | undefined,
    @Req() request: RoleRequest): Promise<InterviewSlotDto> {
    return this.idempotency.execute(key, { operation: 'slot.book', slotId, candidateId }, () => this.slots.book(slotId, candidateId, request.apiRole), 200);
  }

  @Post(':slotId/join')
  @HttpCode(200)
  @Roles('platform', 'interviewer', 'admin')
  @ApiParam({ name: 'slotId', type: String })
  @ApiOkResponse({ type: CallAccessDto })
  join(@Param('slotId', EntityId) slotId: string, @Body() input: JoinCallDto, @Req() request: RoleRequest): Promise<CallAccessDto> {
    return this.slots.join(slotId, input, request.apiRole);
  }
}
