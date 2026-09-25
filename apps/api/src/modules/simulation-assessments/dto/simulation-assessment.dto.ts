import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

import { TurnDto } from '../../simulations/dto/simulation.dto';

type Competency = 'D' | 'R' | 'I' | 'V' | 'E';

export class CreateSimulationAssessmentDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() simulationId!: string;
}

class AssessmentSimulationDto {
  @ApiProperty() scenarioTitle!: string;
  @ApiProperty() characterName!: string;
  @ApiProperty({ enum: ['voice', 'text'] }) mode!: 'voice' | 'text';
  @ApiProperty() accommodation!: boolean;
  @ApiProperty({ format: 'date-time' }) completedAt!: string;
  @ApiProperty() durationSeconds!: number;
  @ApiProperty({ type: () => [TurnDto] }) turns!: TurnDto[];
}

class AssessmentEvidenceDto {
  @ApiProperty({ enum: ['application_field', 'test_item', 'simulation_turn', 'interview_turn', 'interview_note', 'surprise_answer'] })
  source!: 'application_field' | 'test_item' | 'simulation_turn' | 'interview_turn' | 'interview_note' | 'surprise_answer';
  @ApiProperty() sourceId!: string;
  @ApiProperty() quote!: string;
}

export class AssessmentDriveScoreDto {
  @ApiProperty({ enum: ['D', 'R', 'I', 'V', 'E'] }) competency!: Competency;
  @ApiProperty({ type: Number, enum: [0, 1, 2, 3, 4], nullable: true }) score!: 0 | 1 | 2 | 3 | 4 | null;
  @ApiProperty({ type: String, enum: ['low', 'medium', 'high'], nullable: true }) confidence!: 'low' | 'medium' | 'high' | null;
  @ApiProperty({ type: String, nullable: true }) rationale!: string | null;
  @ApiProperty({ type: () => [AssessmentEvidenceDto] }) evidence!: AssessmentEvidenceDto[];
}

class AssessmentEnglishMetricsDto {
  @ApiProperty({ type: String, nullable: true }) cefrEstimate!: string | null;
  @ApiProperty({ type: Number, nullable: true }) wordsPerMinute!: number | null;
  @ApiProperty({ type: Number, nullable: true }) fillerRate!: number | null;
  @ApiProperty({ type: Number, nullable: true }) meanTurnLength!: number | null;
  @ApiProperty({ type: Number, nullable: true }) lexicalDiversity!: number | null;
  @ApiProperty({ type: Number, nullable: true }) grammarErrorsPer100Words!: number | null;
}

class AssessmentInterviewQuestionDto {
  @ApiProperty({ enum: ['D', 'R', 'I', 'V', 'E'] }) competency!: Competency;
  @ApiProperty() question!: string;
  @ApiProperty() reason!: string;
}

export class SimulationAssessmentDto {
  @ApiProperty({ format: 'uuid' }) assessmentId!: string;
  @ApiProperty({ format: 'uuid' }) simulationId!: string;
  @ApiProperty({ format: 'uuid' }) candidateId!: string;
  @ApiProperty() candidateLabel!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: () => AssessmentSimulationDto }) simulation!: AssessmentSimulationDto;
  @ApiProperty({ type: () => [AssessmentDriveScoreDto] }) scores!: AssessmentDriveScoreDto[];
  @ApiProperty({ type: () => AssessmentEnglishMetricsDto }) english!: AssessmentEnglishMetricsDto;
  @ApiProperty({ type: () => [AssessmentInterviewQuestionDto] }) interviewQuestions!: AssessmentInterviewQuestionDto[];
}

export class CandidateFeedbackDto {
  @ApiProperty({ format: 'uuid' }) assessmentId!: string;
  @ApiProperty() scenarioTitle!: string;
  @ApiProperty({ type: [String] }) strengths!: string[];
  @ApiProperty({ type: [String] }) growth!: string[];
  @ApiProperty({ type: [String] }) nextTime!: string[];
}
