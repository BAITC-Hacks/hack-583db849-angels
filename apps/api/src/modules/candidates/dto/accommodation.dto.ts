import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class UpdateAccommodationDto {
  @ApiProperty() @IsBoolean() textMode!: boolean;
  @ApiProperty() @IsString() @IsNotEmpty() reason!: string;
}

export class AccommodationDto {
  @ApiProperty() candidateId!: string;
  @ApiProperty() textMode!: boolean;
  @ApiProperty() reason!: string;
  @ApiProperty({ enum: ['commission', 'admin'] }) setByRole!: 'commission' | 'admin';
  @ApiProperty({ format: 'date-time' }) setAt!: string;
}
