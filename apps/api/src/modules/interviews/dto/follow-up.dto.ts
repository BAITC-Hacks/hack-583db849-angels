import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

class FollowUpEvidenceDto {
  @ApiProperty({ enum: ['follow_up_answer', 'application_field', 'test_item', 'simulation_turn', 'interview_turn', 'interview_note', 'surprise_answer', 'presentation'] })
  source!: 'follow_up_answer' | 'application_field' | 'test_item' | 'simulation_turn' | 'interview_turn' | 'interview_note' | 'surprise_answer' | 'presentation';
  @ApiProperty() sourceId!: string;
  @ApiProperty() quote!: string;
}

export class FollowUpUploadDto {
  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Candidate audio only: webm, ogg or wav, 3-120 seconds, up to 5 MB.' }) audio?: unknown;
  @ApiPropertyOptional({ maxLength: 500 }) question?: string;
  @ApiPropertyOptional({ enum: ['true'] }) sample?: 'true';
}

export class MarkSuggestionDto {
  @ApiProperty({ enum: ['asked', 'dismissed'] })
  @IsIn(['asked', 'dismissed']) status!: 'asked' | 'dismissed';
}

export class FollowUpSegmentDto {
  @ApiProperty() segmentId!: string;
  @ApiProperty() text!: string;
  @ApiProperty() startSec!: number;
  @ApiProperty() endSec!: number;
}

export class FollowUpSuggestionDto {
  @ApiProperty() suggestionId!: string;
  @ApiProperty() question!: string;
  @ApiProperty({ enum: ['D', 'R', 'I', 'V', 'E'] }) competency!: 'D' | 'R' | 'I' | 'V' | 'E';
  @ApiProperty({ enum: ['mismatch', 'vague', 'no_evidence'] }) reason!: 'mismatch' | 'vague' | 'no_evidence';
  @ApiProperty() why!: string;
  @ApiProperty({ type: () => [FollowUpEvidenceDto] }) evidence!: FollowUpEvidenceDto[];
  @ApiProperty({ enum: ['open', 'asked', 'dismissed'] }) status!: 'open' | 'asked' | 'dismissed';
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) markedAt!: string | null;
}

export class FollowUpDto {
  @ApiProperty({ format: 'uuid' }) followUpId!: string;
  @ApiProperty({ format: 'uuid' }) interviewId!: string;
  @ApiProperty({ type: String, nullable: true }) question!: string | null;
  @ApiProperty({ type: () => [FollowUpSegmentDto] }) answer!: FollowUpSegmentDto[];
  @ApiProperty({ type: () => [FollowUpSuggestionDto] }) suggestions!: FollowUpSuggestionDto[];
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class FollowUpListDto {
  @ApiProperty({ type: () => [FollowUpDto] }) items!: FollowUpDto[];
}
