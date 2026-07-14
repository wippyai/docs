---
title: "Dataflow: Local Knowledge Base"
description: "Постройте базу знаний на собственной машине — создайте векторное хранилище, затем разбейте документы на чанки и загрузите их в него. Это компаньон по…"
---

# Dataflow: Local Knowledge Base

Постройте базу знаний на собственной машине — создайте векторное хранилище, затем
разбейте документы на чанки и загрузите их в него. Это компаньон по созданию данных к
[руководству по RAG](tutorials/rag.md): здесь вы поднимаете и наполняете локальную базу
знаний; там вы извлекаете из неё и генерируете ответы. Оба используют модуль
`wippy/embeddings` поверх локального векторного хранилища SQLite.

## Что вы построите

1. Локальное приложение, чья база данных хранит векторное хранилище размерности 512.
2. Миграцию, которая создаёт таблицу `embeddings_512` при запуске.
3. Функцию загрузки, которая разбивает markdown на чанки и записывает встраивания в хранилище.

## Предварительные требования

- Проект Wippy (склонируйте [app-template](https://github.com/wippyai/app-template) или
  выполните `wippy init`).
- LLM-провайдер с настроенной моделью встраивания (например, `text-embedding-3-small`) —
  см. [LLM-фреймворк](framework/llm.md). Векторное хранилище создаётся локально без него,
  но загрузка (которая вызывает `llm.embed`) требует настроенного провайдера.

Установите зависимости:

```bash
wippy add wippy/embeddings
wippy add wippy/migration
wippy add wippy/bootloader
wippy add wippy/llm
wippy install
```

## Создание хранилища

База знаний живёт в локальной базе данных SQLite. `wippy/embeddings` поставляет
миграцию, которая создаёт векторную таблицу; bootloader выполняет её при запуске.
Свяжите части вместе:

```yaml
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
    host:
      max_processes: 1000
      workers: 8

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    parameters:
      - name: target_db
        value: app:db

  - name: migration
    kind: ns.dependency
    component: wippy/migration
    parameters:
      - name: app_db
        value: app:db

  - name: bootloader
    kind: ns.dependency
    component: wippy/bootloader
    parameters:
      - name: application_host
        value: app:processes
      - name: app_db
        value: app:db
      - name: env_storage
        value: app.env:store
```

Bootloader-у нужно хранилище окружения; добавьте стандартное в его собственном пространстве имён:

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

Создайте директорию данных и запустите приложение:

```bash
mkdir -p data
wippy run
```

При запуске выполняется миграция, и хранилище появляется в `data/app.db`:

```
$ sqlite3 data/app.db ".tables"
_migrations            embeddings_512         embeddings_512_chunks
embeddings_512_info    embeddings_512_rowids  embeddings_512_vector_chunks00
...
```

`embeddings_512` — это виртуальная таблица SQLite `vec0`; теневые таблицы
`embeddings_512_*` хранят её чанки, идентификаторы строк и метаданные. (На PostgreSQL та
же миграция использует `pgvector`.)

## Загрузка документов

Загрузка состоит из двух шагов: разбейте текст на чанки модулем `text`, затем запишите
их через `embeddings.add_batch`, который встраивает и сохраняет каждый чанк.

```lua
-- src/ingest.lua
local text = require("text")
local embeddings = require("embeddings")

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

Зарегистрируйте функцию:

```yaml
- name: ingest
  kind: function.lua
  source: file://ingest.lua
  method: ingest
  modules:
    - text
  imports:
    embeddings: wippy.embeddings:embeddings
```

Ключевые моменты:

- `origin_id` группирует все чанки из одного исходного документа — удаляйте и повторно
  загружайте по документу через `embedding_repo.delete_by_origin(doc_id)`.
- `content_type` позволяет держать разные корпуса (`doc_chunk`, `faq`, `code_snippet`) в
  одном хранилище и фильтровать на этапе запроса.
- `add_batch` автоматически разделяет, когда батч превышает лимит запроса в 8000 токенов.

## Проверка содержимого

После загрузки документов убедитесь, что строки появились, и выполните поиск по сходству:

```lua
local embeddings = require("embeddings")

local results, err = embeddings.search("how do I configure TLS?", {
    content_type = "doc_chunk",
    limit = 5,
})
-- results[i].content, .similarity, .meta, .origin_id, .context_id
```

Отсюда [руководство по RAG](tutorials/rag.md) показывает, как передать эти результаты в
LLM для обоснованных ответов.

## Эксплуатационные заметки

- **Размер чанка**: 500–1000 токенов — хорошая отправная точка. Используйте
  `chunk_overlap` (~10–20 % размера чанка), чтобы предложения не разрезались на границах.
- **Размерности**: `text-embedding-3-small` при 512 измерениях экономична по стоимости и
  соответствует таблице `embeddings_512`. Бо́льшие векторы означают больший объём
  хранилища и более медленный поиск.
- **Локальное vs. общее**: SQLite (`vec0`) держит всю базу знаний в одном локальном
  файле — идеально для разработки и одноузловых приложений. Укажите `target_db` на
  `db.sql.postgres` с `pgvector` для общего, продакшен-хранилища; код загрузки не меняется.

## Следующие шаги

- [RAG](tutorials/rag.md) — извлекайте из этого хранилища и генерируйте обоснованные ответы
- [LLM-фреймворк](framework/llm.md) — `llm.embed`, модели встраивания, провайдеры
- [Модуль Text](lua/text/text.md) — сплиттеры и токенизация
