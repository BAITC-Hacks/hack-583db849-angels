import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

const statuses = ['ready', 'started', 'transcribing', 'answered', 'expired', 'failed'] as const;
const competencies = ['D', 'R', 'I', 'V', 'E'] as const;

export class CreateSurpriseDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() candidateId!: string;
}

/** The multipart body of an answer; the video arrives as the `video` file. */
export class SurpriseAnswerDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'webm or mp4, up to 50 MB' }) video!: unknown;
  @ApiProperty({ enum: ['true'] }) consentVideo!: 'true';
  @ApiProperty({ enum: ['true'] }) consentProcessing!: 'true';
}

export class SurpriseSegmentDto {
  @ApiProperty() segmentId!: string;
  @ApiProperty() text!: string;
  @ApiProperty() startSec!: number;
  @ApiProperty() endSec!: number;
}

/**
 * S: one question about the candidate's own application. `question` is null
 * until `start`. The staff fields are absent for `platform`: the candidate's
 * channel never learns what is targeted, what was transcribed or where the
 * video is.
 */
export class SurpriseQuestionDto {
  @ApiProperty({ format: 'uuid' }) surpriseId!: string;
  @ApiProperty({ format: 'uuid' }) candidateId!: string;
  @ApiProperty({ enum: statuses }) status!: (typeof statuses)[number];
  @ApiProperty({ type: String, nullable: true }) question!: string | null;
  @ApiProperty() answerSeconds!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) startedAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) answerDeadline!: string | null;
  @ApiPropertyOptional({ enum: competencies }) competency?: (typeof competencies)[number];
  @ApiPropertyOptional() why?: string;
  @ApiPropertyOptional({ type: () => [SurpriseSegmentDto], nullable: true }) segments?: SurpriseSegmentDto[] | null;
  @ApiPropertyOptional() videoAvailable?: boolean;
}
