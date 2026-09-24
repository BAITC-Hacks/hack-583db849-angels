# 10 · Twice as many came, nobody is in charge

Story 10 of 10 for the scenario pool (#53). Nauryzbek turns it into `config/scenarios/too-many-volunteers.json` and runs it through the quality bench (#22).

## Setting

You signed up as one of forty volunteers for a Saturday park clean-up run by a student eco club. Eighty people have turned up, the club's organiser is stuck in traffic for an hour, and there are only enough gloves and bags for half of them. Kamila, another volunteer, turns to you: "Everyone's just standing around. Do you know what's going on?"

- **Your role:** A volunteer like everyone else. Nobody has put you in charge.
- **Goal:** Help the morning go well. Whether and how you lead is up to you. There is no single right way to do it.
- **Length:** about 7 minutes, six or seven candidate turns.

## Character

- **Name:** Kamila
- **Role:** Another volunteer at the clean-up
- **Personality:** Friendly, practical, a little impatient.
- **Wants:** To actually clean the park instead of standing around.
- **Hidden motive:** Last year she organised a club event that fell apart, and she is afraid to take charge again, though she would help someone who does.
- **Mood:** Restless at the start. Sceptical if someone starts bossing people around. Cooperative when the leading is shared.
- **Voice:** Female, energetic.

**Kamila never** grades the candidate, hints at a right answer, or asks about their personal life, family, health, money or hardship.

## Beats

Every answer, the fallback included, moves the story to another beat, so no beat repeats. The main line has six beats; a candidate who sends half the volunteers home at `organise` takes one extra beat, `chaos`.

### 1 · `opening` — Kamila asks what is going on.
**Shows:** I, R · **Moves on:** after 1 turn
**Kamila:** "Everyone's just standing around. There are twice as many of us as they planned. Do you know what's going on?"

- **`step_up_check`** → `organise` — finds out what was planned before acting.
  *Kamila:* says she'll help, and points out that people are starting to leave.
  - "Nobody's in charge yet. Let's call the organiser and find out what she wants done."
  - "Let me ask the club what the plan was, then we can get people started."
  - "I'll find out who has the list and the supplies."
- **`wait`** → `organise` — waits for someone else.
  *Kamila:* sighs, and points out that people are starting to leave.
  - "Let's just wait for the organiser."
  - "It's not our job, someone will come."
  - "I'd rather not get involved."
- **`take_command`** → `organise` — starts giving orders.
  *Kamila:* raises an eyebrow, and points out that there are only forty pairs of gloves.
  - "Okay everyone, listen to me!"
  - "I'll just start giving orders."
  - "Follow me, I'll run this."
- **Fallback** → `organise`
  *Kamila:* says people are starting to leave.

### 2 · `organise` — People are drifting away. Eighty people, forty pairs of gloves.
**Shows:** E, V · **Moves on:** after 1 turn
**Kamila:** "Some people are already leaving. We've got eighty people and forty pairs of gloves. What do we do?"

- **`share_fairly`** → `roles` — finds a way for everyone to help.
  *Kamila:* likes it, and asks whether they should split the park into zones.
  - "Let's pair people up: one picks up with gloves, the other holds the bag, and they swap every half hour."
  - "We make teams of four with two pairs of gloves each and rotate."
  - "Everyone gets a turn: pairs share gloves and switch halfway."
- **`send_away`** → `chaos` — sends the extra people home.
  *Kamila:* winces as people start arguing.
  - "Let's just send half of them home."
  - "We don't need eighty people."
  - "Tell the extra people to leave."
- **`wait_for_organiser`** → `roles` — keeps waiting.
  *Kamila:* says the organiser is an hour away, and suggests splitting the park into zones.
  - "The organiser will sort it out when she gets here."
  - "Let's not decide anything until she arrives."
  - "Better not to do anything without permission."
- **Fallback** → `roles`
  *Kamila:* suggests splitting the park into zones.

### 3 · `chaos` — Volunteers argue about being sent away, and a group walks off annoyed.
**Shows:** D, V · **Moves on:** after 1 turn
**Kamila:** "That didn't go well. Some of them are really upset, and a whole group just walked off."

- **`calm_repair`** → `roles` — owns the mistake and finds everyone a job.
  *Kamila:* relaxes and suggests zones for the people who stayed.
  - "Let's apologise to them and find a way everyone can help."
  - "I got that wrong. Let's give them a real job, like sorting the bags or mapping the areas."
  - "Okay, let's reset and make sure everyone who stayed has something to do."
- **`shrug`** → `roles` — doesn't care.
  *Kamila:* frowns, and suggests zones for the people left.
  - "Whatever, it's their choice."
  - "Fewer people is easier anyway."
  - "Not my problem."
- **`argue_back`** → `roles` — argues with the volunteers.
  *Kamila:* says arguing won't clean the park, and suggests zones.
  - "They should have signed up properly."
  - "I'm not going to beg them to stay."
  - "If they're angry, they can leave too."
- **Fallback** → `roles`
  *Kamila:* suggests splitting the rest into zones.

### 4 · `roles` — Split the park into zones? Who leads each?
**Shows:** V, E · **Moves on:** after 1 turn
**Kamila:** "Should we split the park into zones? Someone has to lead each one."

- **`share_lead`** → `safety` — shares the leading.
  *Kamila:* agrees to lead the lake side; soon after, someone finds something dangerous.
  - "Let's ask four people to each lead a zone. Could you take the lake side?"
  - "We split into zones, and each group picks its own lead."
  - "You know the park; could you lead one zone while I coordinate?"
- **`do_it_all`** → `safety` — leads everything alone.
  *Kamila:* shrugs and goes to work; soon after, someone finds something dangerous.
  - "I'll lead all the zones myself."
  - "Everyone just report to me."
  - "I'll run around and manage everyone."
- **`no_structure`** → `safety` — lets people go where they like.
  *Kamila:* doubts it will work; soon after, someone finds something dangerous.
  - "Just go wherever you want."
  - "People can figure it out themselves."
  - "No need for zones."
- **Fallback** → `safety`
  *Kamila:* gets people moving; soon after, someone finds something dangerous.

### 5 · `safety` — A volunteer finds broken glass and rusty metal near the playground.
**Shows:** I, R · **Moves on:** after 1 turn
**Kamila:** "Someone found a pile of broken glass and rusty metal by the playground. Half of them don't have gloves. What do we do?"

- **`stop_and_protect`** → `organiser` — keeps people away and calls the right people.
  *Kamila:* tapes it off; then the organiser arrives.
  - "Nobody touches that area. Let's mark it off and tell the organiser and the park office."
  - "Safety first. Gloves or not, broken glass is for the park staff."
  - "Let's tape it off and move that group somewhere else."
- **`carry_on`** → `organiser` — tells people to pick it up anyway.
  *Kamila:* warns that someone will get cut; then the organiser arrives.
  - "Just be careful and pick it up."
  - "It's fine, keep going."
  - "Glass is rubbish too, clean it."
- **`panic_stop`** → `organiser` — stops everything.
  *Kamila:* says there is no need to end the whole morning; then the organiser arrives.
  - "Stop everything, everyone go home!"
  - "This is too dangerous, cancel the clean-up."
  - "We have to call it off."
- **Fallback** → `organiser`
  *Kamila:* keeps people back from the glass; then the organiser arrives.

### 6 · `organiser` — The organiser arrives, surprised, and a little annoyed that someone took over.
**Shows:** V, E · **Moves on:** after 1 turn
**Kamila:** "Here's Asel, the organiser. She looks surprised. She's asking who's been running things."

- **`hand_back`** → `setback` — briefs her and hands it back.
  *Kamila:* says the organiser looks relieved; then it starts to rain.
  - "Here's what we did, who leads each zone, and the spot we marked off. It's yours from here."
  - "Glad you're here. Let me brief you in a minute and hand it over."
  - "We just got things moving; tell us what you want to change."
- **`defend_role`** → `setback` — holds on to the lead.
  *Kamila:* says the organiser looks put out; then it starts to rain.
  - "I had to take charge, nobody else would."
  - "Honestly, it's better if I keep running it."
  - "You weren't here, so I decided."
- **`blame_organiser`** → `setback` — blames the organiser.
  *Kamila:* winces at the tension; then it starts to rain.
  - "This was badly organised from the start."
  - "You should have planned for more people."
  - "It's your fault we had this mess."
- **Fallback** → `setback`
  *Kamila:* says the organiser is taking over; then it starts to rain.

### 7 · `setback` — Rain starts. Half the bags are full, and people want to leave.
**Shows:** D, E · **Moves on:** after 1 turn
**Kamila:** "It's starting to rain. Half the bags are full and people want to go. What now?"

- **`wrap_up_well`** → `end` — finishes safely and thanks everyone.
  *Kamila:* says it was the best clean-up she has been to.
  - "Let's finish the zone we're in, stack the bags by the gate, and thank everyone before they go."
  - "Rain's here. Ten more minutes, then we pack up together and share photos of what we did."
  - "We stop safely now and set a date to finish the rest."
- **`force_stay`** → `end` — makes everyone stay.
  *Kamila:* says people are getting soaked and some are leaving anyway.
  - "Nobody leaves until the park is clean."
  - "A bit of rain never hurt anyone, keep going."
  - "We finish everything no matter what."
- **`abandon`** → `end` — walks away from it.
  *Kamila:* looks at the full bags left in the rain.
  - "Everyone just go home and leave the bags."
  - "Forget it, it's raining."
  - "Just leave everything where it is."
- **Fallback** → `end`
  *Kamila:* says they need to decide quickly, and the scene ends.

## Reference walkthroughs

Scores run from 0 to 4, or "not enough evidence" when the candidate gave nothing to judge. English mistakes never count.

### Strong — six turns

| Turn | Beat | Kind of answer | The candidate says |
| --- | --- | --- | --- |
| 1 | `opening` | `step_up_check` | "Nobody's in charge yet. Let me call the organiser and ask what the plan was, then we can get people started." |
| 2 | `organise` | `share_fairly` | "Let's pair people up: one picks up with gloves, the other holds the bag, and they swap every half hour." |
| 3 | `roles` | `share_lead` | "Let's split into zones and ask four people to each lead one. You know the park; could you take the lake side?" |
| 4 | `safety` | `stop_and_protect` | "Nobody touches that area. Let's tape it off, move that group somewhere else, and tell the park office." |
| 5 | `organiser` | `hand_back` | "Glad you're here. Here's what we did, who leads each zone, and the spot we marked off. It's yours from here." |
| 6 | `setback` | `wrap_up_well` | "Rain's here. Let's finish the zone we're in, stack the bags by the gate, and thank everyone before they go." |

**Expected:** D 3 · R 4 · I 4 · V 4 · E 4
**Why:** steps up without being asked but checks the plan first (R, I), finds a fair way for eighty people to share forty pairs of gloves (V, E), shares the leading (V), protects people from the glass (I, R), hands control back to the organiser (V), and ends the morning well in the rain (D, E).

### Medium — six turns

| Turn | Beat | Kind of answer | The candidate says |
| --- | --- | --- | --- |
| 1 | `opening` | `take_command` | "Okay everyone, listen to me! Follow me, I'll run this." |
| 2 | `organise` | `share_fairly` | "We make teams of four with two pairs of gloves each and rotate." |
| 3 | `roles` | `do_it_all` | "I'll lead all the zones myself. Everyone just report to me." |
| 4 | `safety` | `stop_and_protect` | "Safety first. Nobody touches the glass; let's mark it off." |
| 5 | `organiser` | `defend_role` | "I had to take charge, nobody else would. Honestly, it's better if I keep running it." |
| 6 | `setback` | `force_stay` | "Nobody leaves until the park is clean. A bit of rain never hurt anyone." |

**Expected:** D 1 · R 3 · I 3 · V 1 · E 2
**Why:** takes initiative and handles the glass sensibly (R, I), shares the gloves fairly (E), but gives orders instead of sharing the lead, won't hand control back to the organiser (V), and keeps wet volunteers working instead of adapting (D).

### Weak — seven turns

| Turn | Beat | Kind of answer | The candidate says |
| --- | --- | --- | --- |
| 1 | `opening` | `wait` | "Let's just wait for the organiser. It's not our job." |
| 2 | `organise` | `send_away` | "We don't need eighty people. Let's just send half of them home." |
| 3 | `chaos` | `shrug` | "Whatever, it's their choice. Fewer people is easier anyway." |
| 4 | `roles` | `no_structure` | "Just go wherever you want. No need for zones." |
| 5 | `safety` | `carry_on` | "It's fine, keep going. Just be careful and pick it up." |
| 6 | `organiser` | `blame_organiser` | "This was badly organised from the start. It's your fault we had this mess." |
| 7 | `setback` | `abandon` | "Forget it, it's raining. Just leave everything where it is." |

**Expected:** D 0 · R 0 · I 0 · V 0 · E 0
**Why:** waits, then sends people home and doesn't care that they are upset (V), lets people pick up broken glass without gloves (I, R), organises nothing (E), blames the organiser, and walks away when it rains (D).
