import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

const evidenceSources = ['application_field', 'test_item', 'simulation_turn', 'interview_turn', 'interview_note', 'surprise_answer'] as const;
const focuses = ['D', 'R', 'I', 'V', 'E', 'invision_knowledge', 'english', 'motivation'] as const;
const topics = ['english', 'invision_knowledge', 'motivation', 'experience', 'achievements', 'other'] as const;
const statuses = ['consistent', 'discrepancy', 'unverified', 'confirmed', 'resolved'] as const;

export class CreateBriefDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() candidateId!: string;
}

class BriefEvidenceDto {
  @ApiProperty({ enum: evidenceSources }) source!: (typeof evidenceSources)[number];
  @ApiProperty() sourceId!: string;
  @ApiProperty() quote!: string;
}

class BriefQuestionDto {
  @ApiProperty({ enum: focuses }) focus!: (typeof focuses)[number];
  @ApiProperty() question!: string;
  @ApiProperty() why!: string;
  @ApiProperty({ type: () => [BriefEvidenceDto] }) evidence!: BriefEvidenceDto[];
}

class ConsistencyClaimDto {
  @ApiProperty() text!: string;
  @ApiProperty({ type: () => [BriefEvidenceDto] }) evidence!: BriefEvidenceDto[];
}

class ConsistencyMetricDto {
  @ApiProperty() name!: string;
  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'number' }] }) value!: string | number;
  @ApiProperty({ enum: ['simulation', 'surprise', 'interview'] }) source!: 'simulation' | 'surprise' | 'interview';
}

class ConsistencyObservationDto {
  @ApiProperty() text!: string;
  @ApiProperty({ type: () => [BriefEvidenceDto] }) evidence!: BriefEvidenceDto[];
  @ApiProperty({ type: () => ConsistencyMetricDto, nullable: true }) metric!: ConsistencyMetricDto | null;
}

export class ConsistencyItemDto {
  @ApiProperty() itemId!: string;
  @ApiProperty({ enum: topics }) topic!: (typeof topics)[number];
  @ApiProperty({ type: () => ConsistencyClaimDto }) claim!: ConsistencyClaimDto;
  @ApiProperty({ type: () => ConsistencyObservationDto }) observation!: ConsistencyObservationDto;
  @ApiProperty({ enum: statuses }) status!: (typeof statuses)[number];
  @ApiProperty() whatToDo!: string;
  @ApiProperty({ type: String, nullable: true }) askInInterview!: string | null;
}

class BriefTopicDto {
  @ApiProperty() topic!: string;
  @ApiProperty({ type: () => [BriefEvidenceDto] }) evidence!: BriefEvidenceDto[];
}

class EnglishCertificateDto {
  @ApiProperty() type!: string;
  @ApiProperty() score!: string;
  @ApiProperty() cefr!: string;
}

class BriefEnglishDto {
  @ApiProperty({ type: () => EnglishCertificateDto, nullable: true }) certificate!: EnglishCertificateDto | null;
  @ApiProperty() writtenCefr!: string;
  @ApiProperty() basis!: string;
}

class ApplicationSourceDto {
  @ApiProperty() fieldId!: string;
  @ApiProperty() question!: string;
  @ApiProperty() answer!: string;
}

class TestSourceDto {
  @ApiProperty() itemId!: string;
  @ApiProperty() response!: string;
}

class SurpriseSegmentDto {
  @ApiProperty() segmentId!: string;
  @ApiProperty() text!: string;
  @ApiProperty() startSec!: number;
  @ApiProperty() endSec!: number;
}

class SurpriseSourceDto {
  @ApiProperty() surpriseId!: string;
  @ApiProperty() question!: string;
  @ApiProperty({ type: () => [SurpriseSegmentDto] }) segments!: SurpriseSegmentDto[];
}

class PresentationSourceDto {
  @ApiProperty() presentationId!: string;
  @ApiProperty() prompt!: string;
  @ApiProperty({ type: () => [SurpriseSegmentDto] }) segments!: SurpriseSegmentDto[];
}

class BriefSourcesDto {
  @ApiProperty({ type: () => [ApplicationSourceDto] }) application!: ApplicationSourceDto[];
  @ApiProperty({ type: () => [TestSourceDto] }) test!: TestSourceDto[];
  @ApiProperty({ type: () => SurpriseSourceDto, nullable: true }) surpriseAnswer!: SurpriseSourceDto | null;
  @ApiProperty({ type: () => PresentationSourceDto, nullable: true }) presentation!: PresentationSourceDto | null;
}

/** M1: questions for the interviewer, each traced to its source, and the before-interview consistency. */
export class BriefDto {
  @ApiProperty({ format: 'uuid' }) briefId!: string;
  @ApiProperty({ format: 'uuid' }) candidateId!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty() summary!: string;
  @ApiProperty({ type: () => [BriefQuestionDto] }) questions!: BriefQuestionDto[];
  @ApiProperty({ type: () => [ConsistencyItemDto] }) consistency!: ConsistencyItemDto[];
  @ApiProperty({ type: () => [BriefTopicDto] }) clarify!: BriefTopicDto[];
  @ApiProperty({ type: () => BriefEnglishDto }) english!: BriefEnglishDto;
  @ApiProperty({ type: () => BriefSourcesDto }) sources!: BriefSourcesDto;
}
