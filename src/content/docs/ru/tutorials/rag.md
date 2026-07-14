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
- LLM-провайдер, настроенный с моделью встраивания (например, `text-embedding-3-small`) — см. [LLM-фреймворк](framework/llm.md).
- Инициализированный проект Wippy (`wippy init`, `wippy add wippy/embeddings`).

## Зависимости

Объявите зависимость `wippy/embeddings` и укажите её на вашу базу данных. Параметр `target_db` — это Registry ID записи базы данных, в которой будет находиться таблица встраиваний:

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./data/app.db
    lifecycle:
      auto_start: true

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db
```

`wippy/embeddings` подтягивает `wippy/llm` и миграцию, которая создаёт таблицу `embeddings_512` (PostgreSQL `pgvector` или виртуальная таблица SQLite `vec0`).

## Загрузка документов

Разделение обрабатывается модулем `text`; встраивание и сохранение — библиотекой `embeddings`.

```lua
-- app/ingest.lua
local text = require("text")
local embeddings = require("embeddings")
local uuid = require("uuid")

local function ingest(doc_id, title, markdown)
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
    - uuid
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
-- app/answer.lua
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

local function answer(question)
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

Собираем всё вместе за HTTP-эндпоинтом:

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./data/app.db
    lifecycle:
      auto_start: true

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db

  - name: ingest
    kind: function.lua
    source: file://app/ingest.lua
    method: ingest
    modules:
      - text
      - uuid
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

  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

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

```lua
-- app/answer_http.lua
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

    local result, ans_err = answer.answer(body.question)
    if ans_err then
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({ error = ans_err })
        return
    end

    res:write_json(result)
end

return { handler = handler }
```

Инициализируйте индекс, вызвав `ingest` из установочного процесса или CLI-команды (`process.lua` с `meta.command`), а затем выполните запрос:

```bash
curl -X POST http://localhost:8080/api/ask \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

## Эксплуатационные заметки

- **Размер чанка**: 500–1000 токенов — хорошая отправная точка. Слишком маленький теряет локальный контекст; слишком большой размывает оценки сходства. Используйте `chunk_overlap` (~10–20 % размера чанка), чтобы сохранить предложения на границах.
- **Типы контента**: Используйте различные значения `content_type` (`doc_chunk`, `faq`, `code_snippet`), чтобы поиск мог фильтровать по типу.
- **Переиндексация**: Удаляйте и повторно загружайте на уровне документа через `embedding_repo.delete_by_origin(doc_id)` перед добавлением новых чанков.
- **Гибридный поиск**: Для точного соответствия по терминам (имена, ID) комбинируйте векторный поиск с полнотекстовым поиском по вашей исходной таблице и перераспределяйте.
- **Выбор модели**: Стандартная модель `text-embedding-3-small` с 512 измерениями экономична. Переходите на 1024 или 3072 измерения только если recall недостаточен — большие векторы означают больший объём хранилища и более медленный поиск.

## Следующие шаги

- [LLM-фреймворк](framework/llm.md) — `llm.generate`, `llm.embed`, построение промптов
- [Агенты](framework/agents.md) — оберните ретривер в качестве инструмента агента
- [SQL-модуль](lua/storage/sql.md) — базовый доступ к базе данных
- [Модуль Text](lua/text/text.md) — сплиттеры и токенизация
