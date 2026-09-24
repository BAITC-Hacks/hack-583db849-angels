import { BadRequestException, Body, Controller, Get, Header, Headers, HttpCode, Param, Post, Req, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiExtraModels, ApiHeader, ApiOkResponse, ApiParam, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';

import { Roles } from '../../auth/roles.decorator';
import { ApiRole } from '../../auth/roles';
import { IdempotencyService } from '../../idempotency/idempotency.service';
import { AudioTurnDto, CompleteSimulationDto, CreateSimulationDto, SimulationDto, TextTurnDto, TurnResultDto } from './dto/simulation.dto';
import { SimulationsService, UploadedAudio } from './simulations.service';

@ApiTags('simulations')
@Controller('simulations')
@Roles('platform', 'interviewer', 'commission', 'admin')
export class SimulationsController {
  constructor(private readonly simulations: SimulationsService, private readonly idempotency: IdempotencyService) {}

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiCreatedResponse({ type: SimulationDto })
  create(@Body() input: CreateSimulationDto, @Headers('idempotency-key') key: string | undefined,
    @Req() request: Request & { apiRole: ApiRole }): Promise<SimulationDto> {
    return this.idempotency.execute(key, { operation: 'simulation.create', candidateId: input.candidateId },
      () => this.simulations.create(input.candidateId, request.apiRole));
  }

  @Post(':simulationId/turns')
  @HttpCode(200)
  @ApiParam({ name: 'simulationId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiExtraModels(TextTurnDto, AudioTurnDto)
  @ApiBody({ schema: { oneOf: [{ $ref: getSchemaPath(TextTurnDto) }, { $ref: getSchemaPath(AudioTurnDto) }] } })
  @ApiOkResponse({ type: TurnResultDto })
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 50 * 1024 * 1024 } }))
  turn(@Param('simulationId') simulationId: string, @Body() body: Record<string, unknown>,
    @UploadedFile() audio: UploadedAudio | undefined, @Headers('idempotency-key') key: string | undefined,
    @Req() request: Request & { apiRole: ApiRole }): Promise<TurnResultDto> {
    if (audio && body?.text !== undefined) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Send audio or text, not both.', details: { fields: ['audio', 'text'] } });
    }
    if (body?.text !== undefined && typeof body.text !== 'string') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Text must be a string.', details: { fields: ['text'] } });
    }
    if (body?.text !== undefined && !request.is('application/json')) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Text turns require JSON.', details: { fields: ['text'] } });
    }
    const input = { text: body?.text as string | undefined, audio };
    return this.idempotency.execute(key, this.simulations.idempotencyBody(simulationId, input),
      () => this.simulations.turn(simulationId, input, request.apiRole), 200);
  }

  @Get(':simulationId/turns/:turnId/audio')
  @Header('Content-Type', 'audio/mpeg')
  @ApiParam({ name: 'simulationId', type: String })
  @ApiParam({ name: 'turnId', type: String })
  @ApiOkResponse({ content: { 'audio/mpeg': { schema: { type: 'string', format: 'binary' } } } })
  async audio(@Param('simulationId') simulationId: string, @Param('turnId') turnId: string): Promise<StreamableFile> {
    return new StreamableFile(await this.simulations.characterAudio(simulationId, turnId));
  }

  @Post(':simulationId/complete')
  @HttpCode(200)
  @ApiParam({ name: 'simulationId', type: String })
  @ApiOkResponse({ type: SimulationDto })
  complete(@Param('simulationId') simulationId: string, @Body() input: CompleteSimulationDto,
    @Req() request: Request & { apiRole: ApiRole }): Promise<SimulationDto> {
    return this.simulations.complete(simulationId, input.reason, request.apiRole);
  }

  @Get(':simulationId')
  @ApiParam({ name: 'simulationId', type: String })
  @ApiOkResponse({ type: SimulationDto })
  get(@Param('simulationId') simulationId: string): Promise<SimulationDto> {
    return this.simulations.get(simulationId);
  }
}
