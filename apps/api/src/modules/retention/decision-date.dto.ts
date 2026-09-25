import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class DecisionDateInputDto {
  @ApiProperty({ format: 'date-time', description: 'When the commission decided. The date only — this API never stores a decision.' })
  @IsDateString() decidedAt!: string;
}

export class DecisionDateDto {
  @ApiProperty({ format: 'uuid' }) candidateId!: string;
  @ApiProperty({ format: 'date-time' }) decidedAt!: string;
  @ApiProperty({ format: 'date-time', description: 'decidedAt plus VIDEO_RETENTION_DAYS: the candidate’s videos are deleted from then on.' })
  videosDeletedAfter!: string;
}
