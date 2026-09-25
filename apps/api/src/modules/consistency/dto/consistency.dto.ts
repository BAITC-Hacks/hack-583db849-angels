import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import { ConsistencyItemDto } from '../../briefs/dto/brief.dto';

export class ConsistencyQueryDto {
  @ApiProperty({ enum: ['before', 'after'] }) @IsIn(['before', 'after']) stage!: 'before' | 'after';
}

/** C: signals with their evidence — what was claimed, what was observed, what to do. Never a verdict. */
export class ConsistencyReportDto {
  @ApiProperty({ format: 'uuid' }) candidateId!: string;
  @ApiProperty({ enum: ['before', 'after'] }) stage!: 'before' | 'after';
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: () => [ConsistencyItemDto] }) items!: ConsistencyItemDto[];
}
