import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** The same prompt for everyone, in English (api.md, "P — the video presentation"). */
export const PRESENTATION_PROMPT =
  'In one to three minutes, in English: why inVision U, and one time you led other people — what you did, and what came of it.';
export const PRESENTATION_MIN_SECONDS = 60;
export const PRESENTATION_MAX_SECONDS = 180;

/** The multipart body; the video arrives as the `video` file. */
export class SubmitPresentationDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'webm or mp4, 60–180 seconds, up to 100 MB' }) video!: unknown;
  @ApiProperty({ format: 'uuid' }) candidateId!: string;
  @ApiProperty({ enum: ['true'] }) consentVideo!: 'true';
  @ApiProperty({ enum: ['true'] }) consentProcessing!: 'true';
}

export class PresentationSegmentDto {
  @ApiProperty() segmentId!: string;
  @ApiProperty() text!: string;
  @ApiProperty() startSec!: number;
  @ApiProperty() endSec!: number;
}

/** P: the video presentation. The transcript and the video are for staff only. */
export class PresentationDto {
  @ApiProperty({ format: 'uuid' }) presentationId!: string;
  @ApiProperty({ format: 'uuid' }) candidateId!: string;
  @ApiProperty({ enum: ['transcribing', 'ready', 'failed'] }) status!: 'transcribing' | 'ready' | 'failed';
  @ApiProperty() prompt!: string;
  @ApiProperty() durationSec!: number;
  @ApiProperty({ format: 'date-time' }) submittedAt!: string;
  @ApiPropertyOptional({ type: () => [PresentationSegmentDto], nullable: true }) segments?: PresentationSegmentDto[] | null;
  @ApiPropertyOptional() videoAvailable?: boolean;
}
