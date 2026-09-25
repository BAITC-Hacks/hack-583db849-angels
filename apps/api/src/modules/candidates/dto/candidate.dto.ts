import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class BriefProgressDto {
  @ApiProperty() briefId!: string;
  @ApiProperty({ enum: ['pending', 'ready', 'failed'] }) status!: 'pending' | 'ready' | 'failed';
}

/** Typing instead of speaking, switched on by staff before the simulation. `null` until someone sets it; staff only. */
class AccommodationProgressDto {
  @ApiProperty() textMode!: boolean;
  @ApiProperty() reason!: string;
}

class SimulationProgressDto {
  @ApiProperty() simulationId!: string;
  @ApiProperty({ enum: ['active', 'completed'] }) status!: 'active' | 'completed';
  @ApiProperty({ enum: ['completed', 'stopped'], nullable: true }) ending!: 'completed' | 'stopped' | null;
}

class AssessmentProgressDto {
  @ApiProperty() assessmentId!: string;
  @ApiProperty({ enum: ['pending', 'ready', 'failed'] }) status!: 'pending' | 'ready' | 'failed';
}

class InterviewProgressDto {
  @ApiProperty() interviewId!: string;
  @ApiProperty({ enum: ['none', 'transcribing', 'ready', 'failed'] }) transcriptStatus!: 'none' | 'transcribing' | 'ready' | 'failed';
  @ApiProperty() scoresSaved!: boolean;
  @ApiProperty() draftReady!: boolean;
}

class SurpriseProgressDto {
  @ApiProperty() surpriseId!: string;
  @ApiProperty({ enum: ['ready', 'started', 'transcribing', 'answered', 'expired', 'failed'] }) status!: 'ready' | 'started' | 'transcribing' | 'answered' | 'expired' | 'failed';
}

class ConsistencyProgressDto {
  @ApiProperty({ enum: ['pending', 'ready', 'failed'], nullable: true }) before!: 'pending' | 'ready' | 'failed' | null;
  @ApiProperty({ enum: ['pending', 'ready', 'failed', 'locked'], nullable: true }) after!: 'pending' | 'ready' | 'failed' | 'locked' | null;
}

export class CandidateProgressDto {
  @ApiProperty() candidateId!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: () => BriefProgressDto, nullable: true }) brief!: BriefProgressDto | null;
  @ApiProperty({ type: () => SimulationProgressDto, nullable: true }) simulation!: SimulationProgressDto | null;
  @ApiProperty({ type: () => AssessmentProgressDto, nullable: true }) assessment!: AssessmentProgressDto | null;
  @ApiProperty({ type: () => InterviewProgressDto, nullable: true }) interview!: InterviewProgressDto | null;
  @ApiProperty({ type: () => SurpriseProgressDto, nullable: true }) surprise!: SurpriseProgressDto | null;
  @ApiProperty({ type: () => ConsistencyProgressDto }) consistency!: ConsistencyProgressDto;
  @ApiProperty({ type: () => AccommodationProgressDto, nullable: true }) accommodation!: AccommodationProgressDto | null;
}

export class CandidateDto {
  @ApiProperty() candidateId!: string;
  @ApiProperty() externalId!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiPropertyOptional({ type: () => CandidateProgressDto }) progress?: CandidateProgressDto;
}

export class CandidateListDto {
  @ApiProperty({ type: () => [CandidateDto] }) items!: CandidateDto[];
}
