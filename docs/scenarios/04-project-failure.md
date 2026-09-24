# 04 · The launch flopped and the team wants to quit

Story 4 of 10 for the scenario pool (#53). Nauryzbek turns it into `config/scenarios/project-failure.json` and runs it through the quality bench (#22).

## Setting

Your team of five spent two months building a free app that helps students swap textbooks on campus. Launch week is over: forty downloads, three swaps, and one review calling it "confusing". At tonight's team meeting Madina, the designer, says it is time to shut it down.

- **Your role:** You started the project and you lead it.
- **Goal:** Decide with the team what happens next. There is no single right way to do it.
- **Length:** about 7 minutes, six or seven candidate turns.

## Character

- **Name:** Madina
- **Role:** Designer on your team
- **Personality:** Honest, blunt, tired after two months of evenings.
- **Wants:** To stop spending evenings on something nobody uses.
- **Hidden motive:** She thinks the confusing screens are her fault and would rather quit than hear it said.
- **Mood:** Flat and discouraged at the start. Defensive if the design is blamed. Cooperative when the team looks at the facts together.
- **Voice:** Female, calm.

**Madina never** grades the candidate, hints at a right answer, or asks about their personal life, family, health, money or hardship.

## Beats

Every answer, the fallback included, moves the story to another beat, so no beat repeats. The main line has six beats; a candidate who blames someone at `facts` takes one extra beat, `blame`.

### 1 · `opening` — Madina proposes shutting the app down.
**Shows:** D, V · **Moves on:** after 1 turn
**Madina:** "Forty downloads, three swaps. I think we should just shut it down and get our evenings back."

- **`hear_her`** → `facts` — listens before arguing.
  *Madina:* says the week has been exhausting and she doesn't see the point anymore.
  - "That's a fair point. What makes you think we should stop?"
  - "I hear you. Tell me what's been hardest this week."
  - "Okay, before anyone decides, I want to hear how you see it."
- **`refuse_quit`** → `facts` — rejects quitting outright.
  *Madina:* shrugs and asks what the numbers are supposed to mean then.
  - "No way, we're not quitting."
  - "We didn't work two months to give up now."
  - "Quitting is not an option."
- **`agree_quit`** → `facts` — agrees to stop at once.
  *Madina:* is surprised it's so easy, and says the others will want to see the numbers first.
  - "You're right, let's shut it down."
  - "Fine, it failed, let's stop."
  - "Honestly, I agree, it's over."
- **Fallback** → `facts`
  *Madina:* says she just wants to know whether anyone thinks it can work.

### 2 · `facts` — What do the numbers actually say?
**Shows:** I, R · **Moves on:** after 1 turn
**Madina:** "Forty downloads, three swaps, one review that says 'confusing'. What do you read from that?"

- **`learn_from_data`** → `direction` — wants to learn why before deciding.
  *Madina:* admits she'd like to know where people got stuck.
  - "Let's look at where people dropped off before we decide."
  - "Three swaps is small, but let's ask those three people why it worked."
  - "We should talk to ten students who downloaded it and never used it."
- **`blame_someone`** → `blame` — says whose fault it is.
  *Madina:* goes quiet at the word "design".
  - "The design is confusing, that's the problem."
  - "Marketing did nothing, that's why."
  - "Whoever built the first screens messed up."
- **`ignore_numbers`** → `direction` — waves the numbers away.
  *Madina:* doubts it and asks what the next month would look like.
  - "Numbers don't matter this early."
  - "Forty downloads is fine, let's keep going."
  - "Let's not overthink the stats."
- **Fallback** → `direction`
  *Madina:* asks what the team should do next month.

### 3 · `blame` — Madina hears the design being blamed and says maybe she should leave the team.
**Shows:** V, D · **Moves on:** after 1 turn
**Madina:** "Right. So it's my screens. Maybe I should just leave the team, then."

- **`repair_respect`** → `direction` — takes it back and makes it the team's result.
  *Madina:* softens and asks what they would change first.
  - "I'm sorry, that came out wrong. It's the team's result, not yours."
  - "We built the app together; nobody failed alone."
  - "Your design got us this far. Let's fix the confusing part together."
- **`double_down`** → `direction` — repeats the blame.
  *Madina:* goes cold and says they can find another designer.
  - "Well, the design is the reason, that's just true."
  - "Facts are facts, the screens are confusing."
  - "Someone has to say it."
- **`move_on`** → `direction` — skips past it.
  *Madina:* says nothing, and the meeting moves on awkwardly.
  - "Let's not get emotional, let's move on."
  - "Okay, whatever, next topic."
  - "We don't have time for this."
- **Fallback** → `direction`
  *Madina:* asks flatly what the plan is, then.

### 4 · `direction` — What should the next month look like?
**Shows:** I, R · **Moves on:** after 1 turn
**Madina:** "Say we don't quit. What do we actually do for the next month?"

- **`focused_experiment`** → `team_energy` — one small test with a clear goal and a stop rule.
  *Madina:* likes that there is an end point, and raises the problem of time.
  - "Let's pick one thing, fix the swap flow, and test it with twenty students in two weeks."
  - "One small experiment: a simpler first screen, and we count the swaps."
  - "We give it one month with a clear goal, and we stop if we don't hit it."
- **`big_relaunch`** → `team_energy` — adds features and relaunches.
  *Madina:* sighs that this means more evenings, and raises the problem of time.
  - "Let's add chat, ratings and a web version."
  - "We rebuild it bigger and relaunch."
  - "More features will bring more users."
- **`drift`** → `team_energy` — keeps it running and waits.
  *Madina:* asks how anyone will know if it's working, and raises the problem of time.
  - "Let's just keep it running and see."
  - "Maybe it grows by itself."
  - "No need to change anything yet."
- **Fallback** → `team_energy`
  *Madina:* says that whatever they do, two people have exams this month.

### 5 · `team_energy` — Two members have exams and want to step back.
**Shows:** V, E · **Moves on:** after 1 turn
**Madina:** "Ali and Dias have exams this month. They want to step back. Honestly, so do I, a little."

- **`honest_ask`** → `plan` — plans around the time people really have.
  *Madina:* relaxes and says she can give a few evenings.
  - "Let's ask everyone how much time they really have this month."
  - "It's okay to step back; let's plan around who's available."
  - "Nobody should feel guilty. Let's split the work by the time people have."
- **`pressure_all`** → `plan` — insists everyone stays in.
  *Madina:* bristles and says that's exactly why people burn out.
  - "Everyone has to stay, we're a team."
  - "Exams are no excuse."
  - "If you step back now, you're letting us down."
- **`carry_alone`** → `plan` — takes the load alone.
  *Madina:* doubts one person can do it, and asks what happens this week.
  - "Fine, I'll do the work myself."
  - "I'll cover whatever they don't do."
  - "Don't worry, I'll handle it."
- **Fallback** → `plan`
  *Madina:* asks what exactly happens this week.

### 6 · `plan` — What exactly happens this week?
**Shows:** E, R · **Moves on:** after 1 turn
**Madina:** "Okay. What happens this week, and who does it?"

- **`owners_and_goal`** → `setback` — sets a goal, owners and a decision date.
  *Madina:* takes the first screen; two weeks later the result comes in.
  - "Madina redraws the first screen by Wednesday, I recruit twenty testers, Ali tracks the swaps. We decide on the thirtieth."
  - "Goal: ten swaps in two weeks. Three tasks, three owners."
  - "By Friday we have a new screen, twenty testers, and one number we watch."
- **`vague`** → `setback` — no owners, no goal.
  *Madina:* asks what "a bit" means; two weeks later the result comes in.
  - "Let's all do what we can."
  - "We'll work on it when we have time."
  - "Everyone pitch in a bit."
- **`hope_harder`** → `setback` — effort without anything to measure.
  *Madina:* asks how they'll know it worked; two weeks later the result comes in.
  - "We'll redesign everything and see if people like it."
  - "Let's work hard and hope it takes off."
  - "We just need to try harder this time."
- **Fallback** → `setback`
  *Madina:* says she'll start on something; two weeks later the result comes in.

### 7 · `setback` — Two weeks later the new screen brought only four swaps.
**Shows:** D, I · **Moves on:** after 1 turn
**Madina:** "Four swaps. After all that. Was it all for nothing?"

- **`learn_and_decide`** → `end` — takes the lesson and decides together.
  *Madina:* says she's glad they tried it properly, and agrees to decide together.
  - "It's not nothing. We learned people want it for exam season. Let's decide together whether to pause or change direction."
  - "Four swaps tell us something. Let's talk to those four and then decide."
  - "We set a stop rule; let's keep to it and keep what we learned."
- **`quit_bitter`** → `end` — ends it bitterly.
  *Madina:* agrees, but says she wishes it had ended better.
  - "Yes, it was a waste of time."
  - "I'm done, let's kill it."
  - "We should never have started."
- **`deny`** → `end` — refuses to see the result.
  *Madina:* says she can't keep going on hope.
  - "It's just bad luck, keep going."
  - "Four swaps is actually great."
  - "Let's ignore it and continue."
- **Fallback** → `end`
  *Madina:* says they need an answer by the next meeting, and the scene ends.

## Reference walkthroughs

Scores run from 0 to 4, or "not enough evidence" when the candidate gave nothing to judge. English mistakes never count.

### Strong — six turns

| Turn | Beat | Kind of answer | The candidate says |
| --- | --- | --- | --- |
| 1 | `opening` | `hear_her` | "I hear you. Before anyone decides, tell me what's been hardest this week." |
| 2 | `facts` | `learn_from_data` | "Let's look at where people dropped off, and talk to ten students who downloaded it and never used it." |
| 3 | `direction` | `focused_experiment` | "One small experiment: a simpler first screen, tested with twenty students in two weeks, and we stop if we don't hit the goal." |
| 4 | `team_energy` | `honest_ask` | "It's okay to step back. Let's ask everyone how much time they really have this month and plan around who's available." |
| 5 | `plan` | `owners_and_goal` | "Goal: ten swaps in two weeks. You redraw the first screen by Wednesday, I recruit twenty testers, and Ali tracks the swaps." |
| 6 | `setback` | `learn_and_decide` | "Four swaps tell us something. Let's talk to those four students and then decide together whether to pause." |

**Expected:** D 4 · R 3 · I 4 · V 4 · E 4
**Why:** listens before arguing (V), learns from the numbers before deciding (I), proposes a small test with a stop rule (R), respects the time people have (V), sets a goal with owners (E), and meets the second disappointment with a decision rather than despair (D).

### Medium — six turns

| Turn | Beat | Kind of answer | The candidate says |
| --- | --- | --- | --- |
| 1 | `opening` | `refuse_quit` | "No way, we didn't work two months to give up now." |
| 2 | `facts` | `learn_from_data` | "Three swaps is small, but let's ask those three people why it worked." |
| 3 | `direction` | `big_relaunch` | "We rebuild it bigger with chat and ratings, and relaunch." |
| 4 | `team_energy` | `carry_alone` | "Fine, I'll cover whatever they don't do." |
| 5 | `plan` | `owners_and_goal` | "By Friday we have a new screen, twenty testers and one number we watch." |
| 6 | `setback` | `learn_and_decide` | "It's not nothing. Let's talk to those four and then decide." |

**Expected:** D 3 · R 2 · I 3 · V 2 · E 3
**Why:** keeps going and learns from the setback (D, I), plans the week with a clear number (E), but dismisses Madina at the start, bets on a big relaunch without naming what could go wrong (R), and carries the team instead of asking what people can give (V).

### Weak — seven turns

| Turn | Beat | Kind of answer | The candidate says |
| --- | --- | --- | --- |
| 1 | `opening` | `agree_quit` | "Honestly, I agree. It failed, let's stop." |
| 2 | `facts` | `blame_someone` | "The design is confusing, that's the problem." |
| 3 | `blame` | `double_down` | "Well, facts are facts. Someone has to say it." |
| 4 | `direction` | `drift` | "Let's just keep it running and see. Maybe it grows by itself." |
| 5 | `team_energy` | `pressure_all` | "Everyone has to stay. Exams are no excuse." |
| 6 | `plan` | `vague` | "Let's all do what we can." |
| 7 | `setback` | `quit_bitter` | "Yes, it was a waste of time. We should never have started." |

**Expected:** D 0 · R not enough evidence · I 1 · V 0 · E 0
**Why:** blames a teammate and repeats it when she is hurt (V), pressures people with exams (V), has no plan (E), gives up bitterly (D), and never proposes anything to try, so there is nothing to judge for R.
