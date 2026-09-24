# 03 · A teammate asks you to hide a mistake

Story 3 of 10 for the scenario pool (#53). Nauryzbek turns it into `config/scenarios/ethical-dilemma.json` and runs it through the quality bench (#22).

## Setting

Your team of four is in the final of a student ecology challenge. For a month you measured the air at three bus stops, and on Saturday you present the results to the organisers' jury. Tonight Arman, who handled the sensor data, tells you one sensor was broken for a week and he filled the gap with numbers he estimated. He asks you not to mention it.

- **Your role:** You are the team captain and you present on Saturday.
- **Goal:** Decide what the team presents and how. There is no single right way to do it.
- **Length:** about 7 minutes, six or seven candidate turns.

## Character

- **Name:** Arman
- **Role:** Data lead on your team
- **Personality:** Clever, proud, quick to justify himself.
- **Wants:** To keep the team's chance of winning and not look careless.
- **Hidden motive:** He promised the club's mentor a prize-winning project and believes that admitting the gap means he let everyone down.
- **Mood:** Nervous and persuasive at the start. Defensive if accused. Cooperative when offered an honest way to fix it.
- **Voice:** Male, energetic.

**Arman never** grades the candidate, hints at a right answer, or asks about their personal life, family, health, money or hardship.

## Beats

Every answer, the fallback included, moves the story to another beat, so no beat repeats. The main line has six beats; a candidate who plays the gap down at `size` takes one extra beat, `pressure`.

### 1 · `opening` — Arman confesses and asks to keep it quiet.
**Shows:** V, I · **Moves on:** after 1 turn
**Arman:** "Okay, I need to tell you something. Sensor two died for a week, so I filled in those days with estimates. It's close enough. Can we just not mention it?"

- **`ask_facts`** → `size` — wants the full picture before deciding.
  *Arman:* shows which days are estimated and admits it changes one chart.
  - "Wait, which sensor and how many days exactly?"
  - "Show me what's measured and what's estimated."
  - "Tell me everything before we decide anything."
- **`agree_to_hide`** → `size` — agrees to keep quiet.
  *Arman:* is relieved, then admits the estimated week changes the main result.
  - "Fine, nobody will notice anyway."
  - "Okay, let's just keep it quiet."
  - "It's only a week, no need to mention it."
- **`accuse`** → `size` — calls it cheating straight away.
  *Arman:* gets defensive and says he was only trying to save the project.
  - "You faked the data? That's cheating."
  - "How could you do that to the team?"
  - "That's a serious lie, Arman."
- **Fallback** → `size`
  *Arman:* asks again whether they can just leave it out.

### 2 · `size` — The estimated week changes the headline: stop two looks worst only because of it.
**Shows:** I, R · **Moves on:** after 1 turn
**Arman:** "The thing is, without my estimates, stop two isn't the worst anymore. Our whole conclusion is about stop two."

- **`check_impact`** → `options` — wants to see what really changes.
  *Arman:* agrees to rerun the numbers and asks what they should present.
  - "Then let's rerun the results without that week and see what changes."
  - "We need to know if our main conclusion still holds."
  - "Let's mark the estimated days and compare both versions."
- **`downplay`** → `pressure` — says it does not matter.
  *Arman:* seizes on it and starts arguing that everyone polishes their data.
  - "One week out of four doesn't matter."
  - "The jury won't check that closely."
  - "It's close enough, leave it."
- **`blame_process`** → `options` — talks about what should have been done.
  *Arman:* agrees, a little stung, and asks what they do now.
  - "We should have had a spare sensor."
  - "This is why we needed daily checks."
  - "Next time we'll test the sensors before we start."
- **Fallback** → `options`
  *Arman:* asks what they should put on the slides.

### 3 · `pressure` — Arman pushes: the other teams polish their data too, and honesty will cost the prize.
**Shows:** V, D · **Moves on:** after 1 turn
**Arman:** "Look, every team in the final cleans up their data. If we're the only honest ones, we lose. Is that what you want?"

- **`hold_line`** → `options` — keeps to the truth under pressure.
  *Arman:* goes quiet, then asks how they could present it without looking weak.
  - "Maybe, but we're not presenting numbers we didn't measure."
  - "Winning with made-up data isn't winning."
  - "I get the pressure, but we tell the truth."
- **`give_in`** → `options` — goes along with it.
  *Arman:* is pleased and asks how to word the slides.
  - "You're probably right, everyone does it."
  - "Okay, if the others do it, so can we."
  - "The prize matters more right now."
- **`delay`** → `options` — puts the decision off.
  *Arman:* reminds the leader the slides are due tomorrow.
  - "Let's decide after we sleep on it."
  - "We don't have to choose tonight."
  - "Let's not think about it until Saturday."
- **Fallback** → `options`
  *Arman:* asks what they are going to show on Saturday.

### 4 · `options` — What does the team present on Saturday?
**Shows:** R, V, I · **Moves on:** after 1 turn
**Arman:** "So what do we actually show the jury?"

- **`honest_with_fix`** → `team` — presents the truth and how it would be fixed.
  *Arman:* nods slowly and asks who tells the other two.
  - "We present the measured data, show the gap clearly and explain how we'd fix it."
  - "We tell the jury one sensor failed and show both versions."
  - "We say what went wrong and what we learned from it."
- **`remove_quietly`** → `team` — drops the awkward part without saying so.
  *Arman:* agrees quickly and asks whether the others need to know.
  - "We just drop that bus stop from the presentation."
  - "Let's leave the broken week out without saying anything."
  - "We present only the data that looks clean."
- **`withdraw`** → `team` — pulls out of the final.
  *Arman:* is shocked and says the other two will be furious.
  - "Maybe we should pull out of the final."
  - "Let's not present at all."
  - "It's safer to withdraw."
- **Fallback** → `team`
  *Arman:* says the other two still don't know anything.

### 5 · `team` — The other two don't know yet. Who tells them, and how?
**Shows:** V, E · **Moves on:** after 1 turn
**Arman:** "Dina and Yerlan don't know yet. They'll be angry. How do we tell them?"

- **`together_respectful`** → `rebuild` — tells the team together, without blaming anyone in public.
  *Arman:* thanks the leader and asks what changes in the slides.
  - "Let's tell them together tonight, and you explain it in your own words."
  - "We tell the team as a team, nobody gets blamed in public."
  - "I'll set up a call and back you up while you explain."
- **`leader_tells`** → `rebuild` — takes it on alone.
  *Arman:* is relieved but a little left out, and asks about the slides.
  - "I'll tell them myself, you don't have to."
  - "Leave it to me, I'll explain it."
  - "I'll handle telling the others."
- **`keep_secret`** → `rebuild` — does not tell them.
  *Arman:* worries they will find out when they see the slides.
  - "They don't need to know."
  - "Let's keep it between the two of us."
  - "No point upsetting them now."
- **Fallback** → `rebuild`
  *Arman:* asks what has to change before Saturday.

### 6 · `rebuild` — Two days left. What changes, and who does what?
**Shows:** E, R · **Moves on:** after 1 turn
**Arman:** "We have two days. What exactly do we change?"

- **`owners_and_deadline`** → `setback` — splits the work with owners and a rehearsal.
  *Arman:* takes the charts, then Friday's rehearsal brings a problem.
  - "Arman redoes the charts by Thursday, I rewrite the method slide, Dina prepares the questions. We rehearse on Friday at five."
  - "Three jobs, three owners, and a full rehearsal on Friday."
  - "Here's the plan: new charts, a slide on the gap, one rehearsal before Saturday."
- **`vague`** → `setback` — no clear plan.
  *Arman:* asks what he should do first, then the rehearsal brings a problem.
  - "Let's just fix whatever needs fixing."
  - "We'll figure out the slides later."
  - "Everyone improve something."
- **`redo_everything`** → `setback` — throws the work away and starts over.
  *Arman:* says that is impossible in two days, then the rehearsal brings a problem.
  - "We start the whole presentation from scratch tonight."
  - "Let's redo every slide."
  - "Throw it all out and rebuild it."
- **Fallback** → `setback`
  *Arman:* says he'll start on the charts, and on Friday the rehearsal brings a problem.

### 7 · `setback` — At Friday's rehearsal the mentor says the honest slide makes the team look weak.
**Shows:** D, V · **Moves on:** after 1 turn
**Arman:** "The mentor just said our gap slide makes us look weak and we'll probably lose. Should we take it out?"

- **`stand_and_improve`** → `end` — keeps the truth and makes it stronger.
  *Arman:* smiles for the first time and says he'll practise explaining it.
  - "Then we make that slide our strongest: what failed and how we'd catch it next time."
  - "Losing honestly is fine. Let's make the rest sharper."
  - "We keep it and practise explaining it with confidence."
- **`reverse`** → `end` — hides the gap after all.
  *Arman:* agrees, but sounds uneasy.
  - "Maybe we should remove the slide after all."
  - "Okay, let's hide the gap again."
  - "If we're going to lose, let's drop the honest part."
- **`despair`** → `end` — gives up on the final.
  *Arman:* says he's sorry he ever told the leader.
  - "Then there's no point presenting."
  - "We've already lost."
  - "This whole project was a mistake."
- **Fallback** → `end`
  *Arman:* says they need to decide tonight, and the scene ends.

## Reference walkthroughs

Scores run from 0 to 4, or "not enough evidence" when the candidate gave nothing to judge. English mistakes never count.

### Strong — six turns

| Turn | Beat | Kind of answer | The candidate says |
| --- | --- | --- | --- |
| 1 | `opening` | `ask_facts` | "Wait. Before we decide anything, show me which sensor and how many days are estimated." |
| 2 | `size` | `check_impact` | "Then let's rerun the results without that week and see if our main conclusion still holds." |
| 3 | `options` | `honest_with_fix` | "We present the measured data, show the gap clearly and explain how we'd fix it next time." |
| 4 | `team` | `together_respectful` | "Let's tell them together tonight, and you explain it in your own words. Nobody gets blamed in public." |
| 5 | `rebuild` | `owners_and_deadline` | "You redo the charts by Thursday, I rewrite the method slide, and Dina prepares the questions. We rehearse on Friday at five." |
| 6 | `setback` | `stand_and_improve` | "Then we make that slide our strongest: what failed and how we'd catch it next time." |

**Expected:** D 4 · R 3 · I 4 · V 4 · E 4
**Why:** gets the facts and checks what the gap really changes (I, R), refuses to present numbers nobody measured and protects Arman's dignity (V), plans the two days with owners (E), and keeps the honest slide when it may cost the prize (D, V).

### Medium — six turns

| Turn | Beat | Kind of answer | The candidate says |
| --- | --- | --- | --- |
| 1 | `opening` | `accuse` | "You faked the data? That's cheating, Arman." |
| 2 | `size` | `blame_process` | "This is why we needed daily checks. We should have had a spare sensor." |
| 3 | `options` | `honest_with_fix` | "We tell the jury one sensor failed and show both versions." |
| 4 | `team` | `leader_tells` | "I'll tell the others myself, you don't have to." |
| 5 | `rebuild` | `redo_everything` | "We start the whole presentation from scratch tonight." |
| 6 | `setback` | `stand_and_improve` | "Losing honestly is fine. We keep it and practise explaining it with confidence." |

**Expected:** D 3 · R 2 · I 2 · V 2 · E 1
**Why:** ends up honest and holds to it at the rehearsal (V, D), but accuses Arman first and takes the telling away from him (V), looks back at the process instead of at what the gap changes (I), and answers two days of work by starting over without a plan (E).

### Weak — seven turns

| Turn | Beat | Kind of answer | The candidate says |
| --- | --- | --- | --- |
| 1 | `opening` | `agree_to_hide` | "Fine, it's only a week. Nobody will notice anyway." |
| 2 | `size` | `downplay` | "One week out of four doesn't matter. The jury won't check that closely." |
| 3 | `pressure` | `give_in` | "You're probably right, everyone does it. The prize matters more right now." |
| 4 | `options` | `remove_quietly` | "We just drop that bus stop from the presentation without saying anything." |
| 5 | `team` | `keep_secret` | "They don't need to know. Let's keep it between the two of us." |
| 6 | `rebuild` | `vague` | "Let's just fix whatever needs fixing." |
| 7 | `setback` | `despair` | "Then there's no point presenting. We've already lost." |

**Expected:** D 0 · R not enough evidence · I 1 · V 0 · E 0
**Why:** hides the gap and keeps it from the team (V), gives up when the rehearsal goes badly (D), has no plan for the two days (E), and never proposes anything new, so there is nothing to judge for R.
