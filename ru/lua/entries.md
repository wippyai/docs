# Типы записей Lua

Конфигурация Lua-записей: функций, процессов, workflows и библиотек.

## Типы записей

| Тип | Описание |
|-----|----------|
| `function.lua` | Функция без состояния, запускается по запросу |
| `process.lua` | Долгоживущий актор с состоянием |
| `workflow.lua` | Устойчивый workflow (Temporal) |
| `library.lua` | Разделяемый код, импортируемый другими записями |

## Общие поля

Все Lua-записи имеют эти поля:

| Поле | Обязательно | Описание |
|------|-------------|----------|
| `name` | да | Уникальное имя в пространстве имён |
| `kind` | да | Один из Lua-типов выше |
| `source` | да | Путь к Lua-файлу (`file://path.lua`) |
| `method` | да | Экспортируемая функция |
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
    - channel
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
  method: main
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
  - channel
```

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
    type: inline    # Выполнение в контексте вызывающего
```

Типы пулов:
- `inline` — выполнение в контексте вызывающего (по умолчанию для HTTP-обработчиков)

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
