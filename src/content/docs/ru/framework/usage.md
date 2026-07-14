---
title: "Учёт использования"
---

# Учёт использования

Модуль `wippy/usage` записывает потребление токенов LLM и предоставляет агрегатные запросы, сгруппированные по интервалу времени, модели или пользователю. Он привязан к контракту `wippy.llm:usage_tracker`, поэтому любой код, вызывающий через модуль LLM, автоматически создаёт записи об использовании.

## Настройка

Добавьте модуль в проект:

```bash
wippy add wippy/usage
wippy install
```

Объявите зависимость и укажите в требовании `target_db` базу данных, где должны храниться записи об использовании:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    path: ./data/app.db

  - name: dep.usage
    kind: ns.dependency
    component: wippy/usage
    version: "*"

  - name: target_db
    kind: registry.entry
    meta:
      wippy.usage.target_db: app:app_db
```

При запуске приложения `wippy/migration` выполняет миграцию модуля `01_create_token_usage_table`, которая создаёт таблицу `token_usage` вместе с индексами по `user_id`, `context_id`, `model_id` и `timestamp`.

## Схема

```
token_usage
├── usage_id           text primary key (uuid v7)
├── user_id            text not null
├── context_id         text
├── model_id           text not null
├── prompt_tokens      integer
├── completion_tokens  integer
├── thinking_tokens    integer default 0
├── cache_read_tokens  integer default 0
├── cache_write_tokens integer default 0
├── timestamp          timestamp
└── meta               text (JSON)
```

## Автоматическое отслеживание

`wippy/llm` разрешает контракт `wippy.llm:usage_tracker` перед каждой генерацией. `wippy/usage` привязывает свою реализацию по умолчанию:

```yaml
contracts:
  - contract: wippy.llm:usage_tracker
    default: true
    methods:
      track_usage: wippy.usage:usage_tracker
```

Каждый успешный вызов LLM вызывает `track_usage` с идентификатором модели, количеством токенов и опциональным `context_id`. Значение `user_id` берётся из активного субъекта безопасности; вызовы вне пользовательского контекста записываются как `"system"`.

## API трекера

Импортируйте трекер напрямую, когда нужно записать использование вне потока LLM:

```yaml
imports:
  usage_tracker: wippy.usage:usage_tracker
```

```lua
local tracker = require("usage_tracker")

local usage_id, err = tracker.track_usage(
    "openai:gpt-4o",
    prompt_tokens,
    completion_tokens,
    thinking_tokens,
    cache_read_tokens,
    cache_write_tokens,
    { context_id = "chat-42", metadata = { feature = "summary" } }
)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `model_id` | string | Канонический идентификатор модели |
| `prompt_tokens` | number | Входные токены |
| `completion_tokens` | number | Выходные токены |
| `thinking_tokens` | number | Токены рассуждения (0, если не сообщается) |
| `cache_read_tokens` | number | Попадания в кэш промпта |
| `cache_write_tokens` | number | Записи в кэш промпта |
| `options.context_id` | string | Произвольный тег; резервное значение `ctx.get("context_id")` |
| `options.timestamp` | number | Unix-время; по умолчанию сейчас (UTC) |
| `options.metadata` | table | Произвольные JSON-метаданные, сохраняемые вместе с записью |

Возвращает `usage_id` или `nil, err`.

## API репозитория

`wippy.usage:token_usage_repo` предоставляет агрегатные запросы:

```yaml
imports:
  usage: wippy.usage:token_usage_repo
```

```lua
local usage = require("usage")

local summary  = usage.get_summary(start_unix, end_unix)
local by_time  = usage.get_usage_by_time(start_unix, end_unix, usage.INTERVAL.DAY)
local by_model = usage.get_usage_by_model(start_unix, end_unix)
local by_user  = usage.get_usage_by_user(start_unix, end_unix)
```

### Функции

| Функция | Возвращает |
|---------|------------|
| `get_summary(start, end)` | Итоги по диапазону: prompt/completion/thinking/cache токены, количество запросов, `total_tokens` (prompt + completion + thinking) |
| `get_usage_by_time(start, end, interval)` | Массив бакетов, по одному на интервал; отсутствующие бакеты возвращают нули |
| `get_usage_by_model(start, end)` | Итоги по моделям, упорядоченные по `total_tokens` по убыванию |
| `get_usage_by_user(start, end)` | Итоги по пользователям, упорядоченные по `total_tokens` по убыванию |
| `create(user_id, model_id, prompt, completion, options)` | Низкоуровневая вставка, используемая трекером |

### Интервалы

```lua
usage.INTERVAL.HOUR   -- "hour"
usage.INTERVAL.DAY    -- "day"
usage.INTERVAL.WEEK   -- "week"
usage.INTERVAL.MONTH  -- "month"
```

`get_usage_by_time` выравнивает бакеты по настроенному интервалу. В PostgreSQL используется `generate_series` с интервальной арифметикой; в SQLite применяется рекурсивный CTE по UNIX-меткам времени. `total_tokens` в каждом бакете исключает токены кэша.

### Диапазоны времени

И трекер, и репозиторий принимают UNIX-метки времени на границе публичного API. Внутри репозиторий преобразует их в строки RFC3339 для хранения и запросов. Передавайте значения `os.time()` или `time.now():unix()`, а не форматированные строки.

## Метаданные и контекст

Столбец `meta` хранит произвольный JSON-блоб. Используйте его для корреляции записей с событиями приложения:

```lua
tracker.track_usage(model_id, prompt, completion, 0, 0, 0, {
    context_id = "chat-42",
    metadata   = {
        session_id = "s-7",
        route      = "/api/summarise",
        agent_id   = "writer",
    },
})
```

`context_id` -- это столбец верхнего уровня, который можно индексировать; `metadata` хранится как текст и предназначен для отображения, а не для фильтрации.

## См. также

- [LLM](framework/llm.md) -- Генерация LLM и контракт `usage_tracker`
- [Migrations](framework/migration.md) -- Запуск миграций, создающий схему
- [Обзор фреймворка](framework/overview.md) -- Использование модулей фреймворка
