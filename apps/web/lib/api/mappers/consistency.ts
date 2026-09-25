import type { components } from '@invision/api-client';
import type { ConsistencyReport } from '../../consistency/types';
import { toConsistencyItem } from './brief';

type WireReport = components['schemas']['ConsistencyReportDto'];

export function toConsistencyReport(report: WireReport): ConsistencyReport {
  return { candidateId: report.candidateId, stage: report.stage, createdAt: report.createdAt, items: report.items.map(toConsistencyItem) };
}
