# Embeddings

Модуль `wippy/embeddings` предоставляет хранилище векторных эмбеддингов и поиск по сходству для PostgreSQL (pgvector) и SQLite (sqlite-vec). Он оборачивает `wippy/llm` для генерации эмбеддингов и сохраняет их в базе данных приложения.

## Настройка

Добавьте модуль в проект:

```bash
wippy add wippy/embeddings
wippy install
```

Объявите зависимость и укажите в требовании `target_db` базу данных вашего приложения:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    path: ./data/app.db

  - name: dep.embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"

  - name: target_db
    kind: registry.entry
    meta:
      wippy.embeddings.target_db: app:app_db
```

При запуске `wippy/migration` подхватывает миграцию `01_create_embeddings_table` и создаёт таблицу `embeddings` с соответствующим векторным индексом для вашего драйвера базы данных.

## Константы конфигурации

Конфигурация по умолчанию встроена в модуль:

| Константа | Значение по умолчанию | Описание |
|-----------|-----------------------|----------|
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Модель LLM для генерации векторов |
| `EMBEDDING_DIMENSIONS` | `512` | Размер вектора, передаваемый в модель |
| `MAX_TOKENS_PER_REQUEST` | `8000` | Бюджет токенов на вызов; крупные батчи разбиваются |
| `DEFAULT_SEARCH_LIMIT` | `10` | Количество результатов, возвращаемых `search` по умолчанию |

Токены оцениваются как `#text / 4`. Батчи, превышающие бюджет, разбиваются автоматически.

## Импорт

```yaml
entries:
  - name: my_app
    kind: library.lua
    source: file://my_app.lua
    imports:
      embeddings: wippy.embeddings:embeddings
```

```lua
local embeddings = require("embeddings")
```

## Высокоуровневый API (`wippy.embeddings:embeddings`)

### add

```lua
local result, err = embeddings.add(content, content_type, origin_id, context_id, meta)
```

Генерирует эмбеддинг для `content` и сохраняет его.

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `content` | string | да | Текст для встраивания |
| `content_type` | string | да | Произвольная метка, например `"document_chunk"`, `"question"` |
| `origin_id` | string | да | Идентификатор исходного документа или записи |
| `context_id` | string | нет | Дополнительный ключ области (раздел, чат, арендатор) |
| `meta` | table | нет | Произвольные метаданные, сериализуемые в JSON |

Возвращает `{ id, content, content_type, origin_id, context_id, meta }` или `nil, err`.

### add_batch

```lua
local result, err = embeddings.add_batch({
    { content = "...", content_type = "chunk", origin_id = "doc-1" },
    { content = "...", content_type = "chunk", origin_id = "doc-1", context_id = "s1" },
})
```

Встраивает и сохраняет множество элементов за один вызов. Если оценённое общее количество токенов превышает `MAX_TOKENS_PER_REQUEST`, батч разбивается и обрабатывается частями. Возвращает `{ count, items = { ... } }`.

### search

```lua
local hits, err = embeddings.search("how do migrations work?", {
    content_type = "document_chunk",
    origin_id    = "doc-1",
    context_id   = "section-2",
    limit        = 10,
})
```

Встраивает строку запроса и выполняет поиск по сходству среди сохранённых векторов. Все фильтры опциональны; совпавшие записи упорядочиваются по сходству.

### find_by_type

```lua
local hits, err = embeddings.find_by_type(query, content_type, { limit = 10 })
```

Удобная обёртка над `search` с областью одного `content_type`.

### find_by_origin

```lua
local hits, err = embeddings.find_by_origin(query, origin_id, {
    content_type = "document_chunk",
    context_id   = "section-2",
    limit        = 5,
})
```

Удобная обёртка с областью одного `origin_id`, опционально с дополнительным сужением.

## API репозитория (`wippy.embeddings:embedding_repo`)

Используйте репозиторий напрямую, когда у вас уже есть вектор и нужно пропустить генерацию эмбеддинга:

| Функция | Описание |
|---------|----------|
| `embedding_repo.add(content, content_type, origin_id, context_id, meta, embedding)` | Вставить предвычисленный вектор |
| `embedding_repo.add_batch(batch)` | Вставить множество предвычисленных векторов одним запросом |
| `embedding_repo.get_by_origin(origin_id)` | Получить все записи по заданному origin |
| `embedding_repo.delete_by_origin(origin_id)` | Удалить все записи по заданному origin |
| `embedding_repo.delete_by_entry(entry_id)` | Удалить одну запись по её идентификатору строки |
| `embedding_repo.search_by_embedding(vector, options)` | Поиск по сходству с сырым вектором |

`search_by_embedding` принимает `{ content_type, origin_id, context_id, limit }`.

## Поддержка баз данных

Миграция создаёт схему, соответствующую драйверу базы данных в `target_db`:

- **PostgreSQL** -- таблица `embeddings` со столбцом `vector(512)` и индексом IVFFlat. Требуется расширение `pgvector`.
- **SQLite** -- таблица `embeddings` с вектором, хранящимся как текст, плюс сопутствующая виртуальная таблица `sqlite-vec` для KNN-поиска.

Векторы на уровне API всегда передаются через обычный JSON-массив.

## См. также

- [LLM](framework/llm.md) -- `llm.embed(...)` для прямой генерации эмбеддингов
- [Migrations](framework/migration.md) -- Запуск миграций, создающий таблицу
- [Обзор фреймворка](framework/overview.md) -- Использование модулей фреймворка
