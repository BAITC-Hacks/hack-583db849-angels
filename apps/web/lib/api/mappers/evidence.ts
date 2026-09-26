import type { CompetencyScoreProps } from '../../../components/evidence/CompetencyScore';
import type { EvidenceSource } from '../../../components/evidence/EvidenceQuote';
import type { WireDriveScore, WireEvidence } from '../contract';

/**
 * The wire says `{ source, sourceId }`; a screen shows a chip and a link, so it
 * reads `{ kind, id }`. Everything else is carried across untouched — above
 * all the quote, which is checked word for word against its source and is
 * never rewritten, shortened or translated on the way to the screen.
 */
export function toEvidenceSource(evidence: WireEvidence): EvidenceSource {
  return { kind: evidence.source, id: evidence.sourceId };
}

export function toEvidence(evidence: WireEvidence): { quote: string; source: EvidenceSource } {
  return { quote: evidence.quote, source: toEvidenceSource(evidence) };
}

export function toCompetencyScore(score: WireDriveScore): Omit<CompetencyScoreProps, 'id'> {
  return {
    competency: score.competency,
    score: score.score,
    confidence: score.confidence ?? undefined,
    rationale: score.rationale ?? undefined,
    evidence: score.evidence.map(toEvidence),
  };
}

/** "Candidate A" is how the API labels a candidate; the screens show the letter. */
export function codeFromLabel(label: string): 'A' | 'B' | 'C' {
  const letter = label.trim().slice(-1).toUpperCase();
  return letter === 'B' || letter === 'C' ? letter : 'A';
}

/** A, B or C for the seeded candidates — "Candidate A" exactly — and `null` for anyone the platform sent. */
export function seedCode(label: string): 'A' | 'B' | 'C' | null {
  const match = /^Candidate ([ABC])$/.exec(label.trim());
  return match ? (match[1] as 'A' | 'B' | 'C') : null;
}

/** What a screen prints after "Candidate": the seed's letter, or the tag the API gave a platform applicant. */
export function candidateTag(label: string): string {
  return label.trim().replace(/^Candidate\s+/, '');
}
