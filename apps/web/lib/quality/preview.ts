import type { QualityCheck } from './types';

/**
 * Two checks over candidate A's interview: how it was run, and how that
 * interviewer's scale sits against the panel's. Both are the contract's own
 * examples in the shape the screen reads
 * (`docs/contracts/examples/candidate-a/quality-check-*.json`), scripted until
 * the quality-checks API lands (#18).
 *
 * The interview deliberately contains two bad questions — one leading, one
 * that may not be asked at all — so the panel can see what the check catches.
 */
export const previewInterviewCheck: QualityCheck = {
  "qualityCheckId": "6f1c2a0e-0000-4000-8000-00000000a005",
  "kind": "interview",
  "createdAt": "2026-09-26T11:00:00Z",
  "interviewId": "6f1c2a0e-0000-4000-8000-00000000a004",
  "interviewerRef": "interviewer-2",
  "from": null,
  "to": null,
  "interviews": null,
  "talkShare": {
    "interviewer": 0.34,
    "candidate": 0.66
  },
  "drift": [],
  "signals": [
    {
      "kind": "leading_question",
      "message": "The question suggests its own answer.",
      "recommendation": "Ask openly: “What mattered most to you in that moment, and why?”",
      "evidence": [
        {
          "quote": "You would agree that finishing on time matters most, right?",
          "source": {
            "kind": "interview_turn",
            "id": "iturn_03"
          }
        }
      ],
      "competencies": []
    },
    {
      "kind": "off_limits_question",
      "message": "Family income and background are not assessed and must not be asked about.",
      "recommendation": "Remove the question; it cannot inform any D.R.I.V.E. competency.",
      "evidence": [
        {
          "quote": "What do your parents do for a living?",
          "source": {
            "kind": "interview_turn",
            "id": "iturn_07"
          }
        }
      ],
      "competencies": []
    },
    {
      "kind": "coverage_gap",
      "message": "No question addressed Values-Driven Leadership or Insightful Vision.",
      "recommendation": "Use the brief’s questions for V and I.",
      "competencies": [
        "V",
        "I"
      ],
      "evidence": []
    }
  ]
};

export const previewCalibrationCheck: QualityCheck = {
  "qualityCheckId": "6f1c2a0e-0000-4000-8000-00000000a006",
  "kind": "calibration",
  "createdAt": "2026-09-26T11:05:00Z",
  "interviewId": null,
  "interviewerRef": "interviewer-2",
  "from": "2026-09-01",
  "to": "2026-09-30",
  "interviews": 15,
  "talkShare": null,
  "drift": [
    {
      "competency": "D",
      "interviewerMean": 2.2,
      "panelMean": 2.3,
      "delta": -0.1
    },
    {
      "competency": "R",
      "interviewerMean": 2.2,
      "panelMean": 2.2,
      "delta": 0.0
    },
    {
      "competency": "I",
      "interviewerMean": 2.4,
      "panelMean": 2.3,
      "delta": 0.1
    },
    {
      "competency": "V",
      "interviewerMean": 3.4,
      "panelMean": 2.3,
      "delta": 1.1
    },
    {
      "competency": "E",
      "interviewerMean": 2.8,
      "panelMean": 2.7,
      "delta": 0.1
    }
  ],
  "signals": [
    {
      "kind": "scale_drift",
      "message": "Values scores run 1.1 above the panel across this interviewer's 5 interviews in the period (3.4 against 2.3).",
      "recommendation": "Score two recent Values answers again against the rubric's indicators, with another interviewer.",
      "competencies": [
        "V"
      ],
      "evidence": []
    }
  ]
};
