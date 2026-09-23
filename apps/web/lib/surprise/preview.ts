import type { SurpriseQuestion } from './types';

/**
 * Candidate A's surprise question at its three moments: before it is opened,
 * while it is being answered, and as staff read it afterwards. All three are
 * the contract's own examples
 * (`docs/contracts/examples/candidate-a/surprise-question.*.json`), scripted
 * until the endpoints land (#55).
 */
export const previewSurpriseReady: SurpriseQuestion = {
  "surpriseId": "6f1c2a0e-0000-4000-8000-00000000a007",
  "candidateId": "00000000-0000-4000-8000-00000000000a",
  "status": "ready",
  "question": null,
  "answerSeconds": 90,
  "startedAt": null,
  "answerDeadline": null
};

export const previewSurpriseStarted: SurpriseQuestion = {
  "surpriseId": "6f1c2a0e-0000-4000-8000-00000000a007",
  "candidateId": "00000000-0000-4000-8000-00000000000a",
  "status": "started",
  "question": "Your robot broke two days before the final. If you could go back, what would you do differently for the team, not the robot?",
  "answerSeconds": 90,
  "startedAt": "2026-09-25T10:20:00Z",
  "answerDeadline": "2026-09-25T10:21:40Z"
};

export const previewSurpriseAnswered: SurpriseQuestion = {
  "surpriseId": "6f1c2a0e-0000-4000-8000-00000000a007",
  "candidateId": "00000000-0000-4000-8000-00000000000a",
  "status": "answered",
  "question": "Your robot broke two days before the final. If you could go back, what would you do differently for the team, not the robot?",
  "answerSeconds": 90,
  "startedAt": "2026-09-25T10:20:00Z",
  "answerDeadline": "2026-09-25T10:21:40Z",
  "competency": "D",
  "why": "The setback story is about the machine; this asks about the people.",
  "segments": [
    {
      "segmentId": "sseg_01",
      "text": "Honestly, I would talk to the team first. We fixed the arm, but two people were exhausted and I did not notice.",
      "startSec": 3.0,
      "endSec": 14.5
    },
    {
      "segmentId": "sseg_02",
      "text": "I would split the night into shifts, so nobody works until four in the morning.",
      "startSec": 15.0,
      "endSec": 22.0
    },
    {
      "segmentId": "sseg_03",
      "text": "And after the final I would ask everyone what was hard, not only celebrate.",
      "startSec": 23.0,
      "endSec": 30.5
    }
  ],
  "videoAvailable": true
};
