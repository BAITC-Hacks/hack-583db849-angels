import { Body, Controller, Get, Header, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiExtraModels, ApiHeader, ApiOkResponse, ApiParam, ApiTags, getSchemaPath } from '@nestjs/swagger';

import { Roles } from '../../auth/roles.decorator';
import { contractAudioExample, contractExample } from '../../contract-example';
import { AudioTurnDto, CompleteSimulationDto, CreateSimulationDto, SimulationDto, TextTurnDto, TurnResultDto } from './dto/simulation.dto';

@ApiTags('simulations')
@Controller('simulations')
@Roles('platform', 'interviewer', 'commission', 'admin')
export class SimulationsController {
  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiCreatedResponse({ type: SimulationDto })
  create(@Body() input: CreateSimulationDto): SimulationDto {
    void input;
    return contractExample<SimulationDto>('simulation-created.json');
  }

  @Post(':simulationId/turns')
  @HttpCode(200)
  @ApiParam({ name: 'simulationId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiExtraModels(TextTurnDto, AudioTurnDto)
  @ApiBody({
    schema: { oneOf: [{ $ref: getSchemaPath(TextTurnDto) }, { $ref: getSchemaPath(AudioTurnDto) }] },
  })
  @ApiOkResponse({ type: TurnResultDto })
  turn(): TurnResultDto {
    return contractExample<TurnResultDto>('simulation-turn.json');
  }

  @Get(':simulationId/turns/:turnId/audio')
  @Header('Content-Type', 'audio/mpeg')
  @ApiParam({ name: 'simulationId', type: String })
  @ApiParam({ name: 'turnId', type: String })
  @ApiOkResponse({ content: { 'audio/mpeg': { schema: { type: 'string', format: 'binary' } } } })
  audio(): Buffer {
    return contractAudioExample();
  }

  @Post(':simulationId/complete')
  @HttpCode(200)
  @ApiParam({ name: 'simulationId', type: String })
  @ApiOkResponse({ type: SimulationDto })
  complete(@Body() input: CompleteSimulationDto): SimulationDto {
    void input;
    return contractExample<SimulationDto>('simulation-completed.json');
  }

  @Get(':simulationId')
  @ApiParam({ name: 'simulationId', type: String })
  @ApiOkResponse({ type: SimulationDto })
  get(): SimulationDto {
    return contractExample<SimulationDto>('simulation-created.json');
  }
}
