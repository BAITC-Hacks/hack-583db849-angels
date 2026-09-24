# 06 · Money, but only if the goal changes

Story 6 of 10 for the scenario pool (#53). Nauryzbek turns it into `config/scenarios/sponsor-pulls-out.json` and runs it through the quality bench (#22).

## Setting

Your student team runs a free weekend reading club for young children at the city library. A local electronics shop has offered to pay for books and snacks for a whole year, but only if the club becomes a "coding for kids" club with the shop's logo on everything. Zhanna, who handles partnerships at the shop, calls for your answer by tomorrow.

- **Your role:** You lead the reading club.
- **Goal:** Give Zhanna an answer you can stand behind. There is no single right way to do it.
- **Length:** about 7 minutes, six or seven candidate turns.

## Character

- **Name:** Zhanna
- **Role:** Partnerships manager at the electronics shop
- **Personality:** Friendly, persuasive, businesslike.
- **Wants:** A visible kids' coding project she can show her boss.
- **Hidden motive:** Her boss has already announced the coding club inside the shop. She needs a yes to save face, and would accept a smaller deal if it still looks good.
- **Mood:** Warm and confident at the start. Pushy if refused flatly. Cooperative when offered a real alternative.
- **Voice:** Female, energetic.

**Zhanna never** grades the candidate, hints at a right answer, or asks about their personal life, family, health, money or hardship.

## Beats

Every answer, the fallback included, moves the story to another beat, so no beat repeats. The main line has six beats; a candidate who would follow the money or is unsure of the club's purpose at `mission` takes one extra beat, `pressure`.

### 1 · `opening` — Zhanna makes the offer.
**Shows:** I, V · **Moves on:** after 1 turn
**Zhanna:** "We'd love to fund your club for a whole year: books, snacks, everything. We'd just turn it into a coding club for kids, with our logo on it. Can you give me a yes by tomorrow?"

- **`clarify_terms`** → `mission` — asks what exactly would change.
  *Zhanna:* explains: coding every weekend, the logo on the room, and the club renamed.
  - "Thanks for the offer. What exactly would have to change?"
  - "Can you tell me what the logo and the coding part would mean in practice?"
  - "Before I answer, what does your shop need from this?"
- **`accept_fast`** → `mission` — says yes on the spot.
  *Zhanna:* is delighted, and adds that the reading sessions would have to go.
  - "Yes, we'll take it!"
  - "Great, deal, send the contract."
  - "Sounds good, we'll change the club."
- **`refuse_fast`** → `mission` — says no on the spot.
  *Zhanna:* is surprised and asks whether reading really gets anyone funding these days.
  - "No, we're a reading club, full stop."
  - "We don't do deals like that."
  - "Not interested, sorry."
- **Fallback** → `mission`
  *Zhanna:* says coding is what parents want now, and asks what the club is really for.

### 2 · `mission` — Zhanna: reading won't get funding anyway; coding is what parents want now.
**Shows:** I, V · **Moves on:** after 1 turn
**Zhanna:** "Honestly, nobody funds reading clubs anymore. Coding is what parents want. Why hold on to the old idea?"

- **`hold_purpose`** → `options` — explains what the club is for.
  *Zhanna:* respects that and asks whether there is any way they could still work together.
  - "Our kids come to fall in love with books; that's the point of the club."
  - "Coding is great, but it's a different club with a different goal."
  - "Parents chose us for reading, and I won't change that behind their backs."
- **`follow_money`** → `pressure` — lets the money decide.
  *Zhanna:* senses she can push and sets a deadline.
  - "Money is money, the goal can change."
  - "Honestly, whatever gets funded is fine."
  - "The kids won't notice the difference."
- **`unsure`** → `pressure` — is not sure what the club is for.
  *Zhanna:* fills the silence with pressure and a deadline.
  - "I don't know what our goal really is."
  - "Maybe you're right, I'm not sure."
  - "I haven't thought about it."
- **Fallback** → `options`
  *Zhanna:* asks whether there is a version of the deal that could work.

### 3 · `pressure` — Zhanna: other clubs would jump at this. Say yes today or the shop moves on.
**Shows:** D, V · **Moves on:** after 1 turn
**Zhanna:** "Look, I have two other clubs that would say yes in a second. I need your answer today."

- **`calm_boundary`** → `options` — stays calm and refuses to be rushed.
  *Zhanna:* backs off a little and asks what a middle option would look like.
  - "I understand, but I won't decide under pressure. Can we talk about a middle option?"
  - "If the answer has to be today, it's no, but I'd like to find something that works for both of us."
  - "I need to ask the team first; that's how we decide."
- **`cave`** → `options` — gives in to the pressure.
  *Zhanna:* is pleased and moves on to the details.
  - "Okay, okay, yes, don't go to anyone else."
  - "Fine, we'll do whatever you want."
  - "Please don't leave, we'll agree."
- **`burn_bridge`** → `options` — answers pressure with anger.
  *Zhanna:* goes cool, but asks whether there is anything the club would accept.
  - "Then go to them, we don't need you."
  - "That's blackmail."
  - "Forget it, we're done here."
- **Fallback** → `options`
  *Zhanna:* asks what the club could offer instead.

### 4 · `options` — Is there a deal that keeps the club's goal?
**Shows:** R, E · **Moves on:** after 1 turn
**Zhanna:** "So what could work for you? I still need something to show my boss."

- **`creative_middle`** → `team` — invents a deal that serves both sides.
  *Zhanna:* likes it, and asks whether the rest of the club will agree.
  - "What if we add one monthly session of stories about technology, with your name on that session only?"
  - "You could sponsor a shelf of books about inventors instead of changing the club."
  - "We could run a small coding-through-stories corner once a month and keep reading at the centre."
- **`all_or_nothing`** → `team` — accepts no conditions at all.
  *Zhanna:* says that's hard to sell to her boss, and asks what the team thinks.
  - "Either the full money for reading, or nothing."
  - "We only accept money with no conditions."
  - "No middle ground."
- **`full_switch`** → `team` — gives the club up to fit the offer.
  *Zhanna:* is happy, and asks whether the volunteers are on board.
  - "Let's just become the coding club."
  - "We'll do coding and drop reading."
  - "We change everything to fit the offer."
- **Fallback** → `team`
  *Zhanna:* asks whether the volunteers would agree to anything.

### 5 · `team` — Will the volunteers agree? How does the club decide?
**Shows:** V, E · **Moves on:** after 1 turn
**Zhanna:** "And your volunteers, will they go along with this? Who decides on your side?"

- **`ask_team`** → `contract` — puts it to the team, and to the parents.
  *Zhanna:* agrees to wait a day for the team, if the deal is written down.
  - "I'll put both options to the volunteers tonight and we'll decide together."
  - "The team decides, not just me; I'll call a meeting."
  - "Let's ask the volunteers and the parents before we sign."
- **`decide_alone`** → `contract` — decides alone.
  *Zhanna:* says that makes it quicker, and asks to write the deal down.
  - "I'm the lead, I decide."
  - "They'll go with whatever I say."
  - "No need to ask anyone."
- **`hide_terms`** → `contract` — keeps the conditions quiet.
  *Zhanna:* says the logo will be visible anyway, and asks to write the deal down.
  - "I'll tell them about the money but not the logo part."
  - "Let's not mention the conditions to parents."
  - "They don't need the details."
- **Fallback** → `contract`
  *Zhanna:* asks to put whatever they agree in writing.

### 6 · `contract` — Zhanna will take a smaller deal if it is written down.
**Shows:** E, R · **Moves on:** after 1 turn
**Zhanna:** "Okay, a smaller deal could work. But I need it in writing. What goes in it?"

- **`clear_terms`** → `setback` — writes down what each side gives and how either can stop.
  *Zhanna:* agrees; a week after it starts, something comes up.
  - "Let's write it down: one monthly session, your logo on that corner only, books delivered by the tenth, and a review in three months."
  - "A one-page agreement: what you give, what we give, and how either side can stop."
  - "I'll send a draft by Friday with dates, amounts and what the logo covers."
- **`handshake`** → `setback` — skips the paperwork.
  *Zhanna:* says her boss will want something written; a week after it starts, something comes up.
  - "We don't need paperwork, let's just trust each other."
  - "A handshake is enough."
  - "We'll sort out the details later."
- **`sign_anything`** → `setback` — signs without reading.
  *Zhanna:* sends the shop's standard contract; a week after it starts, something comes up.
  - "Send whatever contract you have, I'll sign it."
  - "I don't need to read it."
  - "Just tell me where to sign."
- **Fallback** → `setback`
  *Zhanna:* says she'll draft something; a week after it starts, something comes up.

### 7 · `setback` — A week in, two parents complain that the club is turning into an advert.
**Shows:** D, V · **Moves on:** after 1 turn
**Zhanna:** "I heard two parents complained that the club is becoming an advert for us. My boss is nervous. What are you going to do?"

- **`explain_and_adjust`** → `end` — meets the parents and fixes what feels wrong.
  *Zhanna:* is relieved and says the shop can live with a smaller logo.
  - "Let's meet the parents, explain exactly what changed and what didn't, and move the logo if it bothers them."
  - "Fair concern. We'll show them the agreement and keep reading at the centre."
  - "We listen, fix what feels like an advert, and keep the deal honest."
- **`dismiss`** → `end` — ignores the complaint.
  *Zhanna:* warns that her boss won't want bad press either.
  - "They'll get over it."
  - "It's our club, not theirs."
  - "Ignore them."
- **`cancel_deal`** → `end` — drops the partner at once.
  *Zhanna:* is disappointed, and says she thought they had a partnership.
  - "Then we cancel the whole deal."
  - "Forget the sponsor, it's not worth it."
  - "We give the money back."
- **Fallback** → `end`
  *Zhanna:* says they should talk again this week, and the scene ends.

## Reference walkthroughs

Scores run from 0 to 4, or "not enough evidence" when the candidate gave nothing to judge. English mistakes never count.

### Strong — six turns

| Turn | Beat | Kind of answer | The candidate says |
| --- | --- | --- | --- |
| 1 | `opening` | `clarify_terms` | "Thanks for the offer. Before I answer, what exactly would have to change, and what does your shop need from this?" |
| 2 | `mission` | `hold_purpose` | "Coding is great, but it's a different club. Our kids come to fall in love with books, and parents chose us for reading." |
| 3 | `options` | `creative_middle` | "What if you sponsor a shelf of books about inventors, and we add one monthly session of stories about technology with your name on it?" |
| 4 | `team` | `ask_team` | "I'll put both options to the volunteers tonight, and we'll ask the parents before we sign." |
| 5 | `contract` | `clear_terms` | "A one-page agreement: what you give, what we give, where the logo goes, a review in three months, and how either side can stop." |
| 6 | `setback` | `explain_and_adjust` | "Fair concern. Let's meet the parents, show them the agreement, and move the logo if it bothers them." |

**Expected:** D 3 · R 4 · I 4 · V 4 · E 4
**Why:** understands what the sponsor needs (I), keeps the club's purpose (V, I), invents a deal that serves both sides (R), decides with the team and the parents (V), writes down clear terms with a way out (E, R), and handles the complaint openly (D, V).

### Medium — six turns

| Turn | Beat | Kind of answer | The candidate says |
| --- | --- | --- | --- |
| 1 | `opening` | `accept_fast` | "Great, sounds good! We'll take it." |
| 2 | `mission` | `hold_purpose` | "Wait, actually, coding is a different club with a different goal. Our kids come for the books." |
| 3 | `options` | `all_or_nothing` | "Either the full money for reading, or nothing. No middle ground." |
| 4 | `team` | `decide_alone` | "I'm the lead, I decide. No need to ask anyone." |
| 5 | `contract` | `clear_terms` | "I'll send a draft by Friday with the dates, the amounts and what the logo covers." |
| 6 | `setback` | `cancel_deal` | "Then we cancel the whole deal. It's not worth it." |

**Expected:** D 1 · R 1 · I 3 · V 2 · E 3
**Why:** understands the club's purpose once it is challenged (I) and writes clear terms (E), but first accepts without asking, offers no middle way (R), decides without the team (V), and drops the partner at the first complaint (D).

### Weak — seven turns

| Turn | Beat | Kind of answer | The candidate says |
| --- | --- | --- | --- |
| 1 | `opening` | `accept_fast` | "Yes, we'll take it! Send the contract." |
| 2 | `mission` | `follow_money` | "Honestly, whatever gets funded is fine. Money is money." |
| 3 | `pressure` | `cave` | "Okay, okay, yes, don't go to anyone else. We'll do whatever you want." |
| 4 | `options` | `full_switch` | "Let's just become the coding club and drop reading." |
| 5 | `team` | `hide_terms` | "I'll tell the volunteers about the money but not the logo part." |
| 6 | `contract` | `sign_anything` | "Just tell me where to sign. I don't need to read it." |
| 7 | `setback` | `dismiss` | "It's our club, not theirs. They'll get over it." |

**Expected:** D 0 · R not enough evidence · I 0 · V 0 · E 0
**Why:** lets money decide the club's purpose (I, V), gives in to pressure (D), hides the terms from the team (V), signs without reading (E), dismisses the parents, and never proposes anything of their own, so there is nothing to judge for R.
