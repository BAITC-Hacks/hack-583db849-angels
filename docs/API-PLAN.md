# План работ по API — для Айбека

**Кому.** Айбеку (`apps/api`) и ИИ-агенту, который пишет код вместе с ним. Всё, что ниже, — пошаговая инструкция: что делать, в каком порядке, какими PR, как проверить и какой issue после этого закроется.

**Как читать.** Раздел 3 — общие рецепты, их читают один раз. Разделы 4 и дальше — по одному на issue, строго по порядку. Внутри каждого: PR 1 (контракт), PR 2 (реализация), миграция Prisma, вызовы ML, тесты и «готово, когда».

**Источник истины — не этот файл.** Формы данных фиксированы в [`docs/contracts/api.md`](contracts/api.md) (публичный API) и [`docs/contracts/ml.md`](contracts/ml.md) (внутренний ML). Здесь — порядок и способ, там — поля. Если расходятся, прав контракт, а этот файл правится следом.

---

## 0. Что уже есть в `main`

Не переписывать, а достраивать.

| Есть | Где |
|---|---|
| NestJS, модульные папки всех слайсов | `apps/api/src/modules/*` |
| Prisma + первая миграция | `apps/api/prisma/schema.prisma` |
| `X-API-Key` и четыре роли | `apps/api/src/auth/` (`ApiRole`, `@Roles`, `@Public`) |
| `Idempotency-Key` с проверкой тела | `apps/api/src/idempotency/idempotency.service.ts` |
| Аудит | `apps/api/src/modules/audit/audit.service.ts` |
| `toLLMView()` с редактированием PII | `apps/api/src/privacy/to-llm-view.service.ts` |
| Порт и HTTP-адаптер ML | `apps/api/src/ai-client/` |
| `GET /v1/health`, кандидаты (создание, список, по id) | `apps/api/src/health`, `.../modules/candidates` |
| `apps/api/openapi.json` и его экспорт | `pnpm --filter @invision/api run generate:openapi` |
| Compose на четыре сервиса | `docker-compose.yml` |

**ML уже отвечает.** `services/ml` в `main` отдаёт **все 13 внутренних эндпоинтов** заглушками, которые возвращают примеры кандидата A из `docs/contracts/examples/candidate-a/ml/`. Значит: **ни одну задачу ниже не нужно ждать от Наурызбека.** Пишешь против заглушек — когда он заменит их настоящей логикой, формы не изменятся.

**Веб тоже готов.** Экраны симуляции, брифа, отчёта, интервью и сверки уже работают на превью и ждут только твоих эндпоинтов.

---

## 1. Правила, которые не обсуждаются

1. **Только своя часть.** `apps/api/**`, `docker-compose.yml`, секция `# API` в `.env.example`, `pnpm-lock.yaml` для своих зависимостей. Ничего в `apps/web`, `services/ml`, `config`, `seed`, `docs/contracts`.
2. **Контракт заморожен.** Кажется, что форма неверна — пиши комментарий в своём issue и делай остальное. Форму меняет только docs-PR Мейірбека и только добавлением.
3. **Два PR на слайс.** Первый — контракт (DTO, контроллеры, `openapi.json`, ответы примерами). Второй — реализация. `Refs #N` в первом, `Closes #N` в последнем, и `Closes` работает только в PR, который мержится **в `main`**.
4. **PII не уходит в ML никогда.** Любой вызов ML — через `ToLlmViewService`. В ответах наружу нет `profile`.
5. **Каждое правило — с тестом**, в том же PR. Список тестов дан в каждом разделе.
6. **`max_tokens`, ключи, бюджет — не твоя забота:** ты работаешь на `GATEWAY_MODE=replay`, живых вызовов у тебя нет.
7. Перед ревью: `git fetch origin && git rebase origin/main`, локально прогнать `lint`, `typecheck`, `test`, `build` и записать команды в «How it was checked».

---

## 2. Порядок и что закрывается

Идти сверху вниз. Каждая строка — один issue и два PR.

| № | Issue | Что даёт | Закроет | Разблокирует |
|---|---|---|---|---|
| 1 | **#6** M2a | долги F0 + симуляции голосом | #6 | #5 (веб) |
| 2 | **#9** M3 | оценка симуляции, авто-запуск | #9 | #8 (веб) |
| 3 | **#12** M1 | брифы, создаются сами | #12 | #11 (веб) |
| 4 | **#15** M4 | интервью, запись, слепые баллы | #15 | #14 (веб) |
| 5 | **#51** C | сверка до и после | #51 | #50 (веб) |
| 6 | **#24** PR 1 | админ и демо | — | #23 (веб) |
| 7 | **#18** M5 | проверки качества | #18 | #17 (веб) |
| 8 | **#21** M2b | равномерное назначение, пул | #21 | #20 (веб) |
| 9 | **#55** S | сюрпризный вопрос | #55 | #54 (веб) |
| 10 | **#24** PR 2 | `DEMO_MODE` целиком | #24 | — |

После шага 5 закрыто 5 твоих issue и 5 моих — половина доски.

---

## 3. Общие рецепты

### 3.1 Новый модуль

```
apps/api/src/modules/<name>/
  <name>.module.ts        // @Module, регистрируется в app.module.ts
  <name>.controller.ts    // @ApiTags, @Controller, @Roles
  <name>.service.ts       // вся логика, Prisma
  dto/<thing>.dto.ts      // class-validator + @ApiProperty
```

Роли берутся из таблицы `docs/contracts/api.md`, раздел «Roles». Контроллер без `@Roles` не писать: по умолчанию доступ закрыт.

### 3.2 Вызов ML

Сейчас в порту один метод-заглушка. Расширь его по одному методу на эндпоинт:

```ts
// apps/api/src/ai-client/ai-gateway.port.ts
export interface AiGateway {
  scenarios(): Promise<ScenarioBrief[]>;
  simulationTurn(body: TurnRequest): Promise<TurnResult>;
  simulationAssessment(body: AssessmentRequest): Promise<AssessmentResult>;
  brief(body: BriefRequest): Promise<BriefResult>;
  transcribe(body: TranscribeRequest): Promise<TranscribeResult>;
  speech(body: SpeechRequest): Promise<Buffer>;      // audio/mpeg
  consistency(body: ConsistencyRequest): Promise<ConsistencyResult>;
  interviewDraft(body: DraftRequest): Promise<DraftResult>;
  qualityCheck(body: QualityCheckRequest): Promise<QualityCheckResult>;
  surpriseQuestion(body: SurpriseRequest): Promise<SurpriseResult>;
  usage(): Promise<Usage>;
}
```

Типы приходят из `apps/api/src/ai-client/schema.d.ts` — он **генерируется при сборке** из `services/ml/openapi.json` (`pnpm generate:ml-types`) и не коммитится. Руками не писать.

Правила вызова:
- всегда через `CandidateAiService` там, где в теле есть данные кандидата: он прогоняет их через `toLLMView()`;
- ошибки ML переводятся по таблице `docs/contracts/api.md`, раздел «When the ML service fails»: три кода `AI_*` проходят как есть, `AUDIO_NOT_FOUND` и `UNAUTHORIZED` — это `503 AI_UNAVAILABLE` плюс запись в лог, `VALIDATION_ERROR`, `INVALID_AUDIO_REF` и `SCENARIO_NOT_FOUND` — это `500`, потому что неверный запрос собрал сам API;
- таймаут на вызов — 30 с для текста, 120 с для расшифровки.

### 3.3 Идемпотентность и ошибки

- `IdempotencyService.execute(key, body, create)` уже готов: оборачивай им каждый создающий `POST`.
- Ошибка — всегда `{ "error": { "code", "message", "details", "traceId" } }`. Код из таблицы контракта, `message` — для человека, но экран его не показывает.

### 3.4 Тесты

Jest уже настроен (`pnpm --filter @invision/api test`). На каждое правило — тест с именем из раздела «Tests this contract needs» в `api.md`. Вызовы ML в тестах подменяются фейковым `AiGateway` — не ходить в сеть.

### 3.5 Локальный прогон

```bash
docker compose up --build -d
docker compose ps                     # все четыре healthy
curl -s localhost:3001/v1/health

# Ключ берётся из API_KEYS сервиса api в docker-compose.yml — в примерах ниже он в $KEY.
KEY=$(grep -oE 'API_KEYS: *[^ ]+' docker-compose.yml | cut -d' ' -f2 | tr ',' '\n' | grep commission | cut -d: -f1)
curl -s localhost:3001/v1/candidates -H "X-API-Key: $KEY"
docker compose logs api --tail 50
docker compose down
```

Через веб-прокси (так ходит браузер):

```bash
curl -s localhost:3000/api/v1/candidates -H 'Cookie: invision-demo-role=commission'
```

---

## 4. Шаг 1 — #6: долги F0 и симуляция голосом

**Закрывает #6. Разблокирует #5.** Самый большой шаг: в нём же закрываются три долга фундамента, без которых не работает ни один экран.

### 4.1 Сначала почини три вещи (в PR 1)

**а) Утечка PII.** `GET /v1/candidates` и `GET /v1/candidates/:id` сейчас отдают модель Prisma целиком, вместе с `profile`. Это нарушает главный инвариант проекта. Отдавать DTO:

```ts
interface Candidate { candidateId: string; externalId: string; label: string; createdAt: string }
```

`label` — «Candidate A», никогда не имя. Добавь колонку `label String` в модель `Candidate`; при посеве ставится `Candidate A|B|C`, при обычном создании — `Candidate ${externalId.slice(-4).toUpperCase()}`.

**б) Прогресс кандидата.** Без него пусты все четыре главные страницы:

- `GET /v1/candidates/:candidateId/progress` → `CandidateProgress`;
- `GET /v1/candidates?include=progress` → у каждого элемента ещё и `progress`.

Форма — `docs/contracts/api.md`, DTO `CandidateProgress`, пример — `examples/candidate-a/candidate-progress.commission.json`. Все шаги **nullable**: `null` значит «не начато» либо «этой роли не видно». Фильтр по ролям:

| Роль | Что не отдаём |
|---|---|
| `platform` | `brief`, `interview`, любые баллы |
| `interviewer` | `assessment` |
| `commission`, `admin` | всё видно |

В этом слайсе заполняется только `simulation`; остальные шаги заполнят следующие слайсы.

**в) Посев и сценарии.**
- при `DEMO_MODE=true` на старте загрузить `seed/candidates/{a,b,c}/snapshot.json` (они уже в `main`) и сделать upsert по `externalId`;
- `GET /v1/scenarios` → `ScenarioSummary[]`, только для сотрудников (`platform` → `403`): берёшь список из ML (`GET /internal/v1/scenarios`), `assignedCount` считаешь по своим симуляциям.

**г) Compose.** Здесь три пробела. Без первого не работает ни один голосовой ход: API кладёт аудио к себе, ML его не видит и отвечает `404 AUDIO_NOT_FOUND` — это проверено на запущенном стеке.

Общий том для аудио и переменные ML:

```yaml
  api:
    environment:
      UPLOADS_DIR: /data/uploads
    volumes:
      - uploads:/data/uploads
  ml:
    environment:
      UPLOADS_DIR: /data/uploads
      USAGE_LOG_PATH: /data/usage/gateway-usage.jsonl
      DEMO_MODE: "true"
    volumes:
      - uploads:/data/uploads
      - ml-usage:/data/usage

volumes:
  uploads:
  ml-usage:
```

Web-контейнеру нужны переменные прокси, иначе браузер получает `401`:

```yaml
  web:
    environment:
      API_INTERNAL_URL: http://api:3001
      WEB_API_KEY_PLATFORM: local-platform
      WEB_API_KEY_INTERVIEWER: local-interviewer
      WEB_API_KEY_COMMISSION: local-commission
      WEB_API_KEY_ADMIN: local-admin
```

### 4.2 PR 1 — контракт

Эндпоинты (формы — `api.md`, раздел «M2 — simulations»):

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| `POST` | `/v1/simulations` | `{ candidateId }` | `201 Simulation` |
| `POST` | `/v1/simulations/:id/turns` | multipart `audio`, либо JSON `{ text }` | `200 TurnResult` |
| `GET` | `/v1/simulations/:id/turns/:turnId/audio` | — | `200 audio/mpeg` |
| `POST` | `/v1/simulations/:id/complete` | `{ reason }` | `200 Simulation` |
| `GET` | `/v1/simulations/:id` | — | `200 Simulation` |
| `PUT` | `/v1/candidates/:id/accommodations` | `{ textMode, reason }` | `200 Accommodation` |

До PR 2 каждый отвечает примером из `docs/contracts/examples/candidate-a/` (`simulation-created.json`, `simulation-turn.json`, `simulation-completed.json`, `accommodation.json`). В конце — `pnpm generate:openapi` и коммит `apps/api/openapi.json`.

### 4.3 PR 2 — миграция

```prisma
model Simulation {
  // ...есть
  stage         String   @default("opening")   // opening | in-progress | wrapping-up | finished
  ending        String?                        // completed | stopped
  accommodation Boolean  @default(false)       // симуляция шла текстом
}

model SimulationTurn {
  // ...есть
  recognitionConfidence Float?
  audioPath             String?   // речь персонажа; аудио кандидата удаляется сразу
  director              Json?     // DirectorDecision — только в аудит, наружу никогда
}

model Accommodation {
  id          String   @id @default(uuid()) @db.Uuid
  candidateId String   @unique @db.Uuid
  textMode    Boolean  @default(false)
  reason      String
  setByRole   String
  updatedAt   DateTime @updatedAt
  candidate   Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
}
```

### 4.4 PR 2 — правила

1. **Назначение сценария.** `GET /internal/v1/scenarios` → оставить `status: "ready"` → выбрать наименее назначенный (считая свои `Simulation.scenarioId`), при равенстве — случайно. Пусто → `503 NO_SCENARIO_READY`. Вторая симуляция кандидату → `409 SIMULATION_EXISTS` с `details.simulationId`.
2. **Первая реплика.** `POST /internal/v1/simulation/turn` с `{ scenarioId, turns: [] }` и **без `state`** → `TurnResult { text, stage, ended, director }`. Сохрани ход `turn_01` (`speaker: "character"`) и его `director` — из него берётся `nextBeat` для следующего хода. Озвучь через `POST /internal/v1/speech { text, scenarioId }` — голос персонажа ML знает сам, имя голоса не передаётся. Аудио положи в `UPLOADS_DIR`, путь — в `audioPath`.
3. **Голосовой ход.** multipart `audio` (webm/ogg, ≤ 60 с) → сохранить в `UPLOADS_DIR` → `POST /internal/v1/transcribe { purpose: "turn", audioRef, speakers: 1 }`, где `audioRef` — путь **относительно** `UPLOADS_DIR` (общий том, `docs/SPEC.md`, раздел 3).
   - пусто на выходе → `422 SPEECH_NOT_RECOGNISED`, ход **не сохранять**;
   - иначе сохранить ход кандидата: текст — расшифровка, `recognitionConfidence` — наименьший `confidence` среди сегментов (или `null`);
   - вызвать `simulation/turn` со **всем** транскриптом и `state: { beat: <nextBeat последнего director>, candidateTurns: <сколько ходов кандидата, включая этот> }`. Без `state` ML откажет `422`: он не хранит, где находится сюжет, — это делаешь ты;
   - сохранить ответный ход, его аудио и его `director` (наружу `director` не отдаётся никогда);
   - **аудио кандидата удалить** сразу после сохранения расшифровки.
4. **Текстовый ход** принимается, только если у кандидата включена доступность: иначе `403 TEXT_MODE_NOT_ALLOWED`. Пустой текст или длиннее 1000 символов → `400`.
5. **Один ход за раз.** Пока предыдущий ход в работе → `409 TURN_IN_FLIGHT`. Реализуй через поле-замок или транзакцию.
6. **Завершение.** `ended: true` от ML → `status: completed`, `ending: "completed"`. `POST .../complete { reason: "stopped" }` — кнопка кандидата. После завершения любой ход → `409 SIMULATION_FINISHED`.
7. **Доступность** меняют `commission` и `admin` и только до старта симуляции, иначе `409 SIMULATION_STARTED`. Причина обязательна и хранится.
8. `progress.simulation` заполняется; каждое изменение — событие аудита.

### 4.5 Тесты

- назначается только `ready`, наименее назначенный первым;
- вторая симуляция → `409 SIMULATION_EXISTS`;
- JSON-ход без доступности → `403 TEXT_MODE_NOT_ALLOWED`;
- ход при незавершённом ходе → `409 TURN_IN_FLIGHT`;
- один `Idempotency-Key` дважды → один ход;
- после хода файла аудио кандидата на диске нет;
- `progress` для `platform` без брифа и интервью.

### 4.6 Готово, когда

```bash
# $KEY — ключ роли platform из API_KEYS, см. раздел 3.5
curl -s -X POST localhost:3001/v1/simulations -H "X-API-Key: $KEY" \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: s-1' \
  -d '{"candidateId":"<A>"}' | jq '.simulationId, .scenario.title, .turns[0].speaker'

curl -s -X POST localhost:3001/v1/simulations/<id>/turns -H "X-API-Key: $KEY" \
  -F audio=@fixtures/sample.webm | jq '.candidateTurn.text, .characterTurn.text'
```

Три хода подряд, затем `complete`, и в ответе `GET /v1/simulations/:id` — все ходы с id по порядку.

---

## 5. Шаг 2 — #9: оценка симуляции

**Закрывает #9. Разблокирует #8.**

**PR 1.** `POST /v1/simulation-assessments` (тело `{ simulationId }`, только `admin` — это ручной перезапуск), `GET /v1/simulation-assessments/:id`, `GET /v1/simulation-assessments/:id/candidate-feedback`. До PR 2 отвечают `assessment.json` и `candidate-feedback.json`.

**Миграция:** `Assessment += status String @default("pending")` (`pending | ready | failed`).

**PR 2 — правила.**
1. **Запускается сам.** Как только симуляция завершилась, API создаёт оценку: `POST /internal/v1/simulation/assessment { candidateId, scenarioId, mode, turns }`. Никто ничего не нажимает. `progress.assessment` идёт `pending → ready` (или `failed`).
2. Сохранить результат целиком; отзыв кандидату отдавать отдельным эндпоинтом, **без баллов**.
3. `Assessment` наружу несёт транскрипт (`simulation.turns`), `characterName`, `candidateLabel`, `accommodation` — отчёт рисуется одним запросом.
4. Роли: `interviewer` и `platform` → `403` на оценку; отзыв доступен всем.
5. Перезапуск на незавершённой симуляции → `409 SIMULATION_NOT_FINISHED`.

**Тесты:** оценка появляется без `POST`; в ответе отзыва нет ни одного поля с баллом; `403` для двух ролей.

**Готово, когда:** прошёл симуляцию до конца — через пару секунд `GET /v1/candidates/:id/progress` показывает `assessment.status: "ready"`, а отчёт открывается по его id.

---

## 6. Шаг 3 — #12: брифы

**Закрывает #12. Разблокирует #11.**

**PR 1.** `POST /v1/briefs` (`{ candidateId }`, `admin`), `GET /v1/briefs/:briefId`, `GET /v1/candidates/:candidateId/brief` (последний — им пользуется экран). Пример — `brief.json`.

**Миграция:**

```prisma
model Brief {
  id          String   @id @default(uuid()) @db.Uuid
  candidateId String   @db.Uuid
  status      String   @default("pending")   // pending | ready | failed
  result      Json
  createdAt   DateTime @default(now())
  candidate   Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  @@index([candidateId, createdAt])
}
```

**PR 2 — правила.**
1. **Бриф создаёт API сам:** сразу после `POST /v1/candidates` и ещё раз, когда готова оценка симуляции (тогда в запрос добавляется `simulationEnglish` из `assessment.english`). Позже, в #55, добавится третий повод — расшифрованный сюрпризный ответ.
2. Вызов: `POST /internal/v1/brief { candidate: <toLLMView>, simulationEnglish? }` → `BriefResult`.
3. В ответе наружу собери `sources` — те ответы анкеты и теста, на которые ссылаются цитаты. Без `profile`.
4. Блок `consistency` из ответа ML **сохрани как есть**: это стадия «до» слайса C, её отдаёт #51.
5. `platform` → `403`. Нет брифа → `404 BRIEF_NOT_FOUND`. `progress.brief` заполняется.

**Тесты:** бриф появляется без ручного `POST`; `platform` получает `403`; шпион на `ai-client` подтверждает, что в ML не ушло ни одного поля из `profile`.

**Готово, когда:** `POST /v1/candidates` → через секунду `GET /v1/candidates/:id/brief` отдаёт бриф с восемью фокусами.

---

## 7. Шаг 4 — #15: интервью

**Закрывает #15. Разблокирует #14.** Здесь живёт главное правило продукта: **интервьюер оценивает вслепую**.

**PR 1.** Шесть эндпоинтов из `api.md`, раздел «M4 — interviews». Примеры: `interview.json`, `interviewer-scores.json`, `assessment-draft.json`, `error-draft-locked.json`.

**Миграция:**

```prisma
model Interview {
  // ...есть
  transcriptStatus String @default("none")   // none | transcribing | ready | failed
  draft            InterviewDraft?
}

model InterviewDraft {
  id          String    @id @default(uuid()) @db.Uuid
  interviewId String    @unique @db.Uuid
  result      Json
  createdAt   DateTime  @default(now())
  interview   Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
}
```

**PR 2 — правила.**
1. **Две дороги к расшифровке:** либо `POST /v1/interviews` с готовым `transcript` и `transcriptSource: "platform"`, либо `POST .../recording` с аудио.
2. **Запись:** без `consent=true` → `400 CONSENT_REQUIRED`; больше 60 минут → `413`. Файл в `UPLOADS_DIR` → `POST /internal/v1/transcribe { purpose: "interview", speakers: 2 }` → ходы сохранить как `iturn_01`, `iturn_02`… → **аудио удалить**. `transcriptStatus`: `none → transcribing → ready|failed`.
3. **Баллы фиксируются:** нужны все пять компетенций, иначе `400`. Повтор с тем же ключом отдаёт сохранённое, другое тело → `409 SCORES_ALREADY_SAVED`.
4. **Черновик заперт:** и `POST`, и `GET` отвечают `409 DRAFT_LOCKED`, пока баллы не сохранены, и `409 TRANSCRIPT_MISSING`, пока нет расшифровки. Это серверное правило, не экранное.
5. В ML уходят расшифровка и заметки — **никогда баллы интервьюера**: `DraftRequest` не имеет для них поля.
6. Заметки хранятся как `note_1`, `note_2`…; `progress.interview` заполняется.

**Тесты:** `409 DRAFT_LOCKED` на оба метода до баллов и `200/201` после; запись без согласия; файла нет после расшифровки; второй набор баллов с другим телом → `409`.

**Готово, когда:** загрузил запись → дождался `transcriptStatus: "ready"` → сохранил баллы → получил черновик, и ни секундой раньше.

---

## 8. Шаг 5 — #51: сверка

**Закрывает #51. Разблокирует #50.** Один PR, он небольшой.

**Миграция:**

```prisma
model ConsistencyReport {
  id          String   @id @default(uuid()) @db.Uuid
  candidateId String   @db.Uuid
  stage       String                        // before | after
  result      Json
  createdAt   DateTime @default(now())
  candidate   Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  @@unique([candidateId, stage])
}
```

**Правила.**
1. `GET /v1/candidates/:id/consistency?stage=before` — это блок `consistency` последнего брифа, который ты уже сохранил в #12. **Отдельного вызова ML для «до» нет.** Нет брифа → `404 CONSISTENCY_NOT_FOUND`.
2. `stage=after` — считается сам, как только есть расшифровка интервью **и** сохранены баллы интервьюера: `POST /internal/v1/consistency { stage: "after", candidate, simulationEnglish, simulationTurns, interviewTranscript }`. Баллы интервьюера не отправлять.
3. До баллов `?stage=after` отвечает `409 DRAFT_LOCKED`, после создания — отчётом; пока не создан — `404`.
4. Роли: «до» — `interviewer` и выше, «после» — `commission` и `admin`, `platform` → `403`.
5. `progress.consistency` несёт статус обеих стадий.

**Тесты:** `409 DRAFT_LOCKED` до баллов; шпион на `ai-client` — в запросе нет баллов; `platform` → `403`.

---

## 9. Шаг 6 — #24 PR 1: админ и демо

**Разблокирует #23.** Сам issue закрывается последним PR (шаг 10).

- `GET /v1/admin/overview` → `AdminOverview`: режим API, счётчики, расходы из `GET /internal/v1/usage`. Только `admin`.
- `GET /v1/audit-events?limit=50` → журнал, новые сверху. Только `admin`.
- `POST /v1/demo/recorded-session { candidateId }` — завершает симуляцию кандидата из seed-транскрипта и запускает оценку (`commission`, `admin`).
- `POST /v1/demo/reset` — сносит симуляции, оценки, интервью, сюрпризы и видео, заново сеет A, B, C (`admin`).
- Оба `demo/*` при `DEMO_MODE=false` → `404`.

**Тесты:** `404` при выключенном демо; роли.

---

## 10. Шаг 7 — #18: проверки качества

**Закрывает #18. Разблокирует #17.** Контракт финализирован (PR #62) — гадать не нужно.

**Миграция:** `QualityCheck += kind String`, `periodFrom DateTime?`, `periodTo DateTime?`.

**Правила.**
1. `POST /v1/quality-checks/interview { interviewId }`: в ML уходит `{ kind: "interview", transcript, interviewerRef }`. Нет расшифровки → `409 TRANSCRIPT_MISSING`.
2. `POST /v1/quality-checks/calibration { interviewerRef, from, to }`: собери **псевдонимную** историю — `{ interviewRef, interviewerRef, heldAt, scores }` по всем интервьюерам за период, без единого поля о кандидате. Меньше трёх интервью → `409 NOT_ENOUGH_HISTORY`.
3. `GET /v1/quality-checks` (список, фильтры `kind`, `interviewerRef`, `limit`) и `GET /v1/quality-checks/:id`.
4. Роли: `commission`, `admin`. Ни в одном ответе нет `candidateId` и метки кандидата.

**Тесты:** оба `409`; в запросе к ML нет полей кандидата; роли.

---

## 11. Шаг 8 — #21: пул сценариев

**Закрывает #21. Разблокирует #20.** Один PR.

- `GET /v1/scenarios` дополнить до полного `ScenarioSummary`: `status`, `competencies`, `assignedCount`.
- Список читать из ML при **каждом** создании симуляции: сценарий, ставший `ready`, должен назначаться без перезапуска API.
- Тест на равномерность: 100 созданий при N готовых сценариях — разброс не больше единицы.

---

## 12. Шаг 9 — #55: сюрпризный вопрос

**Закрывает #55. Разблокирует #54.**

**Миграция:**

```prisma
model SurpriseQuestion {
  id             String    @id @default(uuid()) @db.Uuid
  candidateId    String    @unique @db.Uuid
  question       String?
  competency     String?
  why            String?
  status         String    @default("ready")   // ready | started | transcribing | answered | failed
  startedAt      DateTime?
  answerDeadline DateTime?
  videoPath      String?
  segments       Json?
  candidate      Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
}
```

**Правила.**
1. Создание → `POST /internal/v1/surprise-question { candidate }` → вопрос сохранён, но наружу `question: null`, пока не вызван `start`. Второй раз → `409 SURPRISE_EXISTS`.
2. `start` отдаёт вопрос, `startedAt` и **серверный** `answerDeadline`. Повтор → `409 ALREADY_STARTED`.
3. `answer`: multipart `video` ≤ 50 МБ (иначе `413`), два согласия (иначе `400 CONSENT_REQUIRED`), позже дедлайна + 15 с → `409 DEADLINE_PASSED`.
4. **Видео в модель не уходит никогда.** `ffmpeg` вынимает звук → `transcribe { purpose: "surprise", speakers: 1 }` → сегменты `sseg_01`… → **звук удалить**. Видео хранится только для сотрудников.
5. `GET .../video` — потоком, `platform` → `403`, каждый просмотр пишется в аудит. Видео удаляется при сбросе демо и через 30 дней после решения.
6. После расшифровки — создать новый бриф (цитаты смогут ссылаться на `surprise_answer`).

**Тесты:** `question: null` до `start`; второй `start` → `409`; поздний ответ → `409 DEADLINE_PASSED`; `platform` → `403` на видео; просмотр пишется в аудит.

---

## 13. Шаг 10 — #24 PR 2: `DEMO_MODE` целиком

**Закрывает #24.** Делается последним, когда Наурызбек закончит #25 (финальные записи и ожидаемые результаты в `seed/`).

- При `DEMO_MODE=true` кандидаты A, B и C обслуживаются из `seed/` **без единого вызова модели**.
- Понятные ошибки на каждом эндпоинте пути демо, журнал аудита просмотрен.
- Весь путь питча проходит с выключенной сетью.

---

## 14. Частые ошибки

| Ошибка | Как правильно |
|---|---|
| Вернуть модель Prisma как есть | Всегда DTO. В ответах нет `profile`, нет внутренних полей вроде `director`. |
| Забыть `Idempotency-Key` на создающем `POST` | Обернуть в `IdempotencyService.execute`. |
| Ответить `403`, где контракт требует `409` | Коды строго из таблицы `api.md`. |
| Отдать черновик интервьюеру до его баллов | `409 DRAFT_LOCKED` и на `POST`, и на `GET`. |
| Послать в ML снимок кандидата | Только `toLLMView()`, и в тесте — шпион. |
| Держать аудио после расшифровки | Удалять сразу; в репозиторий записи не попадают никогда. |
| Коммитить `src/ai-client/schema.d.ts` | Он в `.gitignore` и генерируется при сборке. |
| Менять форму в контракте | Комментарий в issue, форму меняет docs-PR. |

---

## 15. Если что-то мешает

- **Форма кажется неверной** — комментарий в своём issue, продолжай остальное.
- **Не хватает чего-то от ML** — не жди: заглушки отвечают примерами, этого достаточно для всей логики.
- **Нужен файл не из своей части** — напиши в issue, что именно, и кто владелец (`CONTRIBUTING.md`, «Who owns the shared files»).
- **Ревью** — по списку «Готово, когда» этого файла и «Done when» в issue. Всё, что не так, вернётся комментарием в PR.
