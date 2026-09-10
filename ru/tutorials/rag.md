---
title: "Retrieval-Augmented Generation (RAG)"
description: "Создайте базу знаний, которая отвечает на вопросы из ваших собственных документов. В этом руководстве используется модуль wippy/embeddings для…"
---

# Retrieval-Augmented Generation (RAG)

Создайте базу знаний, которая отвечает на вопросы из ваших собственных документов. В этом руководстве используется модуль `wippy/embeddings` для векторного поиска и LLM-фреймворк для генерации.

## Что вы построите

Минимальный RAG-конвейер:

1. Загрузка markdown-документов — разделение на чанки, встраивание, сохранение.
2. Извлечение — векторный поиск возвращает наиболее релевантные чанки для запроса.
3. Генерация — вызов LLM использует извлечённые чанки в качестве grounding-контекста.

## Предварительные требования

- База данных: `db.sql.sqlite` (включает поддержку `vec0`) или `db.sql.postgres` с расширением `pgvector`.
- `OPENAI_API_KEY` в окружении — через него идут вызовы встраивания и генерации.

Создайте проект и установите модули:

```bash
mkdir rag && cd rag
mkdir -p src/app data
wippy init
wippy add wippy/embeddings
wippy add wippy/migration
wippy add wippy/bootloader
wippy add wippy/security
wippy install
```

```
rag/
├── wippy.lock
├── data/
└── src/
    ├── _index.yaml
    ├── env/
    │   └── _index.yaml
    └── app/
        ├── ingest.lua
        ├── answer.lua
        ├── answer_http.lua
        └── seed.lua
```

## Зависимости

Объявите зависимость `wippy/embeddings` и укажите её на вашу базу данных. Параметр `target_db` — это Registry ID записи базы данных, в которой будет находиться таблица встраиваний. `wippy/embeddings` подтягивает `wippy/llm` и миграцию, которая создаёт таблицу `embeddings_512`, поэтому `wippy/migration` и `wippy/bootloader` тоже нужно подключить — загрузчик выполняет миграцию при старте, а он сам и модуль LLM запускают процессы под группой политик `wippy.security:process`, которую поставляет `wippy/security`:

```yaml
# src/_index.yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./data/app.db
    lifecycle:
      auto_start: true

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db

  - name: migration
    kind: ns.dependency
    component: wippy/migration
    version: "*"
    parameters:
      - name: app_db
        value: app:db

  - name: bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app.env:store

  - name: security
    kind: ns.dependency
    component: wippy/security
    version: "*"
```

Загрузчик сохраняет сгенерированный `ENCRYPTION_KEY`, поэтому ему нужно записываемое хранилище окружения:

```yaml
# src/env/_index.yaml
version: "1.0"
namespace: app.env

entries:
  - name: file
    kind: env.storage.file
    auto_create: true
    file_path: .env
    lifecycle:
      auto_start: true

  - name: os
    kind: env.storage.os
    lifecycle:
      auto_start: true

  - name: store
    kind: env.storage.router
    lifecycle:
      auto_start: true
    storages:
      - app.env:file
      - app.env:os
```

## Модели

`wippy/embeddings` вызывает `llm.embed` с `text-embedding-3-small`, а генерация ниже использует `gpt-4o-mini`. Обе модели разрешаются из реестра, поэтому объявите их также в `src/_index.yaml`:

```yaml
  - name: text-embedding-3-small
    kind: registry.entry
    meta:
      name: text-embedding-3-small
      type: llm.model
      title: Text Embedding 3 Small
      capabilities:
        - embed
    dimensions: 512
    max_tokens: 8191
    pricing:
      input: 0.02
      output: 0
    providers:
      - id: wippy.llm.openai:provider
        provider_model: text-embedding-3-small

  - name: gpt-4o-mini
    kind: registry.entry
    meta:
      name: gpt-4o-mini
      type: llm.model
      title: GPT-4o mini
      capabilities:
        - generate
    max_tokens: 128000
    output_tokens: 16384
    pricing:
      input: 0.15
      output: 0.6
    providers:
      - id: wippy.llm.openai:provider
        provider_model: gpt-4o-mini
```

Провайдер OpenAI по умолчанию читает `OPENAI_API_KEY` из окружения ОС. Другие провайдеры и поля моделей см. в [LLM-фреймворке](framework/llm.md).

## Загрузка документов

Разделение обрабатывается модулем `text`; встраивание и сохранение — библиотекой `embeddings`.

```lua
-- src/app/ingest.lua
local text = require("text")
local embeddings = require("embeddings")

local function ingest(doc_id: string, title: string, markdown: string)
    local splitter, err = text.splitter.markdown({
        chunk_size = 800,
        chunk_overlap = 100,
        heading_hierarchy = true,
        code_blocks = true,
    })
    if err then return nil, err end

    local chunks, split_err = splitter:split_text(markdown)
    if split_err then return nil, split_err end

    local batch = {}
    for i, chunk in ipairs(chunks) do
        table.insert(batch, {
            content = chunk,
            content_type = "doc_chunk",
            origin_id = doc_id,
            context_id = tostring(i),
            meta = { title = title, chunk = i },
        })
    end

    return embeddings.add_batch(batch)
end

return { ingest = ingest }
```

Зарегистрируйте функцию и её импорты:

```yaml
- name: ingest
  kind: function.lua
  source: file://app/ingest.lua
  method: ingest
  modules:
    - text
  imports:
    embeddings: wippy.embeddings:embeddings
```

Ключевые моменты:

- `origin_id` группирует чанки, принадлежащие одному и тому же исходному документу.
- `context_id` — опциональный подключ (раздел, страница, индекс чанка).
- `add_batch` автоматически разделяет, если общее количество токенов превышает лимит запроса в 8000 токенов.

## Извлечение

Векторный поиск возвращает наиболее похожие на запрос чанки вместе с оценками сходства:

```lua
local embeddings = require("embeddings")

local results, err = embeddings.search("how do I configure TLS?", {
    content_type = "doc_chunk",
    limit = 5,
})

-- results[i].content, .similarity, .meta, .origin_id, .context_id
```

Фильтруйте по origin, когда хотите привязать ответ к конкретному документу:

```lua
local hits = embeddings.find_by_origin("refund policy", "doc-42", { limit = 3 })
```

## Генерация ответа

Скомпонуйте извлечённые чанки в промпт и вызовите LLM. Здесь извлечённый текст добавляется к системному промпту; вопрос пользователя становится пользовательским ходом:

```lua
-- src/app/answer.lua
local embeddings = require("embeddings")
local llm = require("llm")
local prompt = require("prompt")

local SYSTEM = [[
Answer using only the provided context. If the context does not contain
the answer, say you don't know. Cite the chunk title for each claim.
]]

local function format_context(hits)
    local parts = {}
    for i, h in ipairs(hits) do
        local title = h.meta and h.meta.title or h.origin_id
        table.insert(parts,
            string.format("[%d] %s\n%s", i, title, h.content))
    end
    return table.concat(parts, "\n\n")
end

local function answer(question: string)
    local hits, err = embeddings.search(question, { limit = 4 })
    if err then return nil, err end

    local p = prompt.new()
    p:add_system(SYSTEM)
    p:add_system("Context:\n\n" .. format_context(hits))
    p:add_user(question)

    local response, gen_err = llm.generate(p, { model = "gpt-4o-mini" })
    if gen_err then return nil, gen_err end

    return {
        answer = response.result,
        sources = hits,
    }
end

return { answer = answer }
```

```yaml
- name: answer
  kind: function.lua
  source: file://app/answer.lua
  method: answer
  imports:
    embeddings: wippy.embeddings:embeddings
    llm: wippy.llm:llm
    prompt: wippy.llm:prompt
```

## Пример от начала до конца

Собираем всё вместе за HTTP-эндпоинтом. Добавьте эти записи в `src/_index.yaml`:

```yaml
  - name: ingest
    kind: function.lua
    source: file://app/ingest.lua
    method: ingest
    modules:
      - text
    imports:
      embeddings: wippy.embeddings:embeddings

  - name: answer
    kind: function.lua
    source: file://app/answer.lua
    method: answer
    imports:
      embeddings: wippy.embeddings:embeddings
      llm: wippy.llm:llm
      prompt: wippy.llm:prompt

  - name: seed
    kind: process.lua
    meta:
      command:
        name: seed
        short: Ingest the sample document
        security:
          groups:
            - wippy.security:process
    source: file://app/seed.lua
    method: main
    modules:
      - funcs
      - io

  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true
      security:
        actor:
          id: gateway
        groups:
          - wippy.security:process

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api

  - name: ask
    kind: http.endpoint
    meta:
      router: app:api
    method: POST
    path: /ask
    func: app:answer_http

  - name: answer_http
    kind: function.lua
    source: file://app/answer_http.lua
    method: handler
    modules:
      - http
    imports:
      answer: app:answer
```

Сервер объявляет контекст безопасности, потому что извлечение разрешает модель встраивания из реестра, а запрос без актора и области не читает ни одной записи — разрешение модели тогда завершается с ошибкой `Model or class not found`.

```lua
-- src/app/answer_http.lua
local http = require("http")
local answer = require("answer")

local function handler()
    local req = http.request()
    local res = http.response()

    local body, err = req:body_json()
    if err or not body or not body.question then
        res:set_status(http.STATUS.BAD_REQUEST)
        res:write_json({ error = "question is required" })
        return
    end

    local result, ans_err = answer.answer(tostring(body.question))
    if ans_err then
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({ error = ans_err })
        return
    end

    res:write_json(result)
end

return { handler = handler }
```

Инициализируйте индекс из CLI-команды. `meta.command` делает процесс запускаемым как `wippy run seed`, а его блок `security` даёт область, необходимую для вызова `app:ingest`:

```lua
-- src/app/seed.lua
local funcs = require("funcs")
local io = require("io")

local DOC = [[
# TLS Configuration

Wippy servers terminate TLS when the `tls` block is present on the
`http.service` entry. Set `cert_file` and `key_file` to PEM paths.

## Refund Policy

Refunds are issued within 14 days of purchase.
]]

local function main()
    local res, err = funcs.call("app:ingest", "doc-42", "Handbook", DOC)
    if err then
        io.print("ingest failed: " .. tostring(err))
        return
    end
    io.print("ingested " .. tostring(res.count) .. " chunks")
end

return { main = main }
```

Первый `wippy run` создаёт `data/app.db` и применяет миграцию встраиваний. Инициализируйте индекс, затем запустите сервер и выполните запрос:

```bash
wippy run seed
# ingested 2 chunks

wippy run
```

```bash
curl -X POST http://localhost:8080/api/ask \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

```json
{
  "answer": "You can configure TLS by adding a `tls` block to the `http.service` entry. Set `cert_file` and `key_file` to the paths of your PEM files. (See: Handbook, TLS Configuration)",
  "sources": [
    {
      "entry_id": "52fafcc0-2d18-40d9-8a6e-7662ef9d9bea",
      "origin_id": "doc-42",
      "context_id": "1",
      "content_type": "doc_chunk",
      "content": "# TLS Configuration\nWippy servers terminate TLS when the `tls` block is present on the\n`http.service` entry. Set `cert_file` and `key_file` to PEM paths.",
      "meta": { "title": "Handbook", "chunk": 1 },
      "similarity": 0.0736
    }
  ]
}
```

## Эксплуатационные заметки

- **Размер чанка**: `chunk_size` и `chunk_overlap` считают символы, а не токены (сплиттер измеряет длину через `utf8.RuneCountInString`). Примерно 2000–4000 символов — хорошая отправная точка. Слишком маленький теряет локальный контекст; слишком большой размывает оценки сходства. Используйте `chunk_overlap` (~10–20 % размера чанка), чтобы сохранить предложения на границах.
- **Типы контента**: Используйте различные значения `content_type` (`doc_chunk`, `faq`, `code_snippet`), чтобы поиск мог фильтровать по типу.
- **Переиндексация**: Удаляйте и повторно загружайте на уровне документа через `embedding_repo.delete_by_origin(doc_id)` перед добавлением новых чанков. Репозиторий — отдельная библиотека, импортируйте её как `embedding_repo: wippy.embeddings:embedding_repo`.
- **Гибридный поиск**: Для точного соответствия по терминам (имена, ID) комбинируйте векторный поиск с полнотекстовым поиском по вашей исходной таблице и перераспределяйте.
- **Выбор модели**: `wippy/embeddings` жёстко привязана к `text-embedding-3-small` с 512 измерениями, а таблица `embeddings_512` хранит `vector(512)`/`float[512]`. Другая модель или размер вектора означают изменение констант библиотеки и таблицы миграции.

## Следующие шаги

- [LLM-фреймворк](framework/llm.md) — `llm.generate`, `llm.embed`, построение промптов
- [Агенты](framework/agents.md) — оберните ретривер в качестве инструмента агента
- [SQL-модуль](lua/storage/sql.md) — базовый доступ к базе данных
- [Модуль Text](lua/text/text.md) — сплиттеры и токенизация
