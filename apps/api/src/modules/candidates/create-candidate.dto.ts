import { Type } from 'class-transformer';
import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AnswerDto {
  @ApiProperty()
  @IsString() fieldId!: string;
  @ApiProperty()
  @IsString() question!: string;
  @ApiProperty()
  @IsString() answer!: string;
}

class TestAnswerDto {
  @ApiProperty()
  @IsString() itemId!: string;
  @ApiProperty()
  @IsString() response!: string;
}

class ApplicationDto {
  @ApiProperty({ type: () => [AnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];
}

class TestAnswersDto {
  @ApiProperty({ type: () => [TestAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestAnswerDto)
  answers!: TestAnswerDto[];
}

export class CreateCandidateDto {
  @ApiProperty()
  @IsString() externalId!: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject() profile!: Record<string, unknown>;
  @ApiProperty({ type: () => ApplicationDto })
  @ValidateNested()
  @Type(() => ApplicationDto)
  application!: ApplicationDto;
  @ApiProperty({ type: () => TestAnswersDto })
  @ValidateNested()
  @Type(() => TestAnswersDto)
  test!: TestAnswersDto;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional() @IsObject() englishCertificate?: Record<string, unknown>;
}
