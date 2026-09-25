import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID } from 'class-validator';

export class CreateSimulationDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() candidateId!: string;
}

export class CompleteSimulationDto {
  @ApiProperty({ enum: ['completed', 'stopped'] }) @IsIn(['completed', 'stopped']) reason!: 'completed' | 'stopped';
}

export class TextTurnDto {
  @ApiProperty() @IsString() text!: string;
}

export class AudioTurnDto {
  @ApiProperty({ type: 'string', format: 'binary' }) audio!: string;
}

class CharacterDto {
  @ApiProperty() name!: string;
  @ApiProperty() role!: string;
  @ApiProperty() wants!: string;
}

class ScenarioBriefDto {
  @ApiProperty() scenarioId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() situation!: string;
  @ApiProperty() yourRole!: string;
  @ApiProperty() goal!: string;
  @ApiProperty({ type: () => CharacterDto }) character!: CharacterDto;
  @ApiProperty() expectedMinutes!: number;
  @ApiProperty() maxCandidateTurns!: number;
}

export class TurnDto {
  @ApiProperty() turnId!: string;
  @ApiProperty({ enum: ['candidate', 'character'] }) speaker!: 'candidate' | 'character';
  @ApiProperty() text!: string;
  @ApiProperty({ format: 'date-time' }) startedAt!: string;
  @ApiProperty({ format: 'date-time' }) endedAt!: string;
  /** Candidate turns only: the recogniser's lowest confidence, null for a typed turn. A flag, never a penalty. */
  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0, maximum: 1 })
  recognitionConfidence?: number | null;
}

export class SimulationDto {
  @ApiProperty() simulationId!: string;
  @ApiProperty() candidateId!: string;
  @ApiProperty({ type: () => ScenarioBriefDto }) scenario!: ScenarioBriefDto;
  @ApiProperty({ enum: ['voice', 'text'] }) mode!: 'voice' | 'text';
  @ApiProperty() accommodation!: boolean;
  @ApiProperty({ enum: ['active', 'completed'] }) status!: 'active' | 'completed';
  @ApiProperty({ enum: ['opening', 'in-progress', 'wrapping-up', 'finished'] }) stage!: 'opening' | 'in-progress' | 'wrapping-up' | 'finished';
  @ApiProperty({ enum: ['completed', 'stopped'], nullable: true }) ending!: 'completed' | 'stopped' | null;
  @ApiProperty({ format: 'date-time' }) startedAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true }) completedAt!: string | null;
  @ApiProperty({ type: () => [TurnDto] }) turns!: TurnDto[];
}

export class TurnResultDto {
  @ApiProperty({ type: () => TurnDto }) candidateTurn!: TurnDto;
  @ApiProperty({ type: () => TurnDto }) characterTurn!: TurnDto;
  @ApiProperty({ enum: ['opening', 'in-progress', 'wrapping-up', 'finished'] }) stage!: 'opening' | 'in-progress' | 'wrapping-up' | 'finished';
  @ApiProperty({ enum: ['active', 'completed'] }) status!: 'active' | 'completed';
  @ApiProperty() candidateTurns!: number;
  @ApiProperty({ nullable: true }) recognitionConfidence!: number | null;
  @ApiProperty({ nullable: true }) characterAudioUrl!: string | null;
}
