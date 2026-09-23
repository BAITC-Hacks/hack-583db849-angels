import { ApiProperty } from '@nestjs/swagger';

export class ScenarioSummaryDto {
  @ApiProperty() scenarioId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: ['draft', 'ready'] }) status!: 'draft' | 'ready';
  @ApiProperty({ type: [String], enum: ['D', 'R', 'I', 'V', 'E'] }) competencies!: ('D' | 'R' | 'I' | 'V' | 'E')[];
  @ApiProperty() assignedCount!: number;
}
