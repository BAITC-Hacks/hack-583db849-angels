import type { Competency } from '../drive';

/**
 * One scenario in the pool, as staff see it. The story itself, the character's
 * hidden motive and the branches never leave the ML service: a scenario a
 * candidate could read beforehand is worth nothing.
 */
export interface ScenarioSummary {
  scenarioId: string;
  title: string;
  /** Only `ready` scenarios are ever assigned — a scenario becomes ready by passing the quality bench. */
  status: 'draft' | 'ready';
  /** Must be all five before it can become ready: otherwise scores from different scenarios cannot be compared. */
  competencies: Competency[];
  assignedCount: number;
}
