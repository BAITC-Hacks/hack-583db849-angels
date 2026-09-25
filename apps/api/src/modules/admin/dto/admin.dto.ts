import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const AUDIT_ACTIONS = [
  'candidate.created', 'brief.ready', 'simulation.started', 'simulation.completed', 'simulation.stopped',
  'assessment.ready', 'interview.created', 'recording.uploaded', 'transcript.ready', 'scores.saved',
  'draft.created', 'surprise.started', 'surprise.answered', 'surprise.video.viewed', 'surprise.video.deleted',
  'presentation.submitted', 'presentation.video.viewed', 'presentation.video.deleted',
  'slot.created', 'slot.booked', 'call.joined', 'demo.reset',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

class UsageDto {
  @ApiProperty() liveCalls!: number;
  @ApiProperty() replayedCalls!: number;
  @ApiProperty() spentUsd!: number;
  @ApiProperty() capUsd!: number;
}

class ModuleStateDto {
  @ApiProperty({ enum: ['M1', 'M2', 'M3', 'M4', 'M5', 'S'] }) module!: 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'S';
  @ApiProperty({ enum: ['on', 'off'] }) state!: 'on' | 'off';
}

class CountsDto {
  @ApiProperty() candidates!: number;
  @ApiProperty() simulationsCompleted!: number;
  @ApiProperty() assessmentsReady!: number;
  @ApiProperty() interviewsScored!: number;
}

/** What the demo is made of and how it is running, for the admin. */
export class AdminOverviewDto {
  @ApiProperty() demoMode!: boolean;
  @ApiProperty({ enum: ['live', 'record', 'replay'] }) gatewayMode!: 'live' | 'record' | 'replay';
  @ApiProperty({ enum: ['up', 'down'] }) ml!: 'up' | 'down';
  @ApiProperty({ type: () => UsageDto }) usage!: UsageDto;
  @ApiProperty({ type: () => [ModuleStateDto] }) modules!: ModuleStateDto[];
  @ApiProperty({ type: () => CountsDto }) counts!: CountsDto;
}

export class AuditQueryDto {
  @ApiProperty({ required: false, default: 50 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

export class AuditEventDto {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ format: 'date-time' }) at!: string;
  @ApiProperty({ enum: ['platform', 'interviewer', 'commission', 'admin', 'system'] }) actorRole!: 'platform' | 'interviewer' | 'commission' | 'admin' | 'system';
  @ApiProperty({ enum: AUDIT_ACTIONS }) action!: AuditAction;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) candidateId!: string | null;
  @ApiProperty({ type: String, nullable: true }) candidateLabel!: string | null;
  @ApiProperty({ type: String, nullable: true }) subjectId!: string | null;
}

export class AuditEventListDto {
  @ApiProperty({ type: () => [AuditEventDto] }) items!: AuditEventDto[];
}
