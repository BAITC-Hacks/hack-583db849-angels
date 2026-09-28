# Развёртывание демо на сервере

Ссылка для жюри: демо по HTTPS на своём домене. Запасной путь на сцене — ноутбук (в конце документа).

```
интернет ──443──▶ Caddy ──▶ web :3000 ──▶ api :3001 ──▶ ml :8000
                  HTTPS      Next.js       NestJS        FastAPI
                  сертификат                  │
                  сам                      postgres :5432
```

Наружу открыт только Caddy (80 и 443). API, ML и Postgres видны лишь внутри сети compose. Камера и микрофон в браузере работают только по HTTPS, поэтому без Caddy сюрпризный вопрос, голосовая симуляция и запись интервью на сервере не заработают.

## 1. Что нужно

| | |
|---|---|
| Сервер | Ubuntu 24.04, **4 vCPU, 8 ГБ RAM**, 30 ГБ диска. ML держит в памяти модель для матчера и LanguageTool (Java) |
| Домен | A-запись домена указывает на IP сервера |
| Порты | 80 и 443 открыты. 80 нужен Caddy, чтобы получить сертификат |
| Docker | Docker Engine и Compose **2.24 или новее** (в файле сервера используется `!reset`) |

## 2. Первый запуск

```bash
# Docker
curl -fsSL https://get.docker.com | sh
docker compose version          # 2.24+

# Код
git clone https://github.com/mmeirbek/invisionu-new-chapter.git
cd invisionu-new-chapter

# Настройки
cp .env.example .env
```

В `.env` заполните:

| Переменная | Что написать |
|---|---|
| `DOMAIN` | домен демо, например `demo.invision-leader.id` |
| `POSTGRES_PASSWORD` | случайная строка: `openssl rand -hex 24` |
| `ML_INTERNAL_TOKEN` | случайная строка, общая для api и ml |
| `API_KEYS` | четыре пары `ключ:роль`, у каждой свой случайный ключ: `…:platform,…:interviewer,…:commission,…:admin` |
| `WEB_API_KEY_PLATFORM` и ещё три | те же четыре ключа, по роли |
| `DEMO_MODE` | `true` |
| `GATEWAY_MODE` | `replay` — ML отвечает из записанных ответов и не тратит бюджет |
| `VIDEO_RETENTION_DAYS` | `30` |
| `OPENAI_API_KEY`, `DEEPGRAM_API_KEY` | пусто для `replay`; нужны только для живого режима (раздел 5) |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | видеоинтервью: cloud.livekit.io → проект → Settings → Keys. Пусто — вход в звонок отвечает `503 VIDEO_UNAVAILABLE`, всё остальное работает |
| `INTERVIEW_TIME_ZONE` | можно не заполнять: по умолчанию `Asia/Almaty` |

Файл `.env` никогда не коммитится. Ключи из `.env.example` на сервере не используются.

```bash
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --build
```

Первая сборка занимает 10–15 минут: образ ML скачивает LanguageTool. API сам применяет миграции при старте, а в `DEMO_MODE` сам заводит кандидатов A, B и C вместе с их брифами.

## 3. Проверка

```bash
C="docker compose -f docker-compose.yml -f docker-compose.server.yml"
$C ps                                        # все сервисы healthy, caddy running
curl -s https://$DOMAIN/health               # живость веба
curl -s https://$DOMAIN/api/v1/health        # живость API через веб
```

В браузере на `https://<домен>`:
1. Сертификат настоящий, без предупреждения.
2. Роль «Админ» → плитки: ML «Работает», режим тот, о котором договорились, демо «Включён».
3. Роль «Кандидат» → «Сюрпризный вопрос» → «Проверить камеру и микрофон»: браузер спрашивает разрешение, и видна камера.

### 3.1. Путь питча — скриптом

Скрипт рассчитан на `replay` и сбрасывает демо в начале и конце: созданные
кандидаты, сессии и медиа удаляются. Запускайте его в согласованное окно, сохранив
результаты предыдущих проверок. Это проверка серверного API внутри сети Compose.
Она не доказывает работу живой расшифровки или камеры в браузере.

После live-вызовов обычного переключения в replay недостаточно: скрипт проверяет
`usage.liveCalls` за весь журнал, а «Сбросить демо» этот журнал не очищает.
`deploy/compose.replay.yml` выбирает отдельный журнал для replay и отключает
живые модели и медиа. Исходный журнал расходов сохраняется в `usage-data`.
Не удаляйте его, чтобы пройти проверку или получить новый бюджет.

Перед началом убедитесь, что обычные серверные Compose-файлы и настройки
оператора соответствуют текущему деплою: именно их восстановит команда ниже.
Скрипт-обёртка читает ключи из окружения контейнера API и передаёт их дочернему
процессу; ключи не нужно вставлять в командную строку. На сервере не выводите
`docker compose config`, `env` или полный `docker inspect`: там могут быть секреты.

Из корня репозитория запустите отдельный Bash-процесс:

```bash
bash <<'CHECK'
set -euo pipefail
server=(docker compose -f docker-compose.yml -f docker-compose.server.yml)
replay=("${server[@]}" -f deploy/compose.replay.yml)
restore() {
  result=$?
  trap - EXIT
  if ! "${server[@]}" up -d --no-deps --wait ml; then
    echo 'Failed to restore ML; restore its normal configuration before the demo.' >&2
    exit 1
  fi
  exit "$result"
}
trap restore EXIT
"${replay[@]}" up -d --no-deps --wait ml
"${replay[@]}" run --rm --no-deps \
  -v "$PWD/deploy:/checks/deploy:ro" \
  -v "$PWD/scripts/e2e:/checks/scripts/e2e:ro" \
  -v "$PWD/seed:/checks/seed:ro" \
  api node /checks/deploy/run-pitch-path.mjs
CHECK
```

Успех — код выхода 0, `All steps passed.`, затем healthy ML в исходном режиме.
Обработчик `EXIT` восстанавливает обычный ML и при ошибке проверки; после
аварийного завершения процесса восстановите его вручную обычным серверным
`up -d --no-deps --wait ml`. Не оставляйте сервер на временном replay-override.

Для A, B и C скрипт проходит бриф, симуляцию из записи и отчёт, отзыв без баллов,
сюрпризный вопрос, интервью с черновиком, закрытым до слепых баллов, сверку
«после», проверку качества и калибровку. Затем — передачу анкеты и сброс демо.
Свежий бриф нового кандидата в replay не обязан стать `ready`.
Медиа S/P проверяются скриптом только при заданном `E2E_MEDIA_DIR` с совместимыми
синтетическими записями; без него эти проверки пропущены. Демо-интервью использует
seed-расшифровку. Свежие расшифровки проверяйте вручную в live.

### 3.2. Путь питча — в браузере

Тот, что показываем жюри, быстрее 5 минут:

1. **Админ** → «Обзор демо»: кандидаты A, B и C.
2. **Интервьюер** → бриф A: вопросы по фокусам, сверка «заявлено против измерено», у каждого пункта — источник.
3. **Комиссия** → отчёт по симуляции A. Если симуляции ещё нет — «Завершить симуляцию … из записи». Клик по цитате открывает ход, где она сказана.
4. **Кандидат** → отзыв: ни одного балла и ни одного намёка на решение.
5. **Интервьюер** → интервью A: «Взять демо-запись» → расшифровка. Черновик закрыт, пока не сохранены свои баллы; после сохранения — черновик и расхождения.
6. **Комиссия** → «Сверка» A после интервью, затем «Quality guard»: проверка интервью и калибровка.
7. **Админ** → в журнале видны все шаги → «Сбросить демо».

### 3.3. Видеозвонок и стенд

- **Звонок между двумя браузерами.** Интервьюер: «Расписание» → «Добавить слот через 2 минуты». Кандидат (второй браузер или устройство): «My interview» → выбрать это время → войти. Оба видят друг друга; с согласием кандидата запись и расшифровка работают.
- **Передача со стенда.** Войти на `/stand` как `applicant.ready@example.test` (пароль на странице `/stand`) → «Send the application» → «Continue to your inVision U steps». Новый кандидат появляется на главной интервьюера. В `live` его бриф становится `ready`; в `replay` — нет, это ожидаемо (раздел 7).

### 3.4. Ошибки

1. `$C stop ml`.
2. На каждом экране пути питча показана ошибка ИИ, введённое не пропало, а в консоли браузера нет ошибок, кроме ожидаемого `401` стенда. Тексты ошибок берутся по `code` из `apps/web/lib/api/errors.ts`, по-английски и по-русски; `traceId` виден мелко — его можно продиктовать.
3. `$C start ml` — «Повторить» срабатывает, дубля не появляется (`Idempotency-Key` тот же).

## 4. Перед показом и каждый день

- **Сброс демо:** Админ → «Сбросить демо». Удаляются симуляции, оценки, интервью, сюрпризные ответы, проверки качества и все записи и видео на диске; кандидаты A, B и C заводятся заново. Журнал аудита остаётся.
- **Отчёт без живой симуляции:** Админ → «Завершить симуляцию … из записи». Оценка берётся из `seed/`, без вызова модели.
- **Репетиция до вечера 30.09:** путь из раздела 3.2 трижды подряд без ошибок, каждый раз быстрее 5 минут, на сервере и на ноутбуке. Потом ещё раз на ноутбуке с выключенной сетью. Результат — комментарием в #23: дата, время каждого прогона, что пошло не так.

## 5. Живой режим (с ключами)

Только с ключами, у которых стоит лимит, и с `BUDGET_USD_CAP`.

```bash
# в .env
GATEWAY_MODE=live
OPENAI_API_KEY=…
DEEPGRAM_API_KEY=…
BUDGET_USD_CAP=10

$C up -d ml                                  # пересоздать ml с новыми настройками
```

Расход виден у админа в плитке «Бюджет ИИ». Когда он дойдёт до лимита, ML отвечает
`AI_BUDGET_EXCEEDED`. Для #23 лимит live-демо — $10; проверьте также баланс и лимит
проектного ключа. Расход накопительный: новый запуск контейнера не даёт новые $10.
Режим основного показа выбирает Мейірбек; офлайн-резерв всегда работает на replay.

**Только голос и расшифровка вживую.** `MEDIA_GATEWAY_MODE=live` при `GATEWAY_MODE=replay`: Deepgram работает по-настоящему (записанный на сцене сюрпризный ответ, видеопрезентация и запись интервью расшифровываются), а ответы моделей идут из записей. Нужен только `DEEPGRAM_API_KEY`. Пусто — голос следует за `GATEWAY_MODE`.

### Стенд качества сценариев — один раз, с ключом

Сценарий попадает в пул только после стенда качества. Судья пишет свой отчёт по трём эталонным прохождениям (сильное, среднее, слабое). Каждый балл должен лечь в ±1 от эталона, а каждая цитата — совпасть дословно. Эталоны лежат в `fixtures/bench/<сценарий>/`.

Судье нужен LanguageTool, а он есть только в образе ML. Поэтому стенд запускают в контейнере, примонтировав репозиторий, чтобы записанные ответы остались в рабочей копии:

```bash
# в .env: OPENAI_API_KEY. Файл сервера передаёт его в ml сам
$C run --rm -v "$PWD:/repo/context" \
  -e GATEWAY_MODE=record -e BUDGET_USD_CAP=5 \
  ml python services/ml/scripts/quality_bench.py --all --mode record --promote
```

Что делает эта команда:

- судья вызывается вживую по каждому сценарию в статусе `draft`;
- ответы судьи записываются в `fixtures/cassettes/`;
- сценарии, у которых прошли все три случая, получают статус `ready`;
- не прошедшие остаются `draft`, а в выводе видно, какой случай и почему;
- уже готовые сценарии пропускаются.

После прогона закоммитьте `fixtures/cassettes`, `config/scenarios` и `services/ml/scenario_data`. Дальше стенд работает без сети:

```bash
python services/ml/scripts/quality_bench.py --all
```

## 6. Обновление, логи, база

```bash
git pull
$C up -d --build                             # пересобрать изменившееся; миграции применятся сами

$C logs -f api                               # или ml, web, caddy
$C exec postgres pg_dump -U invision invision > backup-$(date +%F).sql
$C exec -T postgres psql -U invision invision < backup.sql     # восстановить в пустую базу
```

## 7. Если что-то не так

| Признак | Причина и что делать |
|---|---|
| Caddy не получает сертификат | A-запись ещё не разошлась или закрыт порт 80. Проверить `dig <домен>` и `$C logs caddy` |
| Камера не спрашивается | Страница открыта не по HTTPS. Открывать только `https://<домен>` |
| `413` при загрузке видео | Файл больше 250 МБ (лимит Caddy) или видео больше 50 МБ (лимит API) |
| Админ: ML «Не отвечает» | `$C ps ml` и `$C logs ml`. При первом старте ML поднимается дольше API |
| Калибровка отвечает ошибкой | В образе API нет `seed/quality-history.json`. Нужен `main` не старше #105 |
| `503 AI_UNAVAILABLE` после сыгранной вживую симуляции | В `replay` у ML нет записанного ответа на новый разговор. Для показа отчёта нужен живой режим или «Завершить … из записи» |
| Бриф нового кандидата со стенда — `failed` | В `replay` для него нет записанных ответов. Нужен живой режим (раздел 5); A, B и C работают и так |
| Вход в звонок — `503 VIDEO_UNAVAILABLE` | Не заполнены `LIVEKIT_*`. Заполнить и `$C up -d api` |
| Скрипт пути питча — `401` | `E2E_KEY_*` не совпадают с `API_KEYS` из `.env` |

## 8. Ноутбук — запасной путь без сети

Сначала, пока сеть доступна, подготовьте образы и проверьте стек. Копирование
`.env.example` нужно только при первом запуске, когда своего `.env` ещё нет.

```bash
docker compose up --build -d                 # без файла сервера
docker compose ps
curl --fail --show-error http://localhost:3000/health
curl --fail --show-error http://localhost:3001/v1/health
# Use synthetic LiveKit token-signing settings for e2e, as in CI.
# These do not connect to LiveKit; verify real video separately on the server.
LIVEKIT_URL=wss://synthetic.invalid LIVEKIT_API_KEY=APIsynthetic LIVEKIT_API_SECRET=synthetic-secret \
  docker compose up -d --no-build --no-deps --wait api
API=http://localhost:3001/v1 node scripts/e2e/pitch-path.mjs
docker compose down
```

LanguageTool, embedding-модель, зависимости и базовые образы должны уже быть
загружены: сборка без сети не является частью резервного запуска. Адрес —
`http://localhost:3000`. Браузер считает localhost безопасным для камеры и микрофона.
Основной Compose задаёт `GATEWAY_MODE=replay` и `DEMO_MODE=true`.

Для автоматической API-проверки запрета внешних соединений используйте offline-override:
он оставляет связь контейнеров друг с другом и закрывает их выход в интернет.
Публикация портов с internal-сети на этой версии Docker недоступна, поэтому
e2e запускается внутри контейнера. Браузерный резерв проверяется на обычной сети
Compose при выключенной внешней сети ноутбука.
Он также заменяет настройки внешнего LiveKit синтетическими для локальной подписи
токенов в e2e. Это не работающий видеозвонок. Отключение сети ноутбука нужно
дополнительно проверить вручную: Docker-сеть не ограничивает запросы браузера.

```bash
docker compose -f docker-compose.yml -f deploy/compose.offline.yml up -d --no-build --pull never --wait
docker compose -f docker-compose.yml -f deploy/compose.offline.yml run --rm --no-deps \
  -v "$PWD/deploy:/checks/deploy:ro" \
  -v "$PWD/scripts/e2e:/checks/scripts/e2e:ro" \
  -v "$PWD/seed:/checks/seed:ro" \
  api node /checks/deploy/run-pitch-path.mjs
docker compose -f docker-compose.yml -f deploy/compose.offline.yml down
# Restore the normal Compose network, then disconnect the laptop from the internet.
docker compose up -d --no-build --pull never --wait
curl --fail --show-error http://localhost:3000/health
curl --fail --show-error http://localhost:3001/v1/health
# Walk section 3.2 in the browser with the laptop disconnected from the internet.
docker compose down
```

Успех — `All steps passed.` и браузерный путь 3.2 без сети. Внешний видеозвонок,
новая live-симуляция и свежая расшифровка не входят в офлайн-путь: показываются
записанные A/B/C. Проверочный стек всегда останавливайте после проверки, включая
неудачный прогон; тома сохраняйте. Перед питчем запустите подготовленный стек снова.

## 9. Приёмка #23 и протокол репетиции

Демо уже развёрнуто на `https://staging-invision.byapex.dev`, по сообщению Айбека
от 27.09 в #23. Повторный деплой с нуля не требуется. Его комментарий обозначает
live-AI как непроверенный. Ссылка issue на `docs/INTEGRATION.md` устарела:
этого файла нет в текущем `main`; ниже явно перечислены проверки из issue
и этого документа. Окончательную полноту приёмки подтверждает Мейірбек.

| Проверка | Критерий | Подтверждение |
| --- | --- | --- |
| HTTPS и health | Действительный сертификат; веб и API отвечают успешно | 29.09: оба публичных health вернули `{"status":"ok"}`; камера ещё не проверена |
| ML и режим | Админ: ML «Работает», согласованный режим, демо включено | Не проверено; нужен доступ к серверу |
| Серверный replay | Раздел 3.1: код 0, `All steps passed.`, исходный режим восстановлен | Не выполнен |
| Новая анкета | Кандидат виден интервьюеру; в live бриф `ready` | Не выполнено |
| Живой голос и M3 | Свежая расшифровка, ответ персонажа, отчёт с цитатами | Не выполнено |
| Свежие S/P-медиа | Расшифровки соответствуют новой синтетической записи | Не выполнено |
| Видеозвонок | Два браузера: звук, видео, согласие, запись, свежая расшифровка | Не выполнено |
| M4 и сверка | Черновик закрыт до слепых баллов; после них доступны M4 и сверка | Не выполнено вручную |
| Отказ ML | Раздел 3.4: понятная ошибка, ввод сохранён, повтор без дубля | Не выполнено |
| Ноутбук | Раздел 8: API и браузерный путь A/B/C без сети | Не выполнено |
| Репетиция | Сервер ×3, ноутбук ×3, ещё ноутбук офлайн ×1; каждый < 5 минут | Не выполнена |
| Результаты в issue | Комментарий: дата, времена всех прогонов, проблемы | Не опубликован |

До начала live-проверок зафиксируйте согласованный режим и бюджет; используйте
только синтетические данные. Не коммитьте настоящие голоса, ключи или `.env`.
Health подтверждает доступность сервиса, а не работу моделей, медиа или UI.

Перед каждым прогоном — «Сбросить демо». После исправления ошибки начните
соответствующую серию из трёх прогонов заново. В протоколе укажите SHA кода,
дату и время, оба режима (`gateway`/`media`), длительность и фактический результат.

| Прогон | Дата / SHA | Окружение / сеть | Gateway / media | Длительность | Результат |
| --- | --- | --- | --- | --- | --- |
| S1 | — | Сервер / онлайн | — | — | Не выполнен |
| S2 | — | Сервер / онлайн | — | — | Не выполнен |
| S3 | — | Сервер / онлайн | — | — | Не выполнен |
| L1 | — | Ноутбук / онлайн | replay / replay | — | Не выполнен |
| L2 | — | Ноутбук / онлайн | replay / replay | — | Не выполнен |
| L3 | — | Ноутбук / онлайн | replay / replay | — | Не выполнен |
| L4 | — | Ноутбук / офлайн | replay / replay | — | Не выполнен |

В результатах проверки перечислите точные команды без секретов, коды выхода,
успешные проверки, ошибки и пропуски. PR готовится после локального Docker-прогона
и согласования результатов; до этого issue не считается выполненным.


### 9.1. Локальная Docker-проверка от 29.09.2026

Основа — `7ad160ba9d6b15eb295699254d74a80b1f007cf0`; Docker 29.7.2,
Compose 5.5.1. Это проверка локальных deploy-изменений, не серверная приёмка #23.
Настоящие provider-ключи не использовались; `.env` не читался.

Выполнены команды:

```bash
docker compose --env-file /dev/null up --build -d
docker compose --env-file /dev/null ps
curl --fail --show-error http://localhost:3000/health
curl --fail --show-error http://localhost:3001/v1/health
curl --fail --show-error http://localhost:3000/api/v1/health
LIVEKIT_URL=wss://synthetic.invalid LIVEKIT_API_KEY=APIsynthetic LIVEKIT_API_SECRET=synthetic-secret \
  docker compose --env-file /dev/null up -d --no-build --no-deps --wait api
API=http://localhost:3001/v1 node scripts/e2e/pitch-path.mjs
docker compose --env-file /dev/null -f docker-compose.yml -f deploy/compose.replay.yml up -d --no-build --no-deps --wait ml
docker compose --env-file /dev/null -f docker-compose.yml -f deploy/compose.replay.yml run --rm --no-deps \
  -v "$PWD/deploy:/checks/deploy:ro" -v "$PWD/scripts/e2e:/checks/scripts/e2e:ro" -v "$PWD/seed:/checks/seed:ro" \
  api node /checks/deploy/run-pitch-path.mjs
docker compose --env-file /dev/null up -d --no-build --no-deps --wait ml
docker compose --env-file /dev/null down
docker compose --env-file /dev/null -f docker-compose.yml -f deploy/compose.offline.yml up -d --no-build --pull never --wait
docker compose --env-file /dev/null -f docker-compose.yml -f deploy/compose.offline.yml run --rm --no-deps \
  -v "$PWD/deploy:/checks/deploy:ro" -v "$PWD/scripts/e2e:/checks/scripts/e2e:ro" -v "$PWD/seed:/checks/seed:ro" \
  api node /checks/deploy/run-pitch-path.mjs
docker compose --env-file /dev/null -f docker-compose.yml -f deploy/compose.offline.yml down
```

Результат: все образы собраны, четыре сервиса healthy, health веба/API/прокси
вернул `status: ok`; три успешных e2e-прогона закончились `All steps passed.`
(host, обёртка с отдельным replay-журналом, обёртка на internal-сети).
Во всех трёх — `liveCalls: 0`, `spentUsd: 0`. S/P-медиа в этих прогонах пропущены.

Дополнительные проверки:

- SHA-256 исходного журнала до и после временного replay совпал:
  `398a76f31a3b758721ba4f66eae314a351df79d7f847b9955a8457660e892068`.
  Отдельный replay-журнал создан; нормальная конфигурация ML восстановлена.
- `docker compose --env-file /dev/null stop ml`, запрос `/api/v1/scenarios`
  с ролью admin через веб: `503 AI_UNAVAILABLE` с traceId. После
  `up -d --no-build --no-deps --wait ml` тот же запрос вернул `200`.
- На internal-сети ML достиг внутреннего `http://api:3001/v1/health` (`200`),
  а попытка TCP-соединения с `1.1.1.1:443` завершилась сетевой ошибкой.
- Синтаксис Node/Bash и объединённые Compose-конфигурации проверены;
  gitleaks по изменённым файлам без `.env` не нашёл секретов.

Найденные проблемы: первоначальный host-e2e без LiveKit-настроек завершился
`503 VIDEO_UNAVAILABLE` в follow-up. Добавлены синтетические настройки подписи,
как в CI. Host-e2e на internal-сети получил `ECONNREFUSED`; для этой проверки
инструкция теперь запускает обёртку внутри Compose. Кратковременный `500` health
прокси во время пересоздания API исчез после готовности API.

Эти прогоны не заменяют браузерную репетицию, отключение сети ноутбука,
свежую live-расшифровку или звонок между двумя браузерами. Доступ к серверу
и результаты этих проверок ещё требуются для закрытия #23.

Повторный локальный запуск `docker compose --env-file /dev/null up -d --no-build --pull never --wait`
также прошёл: HTTP-проверки `/health`, `/api/v1/health`, `/admin`, `/interviewer`,
`/commission`, `/candidate` вернули `200`. Это проверка HTTP-ответов, не взаимодействия
в браузере. После неё `docker compose --env-file /dev/null down` завершился успешно;
`docker compose --env-file /dev/null ps` показал пустой список сервисов.
