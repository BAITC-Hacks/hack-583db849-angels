import type { ScenarioSummary } from './types';

/**
 * The pool as it stands: one scenario through the quality bench, nine still
 * being written. The ready one is the contract's own example
 * (`docs/contracts/examples/candidate-a/scenarios.json`); the rest are the
 * stories of #53, listed as `draft` so the screen shows the real state of the
 * pool rather than a full one.
 *
 * A draft scenario is never assigned to anyone, and its competencies stay
 * empty until the bench confirms it can show all five.
 */
export const previewScenarioPool: ScenarioSummary[] = [
  {
    "scenarioId": "conflict-resolution",
    "title": "A teammate is about to walk away",
    "status": "ready",
    "competencies": [
      "D",
      "R",
      "I",
      "V",
      "E"
    ],
    "assignedCount": 1
  },
  {
    "scenarioId": "resource-crisis",
    "title": "The budget disappears a week before",
    "status": "draft",
    "competencies": [],
    "assignedCount": 0
  },
  {
    "scenarioId": "ethical-dilemma",
    "title": "A teammate asks you to hide a mistake",
    "status": "draft",
    "competencies": [],
    "assignedCount": 0
  },
  {
    "scenarioId": "project-failure",
    "title": "The launch flopped and the team wants to quit",
    "status": "draft",
    "competencies": [],
    "assignedCount": 0
  },
  {
    "scenarioId": "new-idea-resistance",
    "title": "Your new approach meets a wall",
    "status": "draft",
    "competencies": [],
    "assignedCount": 0
  },
  {
    "scenarioId": "sponsor-pulls-out",
    "title": "Money, but only if the goal changes",
    "status": "draft",
    "competencies": [],
    "assignedCount": 0
  },
  {
    "scenarioId": "silent-teammate",
    "title": "One member quietly stopped delivering",
    "status": "draft",
    "competencies": [],
    "assignedCount": 0
  },
  {
    "scenarioId": "deadline-or-quality",
    "title": "Ship something weak, or ask for more time",
    "status": "draft",
    "competencies": [],
    "assignedCount": 0
  },
  {
    "scenarioId": "public-mistake",
    "title": "The team's post misinformed people",
    "status": "draft",
    "competencies": [],
    "assignedCount": 0
  },
  {
    "scenarioId": "too-many-volunteers",
    "title": "Twice as many came, nobody is in charge",
    "status": "draft",
    "competencies": [],
    "assignedCount": 0
  }
];
