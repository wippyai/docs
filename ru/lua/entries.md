---
title: "Типы записей Lua"
description: "Конфигурация Lua-записей: функций, процессов, workflows и библиотек."
---

# Типы записей Lua

Конфигурация Lua-записей: функций, процессов, workflows и библиотек.

## Типы записей

| Тип | Описание |
|-----|----------|
| `function.lua` | Функция без состояния, запускается по запросу |
| `process.lua` | Долгоживущий актор с состоянием |
| `workflow.lua` | Устойчивый workflow (Temporal) |
| `library.lua` | Разделяемый код, импортируемый другими записями |
| `module.lua` | Модульная поверхность (библиотека с несколькими методами) |

Каждый тип имеет предкомпилированный аналог в виде байткода (`function.lua.bc`, `library.lua.bc`, `process.lua.bc`, `workflow.lua.bc`), который создаётся `wippy pack --bytecode`. Авторы пишут `.lua`-записи; типы байткода создаются автоматически при упаковке.

## Общие поля

Все Lua-записи имеют эти поля:

| Поле | Обязательно | Описание |
|------|-------------|----------|
| `name` | да | Уникальное имя в пространстве имён |
| `kind` | да | Один из Lua-типов выше |
| `source` | да | Путь к Lua-файлу (`file://path.lua`) |
| `method` | function/process/workflow | Экспортируемая функция (библиотеки её не используют) |
| `modules` | нет | Разрешённые модули для `require()` |
| `imports` | нет | Другие записи как локальные модули |
| `meta` | нет | Поисковые метаданные |

## function.lua

Функция без состояния, вызываемая по запросу. Каждый вызов независим.

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
```

Используйте для: HTTP-обработчиков, трансформаций данных, утилит.

## process.lua

Долгоживущий актор, хранящий состояние между сообщениями. Общается через передачу сообщений.

```yaml
- name: worker
  kind: process.lua
  source: file://worker.lua
  method: main
  modules:
    - process
    - sql
```

Используйте для: фоновых воркеров, сервисных демонов, акторов с состоянием.

Для запуска как супервизируемого сервиса:

```yaml
- name: worker_service
  kind: process.service
  process: app:worker
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

## workflow.lua

Устойчивый workflow, переживающий перезапуски. Состояние сохраняется в Temporal.

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - workflow
    - time
```

Используйте для: многошаговых бизнес-процессов, длительных оркестраций.

## library.lua

Разделяемый код, импортируемый другими записями.

```yaml
- name: helpers
  kind: library.lua
  source: file://helpers.lua
  modules:
    - json
    - base64
```

Другие записи ссылаются через `imports`:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  imports:
    helpers: app.lib:helpers
```

В Lua-коде:

```lua
local helpers = require("helpers")
helpers.format_date(timestamp)
```

## Модули

Поле `modules` контролирует, какие модули загружаются через `require()`:

```yaml
modules:
  - http
  - json
  - sql
  - process
```

`channel`, `print`, `subscribe` и `unsubscribe` загружаются как Lua-глобалы — их не нужно указывать в `modules:`.

Доступны только перечисленные модули. Это обеспечивает:
- Безопасность: запрет доступа к системным модулям
- Явные зависимости: понятно, что нужно коду
- Детерминизм: workflows получают только детерминированные модули

См. [Lua Runtime](lua/overview.md) для доступных модулей.

## Импорты

Импорт других записей как локальных модулей:

```yaml
imports:
  utils: app.lib:utils       # require("utils")
  auth: app.auth:helpers     # require("auth")
```

Ключ становится именем модуля в Lua-коде. Значение — ID записи (`namespace:name`).

## Конфигурация пула

Настройка пула выполнения для функций:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  pool:
    type: adaptive    # по умолчанию
    size: 4           # начальное число воркеров
    max_size: 16      # верхний предел для эластичных пулов
```

| Поле | Пулы | Описание |
|------|------|----------|
| `type` | все | Реализация планировщика (см. таблицу ниже) |
| `size` | static, lazy, adaptive | Начальное число воркеров |
| `workers` | engine v2 | Число рабочих потоков |
| `buffer` | static, adaptive | Размер очереди задач (по умолчанию `workers * 64`) |
| `warm_start` | adaptive | Прекомпиляция записей при старте |
| `max_size` | lazy, adaptive | Верхний предел эластичного роста (по умолчанию 16) |

| Тип | Поведение |
|-----|-----------|
| `inline` | Синхронное выполнение в горутине вызывающего. Минимальная задержка, без изоляции между вызовами. |
| `lazy` | Нет idle-воркеров, создаются по требованию, удаляются в простое. |
| `static` | Пул фиксированного размера на каналах. Предсказуем при стабильной нагрузке. |
| `adaptive` | Самомасштабирующийся пул — растёт под нагрузкой, сжимается в простое. По умолчанию. |

## Метаданные

Используйте `meta` для маршрутизации и обнаружения:

```yaml
- name: api_handler
  kind: function.lua
  meta:
    type: handler
    version: "2.0"
    tags: [api, users]
  source: file://api.lua
  method: handle
  modules:
    - http
    - json
```

Метаданные доступны для поиска через реестр:

```lua
local registry = require("registry")
local handlers = registry.find({type = "handler"})
```

## См. также

- [Типы записей](guides/entry-kinds.md) — справочник всех типов
- [Вычислительные единицы](concepts/compute-units.md) — функции vs процессы vs workflows
- [Lua Runtime](lua/overview.md) — доступные модули
