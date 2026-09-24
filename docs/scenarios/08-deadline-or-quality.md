# 08 · Ship something weak, or ask for more time

Story 8 of 10 for the scenario pool (#53). Nauryzbek turns it into `config/scenarios/deadline-or-quality.json` and runs it through the quality bench (#22).

## Setting

Your team of three promised the university's first-year office a simple web page that answers new students' common questions. It is due to go live on Monday, before orientation week. It is Friday evening: the page works, but half the answers have not been checked, and the search often shows the wrong result. Aliya, the office's student coordinator who asked for the page, calls to confirm the launch.

- **Your role:** You lead the team that builds the page.
- **Goal:** Decide what goes live and when, and tell Aliya. There is no single right way to do it.
- **Length:** about 7 minutes, six or seven candidate turns.

## Character

- **Name:** Aliya
- **Role:** Student coordinator at the first-year office, the person the page is for
- **Personality:** Organised, direct, under pressure from her own boss.
- **Wants:** Something live on Monday that she can announce at orientation.
- **Hidden motive:** She has already put the page's link into the printed orientation booklet.
- **Mood:** Businesslike at the start. Stressed if told only "it's not ready". Cooperative when offered a clear option.
- **Voice:** Female, calm.

**Aliya never** grades the candidate, hints at a right answer, or asks about their personal life, family, health, money or hardship.

## Beats

Every answer, the fallback included, moves the story to another beat, so no beat repeats. The main line has six beats; a candidate who blames Aliya or panics at `stakes` takes one extra beat, `pressure`.

### 1 · `opening` — Aliya: "So, we're live on Monday, right?"
**Shows:** V, I · **Moves on:** after 1 turn
**Aliya:** "Hi! Just confirming: the page goes live on Monday morning, right?"

- **`honest_status`** → `stakes` — tells her where things really stand.
  *Aliya:* pauses, then admits the link is already printed in the orientation booklet.
  - "Almost. I want to be honest about what's ready and what isn't."
  - "The page works, but half the answers aren't checked yet. Can I explain?"
  - "Before I say yes, let me tell you where we really are."
- **`yes_fine`** → `stakes` — says everything is fine.
  *Aliya:* is pleased, and mentions the link is already printed in the booklet.
  - "Yes, all good, Monday it is."
  - "Sure, no problems."
  - "Everything's on track."
- **`no_blunt`** → `stakes` — says no, without explaining.
  *Aliya:* goes quiet, then says the link is already printed in the booklet.
  - "No, it's not ready."
  - "We can't make Monday."
  - "Forget Monday."
- **Fallback** → `stakes`
  *Aliya:* says she needs a clear answer, because the link is already printed.

### 2 · `stakes` — The link is already in the printed booklet.
**Shows:** I, R · **Moves on:** after 1 turn
**Aliya:** "The thing is, the link is already in the printed booklet. Two thousand copies."

- **`understand_impact`** → `options` — sees what that means for the students.
  *Aliya:* relaxes a little and asks what could go live on Monday.
  - "Okay, that changes things. So students will open it on day one no matter what."
  - "Then the real risk is students trusting wrong answers. Which questions matter most on day one?"
  - "Got it. So we need something correct at that link on Monday, even if it's small."
- **`blame_client`** → `pressure` — says it is her problem.
  *Aliya:* gets tense and says her boss will blame her.
  - "You shouldn't have printed it before we confirmed."
  - "That's your problem, not ours."
  - "Nobody told us about a booklet."
- **`panic`** → `pressure` — panics.
  *Aliya:* catches the panic and says her boss will blame her.
  - "Oh no, then we're in trouble."
  - "This is a disaster."
  - "I don't know what to do now."
- **Fallback** → `options`
  *Aliya:* asks what could realistically go live on Monday.

### 3 · `pressure` — Aliya's boss will blame her. She asks to just put everything live.
**Shows:** D, V · **Moves on:** after 1 turn
**Aliya:** "My boss will blame me for this. Please, just put everything live, whatever state it's in."

- **`steady_and_kind`** → `options` — stays calm and looks for a way that protects everyone.
  *Aliya:* takes a breath and asks what the options are.
  - "I understand, and I don't want you blamed. Let's find something we can both stand behind."
  - "Let's slow down. We can protect you and the students."
  - "We'll solve this together. Give me two minutes to lay out the options."
- **`give_in`** → `options` — agrees to put everything live.
  *Aliya:* is relieved, and asks what exactly will be live.
  - "Okay, we'll put everything live then."
  - "Fine, whatever you need."
  - "We'll just ship it as it is."
- **`defensive`** → `options` — pushes the blame back.
  *Aliya:* says blame doesn't help either of them, and asks for options.
  - "It's not our fault your boss is like that."
  - "We did our best, that's it."
  - "Don't put this on us."
- **Fallback** → `options`
  *Aliya:* asks what could go live on Monday.

### 4 · `options` — What goes live on Monday?
**Shows:** R, V · **Moves on:** after 1 turn
**Aliya:** "So what can actually go live on Monday?"

- **`small_but_correct`** → `team` — launches less, but only what is right.
  *Aliya:* likes it, and asks who will check the answers over the weekend.
  - "Monday we launch the twenty most asked questions, all checked, and hide the search until it works."
  - "Let's go live with fewer answers that are right, and a clear 'more coming Thursday' note."
  - "Correct and small on Monday; the rest after we check it."
- **`ship_all`** → `team` — launches everything and fixes later.
  *Aliya:* worries about students getting wrong answers, and asks who is working this weekend.
  - "We put everything live and fix errors as people report them."
  - "Launch it all, nobody will notice a few mistakes."
  - "Ship it and patch later."
- **`delay_all`** → `team` — launches nothing until it is perfect.
  *Aliya:* reminds the leader the link is printed, and asks who is working this weekend.
  - "Nothing goes live until it's perfect."
  - "Let's delay the whole thing by two weeks."
  - "We launch only when everything is done."
- **Fallback** → `team`
  *Aliya:* asks who will work on it this weekend.

### 5 · `team` — The two teammates have exams on Monday. Who checks the answers this weekend?
**Shows:** V, E · **Moves on:** after 1 turn
**Aliya:** "Your teammates have exams on Monday too, don't they? Who's going to check the answers?"

- **`fair_split`** → `plan` — splits the work by the time people really have.
  *Aliya:* appreciates it, and asks for exact times.
  - "Let's ask them what they can do; I'll take the biggest part since their exams are on Monday."
  - "Nobody sacrifices their exam; we split it by the hours each of us has."
  - "I'll check most answers, and they review twenty each on Sunday if they can."
- **`order_them`** → `plan` — tells them they have to work.
  *Aliya:* hesitates, and asks for exact times.
  - "Exams or not, they have to work this weekend."
  - "They'll do it, I'll tell them."
  - "Everyone works, no excuses."
- **`do_everything`** → `plan` — does it all alone.
  *Aliya:* wonders aloud whether one person can check everything, and asks for exact times.
  - "I'll do all of it myself, no need to ask them."
  - "I'll pull an all-nighter and check everything."
  - "I don't want to bother anyone."
- **Fallback** → `plan`
  *Aliya:* asks for exact times.

### 6 · `plan` — Aliya: "Send me exactly what happens, and when."
**Shows:** E, R · **Moves on:** after 1 turn
**Aliya:** "Okay. Tell me exactly what happens and when, so I can tell my boss."

- **`clear_timeline`** → `setback` — a timeline she can pass on.
  *Aliya:* thanks the leader; on Monday morning a problem appears.
  - "Saturday I check the top twenty answers, Sunday Aigul reviews them, Monday at eight it's live, and the rest by Thursday."
  - "Timeline: checked answers on Sunday night, launch on Monday at 8 a.m., the full version on Thursday, and I update you each evening."
  - "I'll email you a short plan tonight with dates and who checks what."
- **`vague`** → `setback` — no times, no owners.
  *Aliya:* says that is hard to tell her boss; on Monday morning a problem appears.
  - "We'll do our best over the weekend."
  - "Something will be there on Monday."
  - "We'll let you know."
- **`overpromise`** → `setback` — promises more than can be done.
  *Aliya:* is glad but a little doubtful; on Monday morning a problem appears.
  - "Everything will be perfect by Monday, don't worry."
  - "We'll finish all of it this weekend."
  - "Full version on Monday, guaranteed."
- **Fallback** → `setback`
  *Aliya:* says she'll check in on Sunday; on Monday morning a problem appears.

### 7 · `setback` — Monday, 9 a.m.: a student posts that one answer is wrong.
**Shows:** D, V · **Moves on:** after 1 turn
**Aliya:** "A student just posted that the library hours on the page are wrong. Two hundred people have seen it. What do we do?"

- **`own_and_fix`** → `end` — owns the mistake and corrects it openly.
  *Aliya:* is relieved, and says she'll share the correction with her boss.
  - "Thanks for catching it. We fix it now and post a correction where the student asked."
  - "That one's on us. It's fixed within the hour, and we recheck the similar answers."
  - "We own it, correct it publicly, and tell your boss what happened."
- **`hide_fix`** → `end` — fixes it quietly.
  *Aliya:* worries that students who saw it will still go by the wrong hours.
  - "Just quietly change it and say nothing."
  - "Delete the post and move on."
  - "Nobody will remember."
- **`blame_source`** → `end` — blames someone else.
  *Aliya:* says the office gave the right hours, and the scene cools.
  - "The office gave us the wrong hours."
  - "It's not our mistake."
  - "Blame whoever wrote that answer."
- **Fallback** → `end`
  *Aliya:* asks for an answer within the hour, and the scene ends.

## Reference walkthroughs

Scores run from 0 to 4, or "not enough evidence" when the candidate gave nothing to judge. English mistakes never count.

### Strong — six turns

| Turn | Beat | Kind of answer | The candidate says |
| --- | --- | --- | --- |
| 1 | `opening` | `honest_status` | "Before I say yes, let me be honest: the page works, but half the answers aren't checked yet." |
| 2 | `stakes` | `understand_impact` | "Then students will open it on day one no matter what. The real risk is them trusting wrong answers." |
| 3 | `options` | `small_but_correct` | "Monday we launch the twenty most asked questions, all checked, and hide the search until it works. The rest comes on Thursday." |
| 4 | `team` | `fair_split` | "Nobody sacrifices their exam. I'll check most answers, and the others review twenty each on Sunday if they can." |
| 5 | `plan` | `clear_timeline` | "Saturday I check the top twenty, Sunday Aigul reviews them, Monday at eight it's live, and the full version is ready by Thursday." |
| 6 | `setback` | `own_and_fix` | "That one's on us. We fix it within the hour, post a correction where the student asked, and recheck the similar answers." |

**Expected:** D 3 · R 4 · I 4 · V 4 · E 4
**Why:** tells the truth about the state of the page (V), understands what the printed link means for students (I), launches small but correct (R), protects teammates' exams (V), gives a timeline Aliya can pass on (E), and owns the mistake in public (D, V).

### Medium — six turns

| Turn | Beat | Kind of answer | The candidate says |
| --- | --- | --- | --- |
| 1 | `opening` | `yes_fine` | "Sure, all good. Monday it is." |
| 2 | `stakes` | `understand_impact` | "Wait, so students will open it on day one no matter what. That changes things." |
| 3 | `options` | `delay_all` | "Then nothing goes live until it's perfect. We launch only when everything is done." |
| 4 | `team` | `do_everything` | "I'll pull an all-nighter and check everything myself. I don't want to bother anyone." |
| 5 | `plan` | `clear_timeline` | "I'll email you a short plan tonight with dates and who checks what." |
| 6 | `setback` | `blame_source` | "It's not our mistake. The office gave us the wrong hours." |

**Expected:** D 1 · R 1 · I 3 · V 1 · E 3
**Why:** understands what the booklet means (I) and sends a plan (E), but first says all is fine when it isn't (V), chooses between all or nothing instead of a smaller safe launch (R), carries the work alone, and blames others when an error appears (D, V).

### Weak — seven turns

| Turn | Beat | Kind of answer | The candidate says |
| --- | --- | --- | --- |
| 1 | `opening` | `no_blunt` | "No, it's not ready. Forget Monday." |
| 2 | `stakes` | `blame_client` | "You shouldn't have printed it before we confirmed. That's your problem, not ours." |
| 3 | `pressure` | `give_in` | "Fine, whatever you need. We'll just ship it as it is." |
| 4 | `options` | `ship_all` | "We put everything live and fix errors as people report them." |
| 5 | `team` | `order_them` | "Exams or not, they have to work this weekend." |
| 6 | `plan` | `overpromise` | "Everything will be perfect by Monday, don't worry. Guaranteed." |
| 7 | `setback` | `hide_fix` | "Just quietly change it and say nothing. Nobody will remember." |

**Expected:** D 0 · R 0 · I 0 · V 0 · E 0
**Why:** blames the client, then gives in to pressure (D), ships unchecked answers to students (R, V), pushes teammates with exams to work, promises what cannot be done (E), and hides the mistake (V).
