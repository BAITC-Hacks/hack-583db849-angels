import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

import type { MissedBy, SlotStatus } from './slot-status';

const statuses: SlotStatus[] = ['open', 'closed', 'booked', 'waiting', 'live', 'done', 'missed'];

export class CreateSlotDto {
  @ApiProperty({ format: 'date-time' }) @IsDateString() startsAt!: string;
  @ApiProperty({ description: 'A pseudonym for the interviewer, such as `interviewer-2`; never a name.', example: 'interviewer-2' })
  @IsString() @MinLength(1) @MaxLength(64) interviewerRef!: string;
  @ApiPropertyOptional({ minimum: 15, maximum: 90, default: 30 }) @IsOptional() @IsInt() @Min(15) @Max(90) durationMin?: number;
}

export class BookSlotDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() candidateId!: string;
}

export class JoinCallDto {
  @ApiPropertyOptional({ description: 'The candidate\'s answer: may the call be recorded, as audio, for transcription.' })
  @IsOptional() @IsBoolean() consentRecording?: boolean;
}

export class SlotQueryDto {
  @ApiPropertyOptional({ description: 'Only slots nobody has booked, from now on.' })
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() open?: boolean;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() candidateId?: string;
}

export class InterviewSlotDto {
  @ApiProperty({ format: 'uuid' }) slotId!: string;
  @ApiProperty() interviewerRef!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty() durationMin!: number;
  @ApiProperty({ format: 'date-time' }) waitUntil!: string;
  @ApiProperty({ enum: statuses }) status!: SlotStatus;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) candidateId!: string | null;
  @ApiProperty({ type: String, nullable: true }) candidateLabel!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) candidateJoinedAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) interviewerJoinedAt!: string | null;
  @ApiProperty({ enum: ['candidate', 'interviewer', 'both'], nullable: true }) missedBy!: MissedBy | null;
  @ApiProperty() consentRecording!: boolean;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) interviewId!: string | null;
}

export class InterviewSlotListDto {
  @ApiProperty({ type: () => [InterviewSlotDto] }) items!: InterviewSlotDto[];
}

export class CallAccessDto {
  @ApiProperty({ format: 'uuid' }) slotId!: string;
  @ApiProperty({ enum: ['candidate', 'interviewer'] }) side!: 'candidate' | 'interviewer';
  @ApiProperty() url!: string;
  @ApiProperty() token!: string;
  @ApiProperty() room!: string;
  @ApiProperty({ format: 'date-time' }) waitUntil!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) interviewId!: string | null;
}
