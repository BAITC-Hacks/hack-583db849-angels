import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

const competencies = ['D', 'R', 'I', 'V', 'E'] as const;
const signalKinds = ['leading_question', 'off_limits_question', 'coverage_gap', 'scale_drift'] as const;
const evidenceSources = ['application_field', 'test_item', 'simulation_turn', 'interview_turn', 'interview_note', 'surprise_answer'] as const;
const day = /^\d{4}-\d{2}-\d{2}$/;

export class InterviewCheckDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() interviewId!: string;
}

export class CalibrationCheckDto {
  @ApiProperty({ example: 'interviewer-2' }) @IsString() @MaxLength(64) interviewerRef!: string;
  @ApiProperty({ example: '2026-09-01', description: 'YYYY-MM-DD, included' }) @Matches(day) from!: string;
  @ApiProperty({ example: '2026-10-01', description: 'YYYY-MM-DD, excluded' }) @Matches(day) to!: string;
}

export class QualityCheckQueryDto {
  @ApiProperty({ enum: ['interview', 'calibration'], required: false }) @IsOptional() @IsIn(['interview', 'calibration']) kind?: 'interview' | 'calibration';
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(64) interviewerRef?: string;
  @ApiProperty({ required: false, default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

class QualityEvidenceDto {
  @ApiProperty({ enum: evidenceSources }) source!: (typeof evidenceSources)[number];
  @ApiProperty() sourceId!: string;
  @ApiProperty() quote!: string;
}

class QualitySignalDto {
  @ApiProperty({ enum: signalKinds }) kind!: (typeof signalKinds)[number];
  @ApiProperty() message!: string;
  @ApiProperty() recommendation!: string;
  @ApiProperty({ enum: competencies, isArray: true }) competencies!: (typeof competencies)[number][];
  @ApiProperty({ type: () => [QualityEvidenceDto] }) evidence!: QualityEvidenceDto[];
}

class TalkShareDto {
  @ApiProperty() interviewer!: number;
  @ApiProperty() candidate!: number;
}

class DriftDto {
  @ApiProperty({ enum: competencies }) competency!: (typeof competencies)[number];
  @ApiProperty() interviewerMean!: number;
  @ApiProperty() panelMean!: number;
  @ApiProperty() delta!: number;
}

/** M5: signals about the process, each with what a person could do next. Never a word about a candidate. */
export class QualityCheckDto {
  @ApiProperty({ format: 'uuid' }) qualityCheckId!: string;
  @ApiProperty({ enum: ['interview', 'calibration'] }) kind!: 'interview' | 'calibration';
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) interviewId!: string | null;
  @ApiProperty({ type: String, nullable: true }) interviewerRef!: string | null;
  @ApiProperty({ type: String, nullable: true }) from!: string | null;
  @ApiProperty({ type: String, nullable: true }) to!: string | null;
  @ApiProperty({ type: Number, nullable: true }) interviews!: number | null;
  @ApiProperty({ type: () => TalkShareDto, nullable: true }) talkShare!: TalkShareDto | null;
  @ApiProperty({ type: () => [DriftDto] }) drift!: DriftDto[];
  @ApiProperty({ type: () => [QualitySignalDto] }) signals!: QualitySignalDto[];
}

export class QualityCheckListDto {
  @ApiProperty({ type: () => [QualityCheckDto] }) items!: QualityCheckDto[];
}
