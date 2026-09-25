import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsDateString, IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested,
} from 'class-validator';

import { AssessmentDriveScoreDto } from '../../simulation-assessments/dto/simulation-assessment.dto';

type Competency = 'D' | 'R' | 'I' | 'V' | 'E';
type Score = 0 | 1 | 2 | 3 | 4 | null;

/** A turn as inVision's platform sends it; the API gives it its id. */
export class PlatformTurnDto {
  @ApiProperty({ enum: ['interviewer', 'candidate'] }) @IsIn(['interviewer', 'candidate']) speaker!: 'interviewer' | 'candidate';
  @ApiProperty() @IsString() @MaxLength(5000) text!: string;
  @ApiProperty() @IsNumber() @Min(0) startSec!: number;
  @ApiProperty() @IsNumber() @Min(0) endSec!: number;
}

export class CreateInterviewDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() candidateId!: string;
  @ApiProperty({ format: 'date-time' }) @IsDateString() heldAt!: string;
  @ApiPropertyOptional({ description: 'A pseudonym for the interviewer, such as `interviewer-2`; never a name.', example: 'interviewer-2' })
  @IsOptional() @IsString() @MaxLength(64) interviewerRef?: string;
  @ApiPropertyOptional({ type: () => [PlatformTurnDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(2000) @ValidateNested({ each: true }) @Type(() => PlatformTurnDto) transcript?: PlatformTurnDto[];
  @ApiPropertyOptional({ enum: ['platform'] }) @IsOptional() @IsIn(['platform']) transcriptSource?: 'platform';
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(5000, { each: true }) notes?: string[];
}

/** The multipart body of a recording; the audio arrives as the `audio` file. */
export class InterviewRecordingDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'webm, ogg or wav, up to 60 minutes' }) audio!: unknown;
  @ApiProperty({ enum: ['true'] }) consent!: 'true';
}

export class InterviewTurnDto {
  @ApiProperty() turnId!: string;
  @ApiProperty({ enum: ['interviewer', 'candidate'] }) speaker!: 'interviewer' | 'candidate';
  @ApiProperty() text!: string;
  @ApiProperty() startSec!: number;
  @ApiProperty() endSec!: number;
}

class InterviewNoteDto {
  @ApiProperty() id!: string;
  @ApiProperty() text!: string;
}

/** Every competency, each 0–4 or null for "not enough to judge". */
export class InterviewerScoresDto {
  @ApiProperty({ type: Number, enum: [0, 1, 2, 3, 4], nullable: true }) D!: Score;
  @ApiProperty({ type: Number, enum: [0, 1, 2, 3, 4], nullable: true }) R!: Score;
  @ApiProperty({ type: Number, enum: [0, 1, 2, 3, 4], nullable: true }) I!: Score;
  @ApiProperty({ type: Number, enum: [0, 1, 2, 3, 4], nullable: true }) V!: Score;
  @ApiProperty({ type: Number, enum: [0, 1, 2, 3, 4], nullable: true }) E!: Score;
}

/** Checked by hand in the service: every key must be present, and null is a real answer. */
export class SaveInterviewerScoresDto {
  @ApiProperty({ type: () => InterviewerScoresDto }) @IsObject() scores!: Record<Competency, Score>;
}

export class InterviewDto {
  @ApiProperty({ format: 'uuid' }) interviewId!: string;
  @ApiProperty({ format: 'uuid' }) candidateId!: string;
  @ApiProperty() candidateLabel!: string;
  @ApiProperty({ type: String, nullable: true }) interviewerRef!: string | null;
  @ApiProperty({ format: 'date-time' }) heldAt!: string;
  @ApiProperty({ enum: ['none', 'transcribing', 'ready', 'failed'] }) transcriptStatus!: 'none' | 'transcribing' | 'ready' | 'failed';
  @ApiProperty({ type: String, enum: ['platform', 'recording'], nullable: true }) transcriptSource!: 'platform' | 'recording' | null;
  @ApiProperty({ type: () => [InterviewTurnDto], nullable: true }) transcript!: InterviewTurnDto[] | null;
  @ApiProperty({ type: () => [InterviewNoteDto] }) notes!: InterviewNoteDto[];
  @ApiProperty({ type: () => InterviewerScoresDto, nullable: true }) interviewerScores!: Record<Competency, Score> | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) scoredAt!: string | null;
}

export class InterviewerScoresSavedDto {
  @ApiProperty({ format: 'uuid' }) interviewId!: string;
  @ApiProperty({ type: () => InterviewerScoresDto }) scores!: Record<Competency, Score>;
  @ApiProperty({ format: 'date-time' }) savedAt!: string;
}

/** The AI draft: evidence from the candidate's interview turns and the notes. It never saw the interviewer's scores. */
export class AssessmentDraftDto {
  @ApiProperty({ format: 'uuid' }) interviewId!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: () => [AssessmentDriveScoreDto] }) scores!: AssessmentDriveScoreDto[];
}
