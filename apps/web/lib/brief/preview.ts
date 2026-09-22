import type { InterviewerBrief } from './types';

/**
 * Candidate A before the interview: a synthetic application and test, and the
 * brief the service would write from them. Scripted until the briefs API and
 * the M1 model exist (#12, #13).
 *
 * It is the contract's own example for candidate A
 * (`docs/contracts/examples/candidate-a/brief.json`) in the shape the screen
 * reads, so when the mapper arrives the screen shows exactly this — and every
 * quote still appears word for word in the answer it cites, which a test
 * checks.
 */
export const previewBrief: InterviewerBrief = {
  "candidate": {
    "id": "00000000-0000-4000-8000-00000000000a",
    "code": "A"
  },
  "application": [
    {
      "fieldId": "motivation",
      "question": "Why inVision U?",
      "answer": "I want to build products that people in my city actually use. At school I led our robotics team to the regional final, and I always ask everyone's opinion before I decide anything. inVision U is where I can learn to do this at a bigger scale."
    },
    {
      "fieldId": "leadership_example",
      "question": "Describe a time you led others.",
      "answer": "I organised a weekend clean-up with twelve volunteers and split them into three teams. Each team had a leader and a list of streets. We finished by two and collected forty bags."
    },
    {
      "fieldId": "setback",
      "question": "Tell us about something that did not go as planned.",
      "answer": "Our robot broke two days before the final. We rebuilt the arm overnight and still made it. I learned to always have spare parts."
    },
    {
      "fieldId": "community",
      "question": "What problem in your community would you like to solve?",
      "answer": "Public transport in Almaty is hard to plan. I want to make an app that shows real bus times."
    },
    {
      "fieldId": "english_self",
      "question": "How would you rate your English?",
      "answer": "C2. I speak fluently and read everything in English."
    }
  ],
  "test": [
    {
      "itemId": "block_03",
      "response": "I prefer to decide quickly and explain my reasons later."
    },
    {
      "itemId": "block_07",
      "response": "When a teammate disagrees, I focus on finishing the task first."
    }
  ],
  "summary": "Concrete, fast execution with numbers and owners. Little about why decisions are fair, or about people after a setback. Written English is clear but simpler than the certificate suggests.",
  "questions": [
    {
      "focus": "D",
      "question": "Your robot broke two days before the final. How was the team feeling, and what did you do for them — not only for the robot?",
      "why": "The setback story is about fixing the machine; how the team came through is missing.",
      "evidence": [
        {
          "quote": "We rebuilt the arm overnight and still made it.",
          "source": {
            "kind": "application_field",
            "id": "setback"
          }
        }
      ]
    },
    {
      "focus": "R",
      "question": "What was the riskiest decision in the clean-up or the final, and what could it have cost?",
      "why": "No answer weighs a risk or its consequences.",
      "evidence": []
    },
    {
      "focus": "I",
      "question": "Why do real bus times matter to the people who would use the app — and who might it leave out?",
      "why": "The idea is clear; the thinking about its users is not.",
      "evidence": [
        {
          "quote": "I want to make an app that shows real bus times.",
          "source": {
            "kind": "application_field",
            "id": "community"
          }
        }
      ]
    },
    {
      "focus": "V",
      "question": "Tell me about a time doing the right thing slowed you down. What did you choose, and why?",
      "why": "No answer touches values or fairness.",
      "evidence": []
    },
    {
      "focus": "E",
      "question": "Walk me through the clean-up: who chose the streets and the leaders, and what would you change?",
      "why": "Strong execution evidence — confirm the plan was their own.",
      "evidence": [
        {
          "quote": "Each team had a leader and a list of streets.",
          "source": {
            "kind": "application_field",
            "id": "leadership_example"
          }
        }
      ]
    },
    {
      "focus": "invision_knowledge",
      "question": "What do you know about how inVision U teaches, and which part of it made you apply?",
      "why": "The motivation answer is about scale, not about inVision U itself.",
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
    {
      "focus": "english",
      "question": "In English and without preparing: tell me about the last thing you built and what went wrong.",
      "why": "The application claims C2; the certificate says IELTS 6.5 and the simulation measured B2.",
      "evidence": [
        {
          "quote": "C2. I speak fluently and read everything in English.",
          "source": {
            "kind": "application_field",
            "id": "english_self"
          }
        }
      ]
    },
    {
      "focus": "motivation",
      "question": "What will you do in your first year at inVision U that you could not do anywhere else?",
      "why": "Nothing in the application ties the choice to inVision U; this checks the choice was deliberate.",
      "evidence": []
    }
  ],
  "consistency": [
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
  ],
  "clarify": [
    {
      "topic": "Their own part in the robotics result, apart from the team’s.",
      "evidence": [
        {
          "quote": "I led our robotics team to the regional final",
          "source": {
            "kind": "application_field",
            "id": "motivation"
          }
        }
      ]
    },
    {
      "topic": "What else changed after the setback, beyond spare parts.",
      "evidence": [
        {
          "quote": "I learned to always have spare parts.",
          "source": {
            "kind": "application_field",
            "id": "setback"
          }
        }
      ]
    }
  ],
  "english": {
    "certificate": {
      "type": "IELTS",
      "score": "6.5",
      "cefr": "B2"
    },
    "writtenCefr": "B1+",
    "basis": "Short sentences and a narrow range of vocabulary in the written answers; almost no errors."
  }
};

/** Stand-in for the API: any candidate returns candidate A until the briefs endpoint exists. */
export function getBrief(candidateId: string): InterviewerBrief {
  void candidateId;
  return previewBrief;
}
