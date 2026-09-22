import { Type } from 'class-transformer';
import { IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

class AnswerDto {
  @IsString() fieldId!: string;
  @IsString() question!: string;
  @IsString() answer!: string;
}

class TestAnswerDto {
  @IsString() itemId!: string;
  @IsString() response!: string;
}

export class CreateCandidateDto {
  @IsString() externalId!: string;
  @IsObject() profile!: Record<string, unknown>;
  @ValidateNested() @Type(() => AnswerDto) application!: { answers: AnswerDto[] };
  @ValidateNested() @Type(() => TestAnswerDto) test!: { answers: TestAnswerDto[] };
  @IsOptional() @IsObject() englishCertificate?: Record<string, unknown>;
}
