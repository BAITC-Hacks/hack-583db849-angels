import { ApiRole } from '../../auth/roles';
import { CandidateProgressDto } from './dto/candidate.dto';

export function filterProgressForRole(progress: CandidateProgressDto, role: ApiRole): CandidateProgressDto {
  if (role === 'platform') {
    return {
      ...progress,
      brief: null,
      interview: null,
      consistency: { before: null, after: null },
    };
  }
  if (role === 'interviewer') {
    return {
      ...progress,
      assessment: null,
      consistency: { ...progress.consistency, after: null },
    };
  }
  return progress;
}
