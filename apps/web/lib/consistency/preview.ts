import type { ConsistencyReport } from './types';

/**
 * Candidate A's consistency, before the interview and after it. Both are the
 * contract's own examples in the shape the screens read
 * (`docs/contracts/examples/candidate-a/consistency-*.json`), so the mapper in
 * #51 has nothing to reconcile.
 *
 * The story the commission sees: English was claimed at C2 and measured at B2
 * before the interview, and the interview confirmed it; the question about
 * inVision U was never asked, so that item is still unverified — the screen
 * says so rather than quietly dropping it.
 */
export const previewBefore: ConsistencyReport = {
  "candidateId": "00000000-0000-4000-8000-00000000000a",
  "stage": "before",
  "createdAt": "2026-09-25T08:00:00Z",
  "items": [
    {
      "itemId": "c_01",
      "topic": "english",
      "claim": {
        "text": "Rates their English as C2.",
        "evidence": [
          {
            "quote": "C2.",
            "source": {
              "kind": "application_field",
              "id": "english_self"
            }
          }
        ]
      },
      "observation": {
        "text": "The simulation’s speech measured B2; the certificate is IELTS 6.5 (B2).",
        "evidence": [],
        "metric": {
          "name": "cefrEstimate",
          "value": "B2",
          "source": "simulation"
        }
      },
      "status": "discrepancy",
      "whatToDo": "Hold the first minutes of the interview in English on an unprepared topic, and ask inVision to check the certificate.",
      "askInInterview": "In English and without preparing: tell me about the last thing you built and what went wrong."
    },
    {
      "itemId": "c_02",
      "topic": "other",
      "claim": {
        "text": "Says they ask everyone before deciding.",
        "evidence": [
          {
            "quote": "I always ask everyone's opinion before I decide anything.",
            "source": {
              "kind": "application_field",
              "id": "motivation"
            }
          }
        ]
      },
      "observation": {
        "text": "In the test they chose deciding quickly and explaining later.",
        "evidence": [
          {
            "quote": "I prefer to decide quickly and explain my reasons later.",
            "source": {
              "kind": "test_item",
              "id": "block_03"
            }
          }
        ],
        "metric": null
      },
      "status": "discrepancy",
      "whatToDo": "Ask for a recent decision and exactly how it was made.",
      "askInInterview": "Walk me through the last decision you made for a team. Who did you ask first?"
    },
    {
      "itemId": "c_03",
      "topic": "invision_knowledge",
      "claim": {
        "text": "Wants to study at inVision U.",
        "evidence": [
          {
            "quote": "inVision U is where I can learn to do this at a bigger scale.",
            "source": {
              "kind": "application_field",
              "id": "motivation"
            }
          }
        ]
      },
      "observation": {
        "text": "Nothing in the application or the simulation shows what they know about inVision U.",
        "evidence": [],
        "metric": null
      },
      "status": "unverified",
      "whatToDo": "Check what they know about the programme and why this university.",
      "askInInterview": "What do you know about how inVision U teaches, and which part of it made you apply?"
    }
  ]
};

export const previewAfter: ConsistencyReport = {
  "candidateId": "00000000-0000-4000-8000-00000000000a",
  "stage": "after",
  "createdAt": "2026-09-26T10:40:05Z",
  "items": [
    {
      "itemId": "c_01",
      "topic": "english",
      "claim": {
        "text": "Rates their English as C2.",
        "evidence": [
          {
            "quote": "C2.",
            "source": {
              "kind": "application_field",
              "id": "english_self"
            }
          }
        ]
      },
      "observation": {
        "text": "The simulation and the interview both measured B2; the C2 self-rating is not supported.",
        "evidence": [],
        "metric": {
          "name": "cefrEstimate",
          "value": "B2",
          "source": "interview"
        }
      },
      "status": "confirmed",
      "whatToDo": "Treat the English level as B2 against the English requirement, separately from leadership.",
      "askInInterview": null
    },
    {
      "itemId": "c_02",
      "topic": "other",
      "claim": {
        "text": "Says they ask everyone before deciding.",
        "evidence": [
          {
            "quote": "I always ask everyone's opinion before I decide anything.",
            "source": {
              "kind": "application_field",
              "id": "motivation"
            }
          }
        ]
      },
      "observation": {
        "text": "In the interview they again made the plan alone and at once.",
        "evidence": [
          {
            "quote": "I made a plan straight away: owners, a deadline and a full run on Thursday.",
            "source": {
              "kind": "interview_turn",
              "id": "iturn_02"
            }
          }
        ],
        "metric": null
      },
      "status": "confirmed",
      "whatToDo": "The “asks everyone first” claim is not supported; weigh it under Values-Driven Leadership.",
      "askInInterview": null
    },
    {
      "itemId": "c_03",
      "topic": "invision_knowledge",
      "claim": {
        "text": "Wants to study at inVision U.",
        "evidence": [
          {
            "quote": "inVision U is where I can learn to do this at a bigger scale.",
            "source": {
              "kind": "application_field",
              "id": "motivation"
            }
          }
        ]
      },
      "observation": {
        "text": "Nothing in the application or the simulation shows what they know about inVision U.",
        "evidence": [],
        "metric": null
      },
      "status": "unverified",
      "whatToDo": "Not asked in the interview — ask in a follow-up before the decision.",
      "askInInterview": null
    }
  ]
};

/** Stand-ins for the API until `GET /v1/candidates/:id/consistency` exists (#51). */
export function getConsistency(candidateId: string, stage: 'before' | 'after'): ConsistencyReport {
  void candidateId;
  return stage === 'before' ? previewBefore : previewAfter;
}
