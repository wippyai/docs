---
title: "Dataflow"
description: "Модуль wippy/dataflow предоставляет движок оркестрации рабочих процессов на основе направленных ациклических графов (DAG). Рабочие процессы состоят из узлов —…"
---

# Dataflow

Модуль `wippy/dataflow` предоставляет движок оркестрации рабочих процессов на основе направленных ациклических графов (DAG). Рабочие процессы состоят из узлов — функций, агентов, циклов и параллельных обработчиков, — соединённых типизированными маршрутами данных. Оркестратор управляет выполнением, сохранением состояния и восстановлением.

## Настройка

Добавьте модуль в проект:

```bash
wippy add wippy/dataflow
wippy install
```

Объявите зависимость:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.dataflow
    kind: ns.dependency
    component: wippy/dataflow
    version: "*"
```

Модуль dataflow зависит от `wippy/agent`, `wippy/llm` и `wippy/session` — они разрешаются автоматически при запуске `wippy install`. Для сохранения рабочих процессов модулю требуется ресурс базы данных `app:db`; миграции запускаются автоматически через `wippy/migration`.

Модуль публикует запись `env.variable` `userspace.dataflow.env:web_host_origin` (по умолчанию `https://front.wippy.ai`), которую нижестоящие потоки могут читать для построения публичных URL. Переопределите её через маршрутизатор окружения или requirement.

## Построитель потоков

Построитель потоков предоставляет fluent-интерфейс для составления рабочих процессов. Импортируйте его в запись:

```yaml
imports:
  flow: userspace.dataflow.flow:flow
```

```lua
local flow = require("flow")
```

### Основной API

```lua
flow.create()
    :with_title(title)
    :with_metadata(metadata)
    :with_input(data)
    :with_data(data)
    :[operation](config)
    :as(name)
    :to(target, input_key, transform)
    :error_to(target, input_key, transform)
    :when(condition)
    :run()   -- синхронно
    :start() -- асинхронно

flow.template()
    :[operations]...
```

### Линейный конвейер

Узлы связываются автоматически, если явная маршрутизация не задана. Вывод каждого узла передаётся следующему:

```lua
local result, err = flow.create()
    :with_input({ text = "Hello world" })
    :func("app:tokenize")
    :func("app:translate", { args = { target_lang = "fr" } })
    :func("app:format_output")
    :run()
```

### Именованная маршрутизация

Используйте `:as()` для именования узлов и `:to()` для маршрутизации данных между ними. Применяйте `:as()` только тогда, когда на узел нужно ссылаться:

```lua
local result, err = flow.create()
    :with_input(task)
        :to("router")

    :func("app:router"):as("router")
        :to("context", "routing")
        :to("dev", "routing")

    :agent("app:context_agent"):as("context")
        :to("dev", "gathered_context")

    :agent("app:dev_agent"):as("dev")
        :to("@success")

    :run()
```

Второй параметр `:to()` — **дискриминатор**, ключ входа на принимающем узле. Когда узел получает несколько входов, они собираются в таблицу с ключами по дискриминатору.

### Входные данные и статические данные рабочего процесса

`:with_input()` — единственный основной вход рабочего процесса. `:with_data()` создаёт независимые источники статических данных:

```lua
flow.create()
    :with_input(task)
        :to("router")

    :with_data(config):as("cfg")
        :to("dev", "config")
        :to("logger", "config")

    :with_data(branch):as("branch_data")
        :to("checker", "branch")

    :func("app:router"):as("router")
        :to("dev", "task")

    :func("app:dev"):as("dev")
        :to("@success")
        :error_to("@fail")

    :run()
```

Используйте `:with_input()` для внешних данных, поступающих в рабочий процесс. Используйте `:with_data()` для конфигурации, констант и справочных данных, разделяемых несколькими узлами. Статические данные используют оптимизацию по ссылке — первый маршрут создаёт реальные данные, последующие маршруты создают лёгкие ссылки.

### Условная маршрутизация

Используйте `:when()` после `:to()`, чтобы добавить условия. Условия вычисляются над выводом узла с использованием синтаксиса `expr`:

```lua
flow.create()
    :with_input(data)
    :func("app:classify"):as("classify")
        :to("handler_a"):when("output.category == 'a'")
        :to("handler_b"):when("output.category == 'b'")
        :to("fallback")
    :func("app:handler_a"):as("handler_a"):to("@success")
    :func("app:handler_b"):as("handler_b"):to("@success")
    :func("app:fallback"):as("fallback"):to("@success")
    :run()
```

Условия можно сочетать со встроенными преобразованиями для более сложной маршрутизации:

```lua
:func("app:decompose"):as("decompose")
    :to("@success", nil, "{passed: true, feedback: nil}"):when("len(output.items) == 0")
    :to("processor", "items", "output.items")
```

Условные выражения поддерживают: сравнения (`output.score > 0.8`), логические операторы (`output.valid && output.count > 5`), функции для массивов (`len(output.items) > 0`, `any(output.errors, {.critical})`), строковые операции (`output.status contains 'success'`) и опциональную цепочку (`output.data?.nested?.value`).

### Терминалы рабочего процесса

Направьте маршрут в `@success` или `@fail`, чтобы явно завершить рабочий процесс. Во вложенных контекстах (циклы, параллельные узлы) терминалы создают выводы узла, а не выводы рабочего процесса:

```lua
:func("app:final_step"):to("@success")
:func("app:handler"):error_to("@fail")
```

### Маршрутизация ошибок

Используйте `:error_to()`, чтобы направить ошибки узла обработчику. Ошибки можно маршрутизировать как обычные входы в узлы восстановления:

```lua
:agent("app:gpt_planner", { model = "gpt-5" }):as("gpt_planner")
    :to("consolidator", "gpt_plan")
    :error_to("consolidator", "gpt_plan")

:agent("app:claude_planner", { model = "claude-4-5-sonnet" }):as("claude_planner")
    :to("consolidator", "claude_plan")
    :error_to("consolidator", "claude_plan")

:agent("app:consolidator", {
    inputs = { required = { "gpt_plan", "claude_plan" } }
}):as("consolidator")
```

Этот паттерн запускает оба планировщика параллельно — если один из них завершается ошибкой, эта ошибка становится входом консолидатора, который продолжает работу с теми результатами, которые доступны.

## Слияние входов

То, как узлы получают входы, зависит от дискриминаторов и от того, задан ли `args`.

**Без args — один вход по умолчанию:**

```lua
:func("source"):to("target")
-- target получает: сырое содержимое (без обёртки)
```

**Без args — один именованный вход:**

```lua
:func("source"):to("target", "task")
-- target получает: { task = content }
```

**Без args — несколько входов:**

```lua
:func("source1"):to("target", "data")
:func("source2"):to("target", "config")
-- target получает: { data = content1, config = content2 }
```

**С args — входы сливаются в базовую таблицу:**

```lua
:func("app:api_client", {
    args = { base_url = "https://api.com", timeout = 5000 }
})
-- при :to("api_client", "body") от вышестоящего узла
-- api_client получает: { base_url = "https://api.com", timeout = 5000, body = content }
```

<note>
Узлы с <code>args</code> не могут получать входы с дискриминатором <code>"default"</code>. Используйте именованные дискриминаторы через <code>:to(target, "input_key")</code>.
</note>

## Преобразования входов

Преобразуйте данные до того, как они достигнут узла:

```lua
-- Строковое преобразование: одно выражение
:func("app:step", { input_transform = "input.nested.field" })

-- Табличное преобразование: именованные выражения
:func("app:step", {
    input_transform = {
        task = "inputs.task",
        config = "inputs.settings",
        priority = "output.score > 0.8 ? 'high' : 'normal'"
    }
})
```

Контекстные переменные, доступные в преобразованиях: `input` (вход рабочего процесса), `inputs` (все входящие входы узла), `output` (вывод текущего узла при маршрутизации).

### Встроенные преобразования маршрутов

Третий параметр `:to()` — встроенное выражение преобразования:

```lua
:func("source"):as("source")
    :to("target", nil, "output.data")
    :to("other", nil, "{passed: true, value: output.x}")
    :to("list", nil, "map(output.items, {.id})")
```

## Типы узлов

### Узел функции

Выполняет зарегистрированную запись `function.lua`:

```lua
:func("app:my_function", {
    args = { key = "value" },
    inputs = { required = { "task", "config" } },
    context = { session_id = "abc" },
    input_transform = { task = "inputs.prompt" },
    metadata = { title = "Process Data" }
})
```

| Опция | Тип | Описание |
|--------|------|-------------|
| `args` | table | Базовые аргументы, сливаемые с входами узла |
| `inputs` | table | Требования к входам: `{ required = {...}, optional = {...} }` |
| `context` | table | Контекст выполнения, передаваемый функции |
| `input_transform` | string/table | Выражение для преобразования входов |
| `metadata` | table | Метаданные узла (например, `{ title = "..." }`) |

Если функция возвращает `{ _control = { commands = [...] } }`, оркестратор порождает дочерний рабочий процесс. Так работают вложенные потоки.

### Узел агента

Выполняет агента с вызовом инструментов и опциональным структурированным выходом:

```lua
:agent("app:content_writer", {
    model = "gpt-5",
    inputs = { required = { "context", "content_plan", "analysis" } },
    arena = {
        prompt = "Write content based on the provided context.",
        max_iterations = 12,
        tool_calling = "any",
        exit_schema = {
            type = "object",
            properties = {
                content = { type = "string" },
                title = { type = "string" }
            },
            required = { "content", "title" }
        }
    },
    show_tool_calls = true,
    metadata = { title = "Content Writer" }
})
```

| Опция | Тип | Описание |
|--------|------|-------------|
| `model` | string | Переопределение модели |
| `arena.prompt` | string | Системный промпт |
| `arena.max_iterations` | number | Максимум циклов рассуждения (по умолчанию: 32) |
| `arena.min_iterations` | number | Минимум итераций до выхода (по умолчанию: 1) |
| `arena.tool_calling` | string | `"auto"`, `"any"` (требует `exit_schema`), `"none"` (отклоняет `exit_schema`) |
| `arena.tools` | array | Идентификаторы инструментов в реестре |
| `arena.exit_schema` | table | JSON-схема для структурированного выхода |
| `arena.exit_func_id` | string | Функция для проверки выходных данных |
| `arena.context` | table | Дополнительный контекст |
| `inputs` | table | Требования к входам |
| `show_tool_calls` | boolean | Включать вызовы инструментов в вывод |
| `input_transform` | string/table | Преобразование входов |
| `metadata` | table | Метаданные узла |

**Динамический выбор агента:** передайте пустую строку в качестве идентификатора агента и разрешите его через `input_transform`:

```lua
:agent("", {
    inputs = { required = { "spec", "task" } },
    input_transform = {
        agent_id = "inputs.spec.agent_id",
        task = "inputs.task"
    },
    arena = {
        prompt = "Process according to spec",
        max_iterations = 25
    }
})
```

**Проверка выхода:** когда задан `exit_func_id`, функция проверяет выходные данные агента. При неудачной проверке агент получает ошибку как наблюдение и продолжает работу (до `max_iterations`).

### Узел цикла

Многократно выполняет функцию или шаблон с сохраняемым состоянием:

```lua
:cycle({
    func_id = "app:content_cycle",
    max_iterations = 3,
    initial_state = {
        entry_id = entry_id,
        content_prompt = prompt,
        min_score = 8.0,
        feedback_history = {}
    }
})
```

На каждой итерации функция цикла получает:

```lua
{
    input = <workflow_input>,  -- только на первой итерации (iteration == 1); далее nil
    state = <accumulated_state>,
    last_result = <previous_iteration_output>,
    iteration = <current_iteration_number>
}
```

`input` содержит вход рабочего процесса только на первой итерации, далее равен `nil`; всё, что нужно между итерациями, сохраняйте в `state`.

Функция управляет продолжением:

```lua
function my_cycle(cycle_context)
    -- остановиться, если одобрено
    if cycle_context.last_result and cycle_context.last_result.approved then
        return {
            state = cycle_context.state,
            result = cycle_context.last_result,
            continue = false
        }
    end

    -- породить дочерний рабочий процесс для этой итерации
    -- задача читается из state, так как cycle_context.input равен nil после первой итерации
    return flow.create()
        :with_input({ task = cycle_context.state.task })
        :agent("app:worker")
        :agent("app:qa")
        :run()
end
```

| Опция | Тип | Описание |
|--------|------|-------------|
| `func_id` | string | Функция итерации (взаимоисключима с `template`) |
| `template` | FlowBuilder | Шаблон для каждой итерации (взаимоисключим с `func_id`) |
| `max_iterations` | number | Максимальное число итераций |
| `initial_state` | table | Начальное состояние |
| `continue_condition` | string | Выражение: продолжать, пока истинно |

**Цикл на основе шаблона:**

```lua
:cycle({
    template = flow.template()
        :agent("app:worker")
        :func("app:validator"),
    max_iterations = 5
})
```

### Параллельный узел

Паттерн map-reduce по массивам:

```lua
:parallel({
    inputs = { required = { "specs", "task" } },
    source_array_key = "specs",
    iteration_input_key = "spec",
    passthrough_keys = { "task" },
    batch_size = 10,
    on_error = "collect_errors",
    filter = "successes",
    unwrap = true,
    template = flow.template()
        :agent("app:processor", {
            inputs = { required = { "spec", "task" } },
            input_transform = {
                agent_id = "inputs.spec.agent_id",
                task = "inputs.task"
            },
            arena = {
                prompt = "Process according to spec",
                max_iterations = 25
            }
        })
        :to("@success"),
    metadata = { title = "Process Specs" }
})
```

| Опция | Тип | Описание |
|--------|------|-------------|
| `source_array_key` | string | Ключ входа, содержащий массив (обязателен) |
| `template` | FlowBuilder | Шаблон для каждого элемента (обязателен, должен вести в `@success`) |
| `iteration_input_key` | string | Ключ входа для текущего элемента (по умолчанию: `"default"`) |
| `batch_size` | number | Элементов в одном параллельном пакете (по умолчанию: 1 = последовательно) |
| `on_error` | string | `"collect_errors"` (по умолчанию) или `"fail_fast"` |
| `filter` | string | `"all"` (по умолчанию), `"successes"`, `"failures"` |
| `unwrap` | boolean | Возвращать сырые результаты вместо обёрнутых метаданными (по умолчанию: false) |
| `passthrough_keys` | array | Ключи входов, передаваемые в каждую итерацию |

**Сквозные ключи** передают общий контекст (конфигурацию, описание задачи) в каждую итерацию без дублирования данных в исходном массиве:

```lua
:with_data(file_list):as("files"):to("processor", "files")
:with_data("secret"):as("api_key"):to("processor", "api_key")

:parallel({
    inputs = { required = { "files", "api_key" } },
    source_array_key = "files",
    iteration_input_key = "filename",
    passthrough_keys = { "api_key" },
    template = flow.template()
        :func("app:upload", {
            inputs = { required = { "filename", "api_key" } }
        })
        :to("@success")
}):as("processor")
```

### Узел сигнала

Приостанавливает выполнение до прихода внешнего сигнала. Используйте для согласований человеком, внешних событий или поэтапных рабочих процессов:

```lua
:signal({
    signal_id = "approval",
    inputs = { required = { "draft" } },
    metadata = { title = "Wait for approval" }
})
```

| Опция | Тип | Описание |
|--------|------|-------------|
| `signal_id` | string | Имя сигнала, сопоставляемое с `client:signal()`. Если пусто или не задано, во время выполнения генерируется UUID v7 |
| `inputs` | table | Требования к входам |
| `input_transform` | string/table | Преобразование входов до их получения узлом |
| `metadata` | table | Метаданные узла |

Отправьте сигнал извне рабочего процесса через клиентский API (см. `client:signal()` ниже).

#### Поведение

Узел уступает выполнение с `wait_for_signal = true` и сохраняет этот yield в состоянии рабочего процесса. Оркестратор возобновляет узел, когда приходит подходящий коммит `NODE_SIGNAL`.

- Сигнал считается доставленным при любой полезной нагрузке, отличной от `nil`. `false`, `0`, `""` и `{}` удовлетворяют yield; только `nil` оставляет его в ожидании.
- Yield сигнала блокирует `COMPLETE_WORKFLOW`, но не блокирует другие ожидающие узлы — параллельные ветви продолжают выполняться, пока одна ветвь ждёт.
- Сигналы можно поставить в очередь до `:start()`: если подходящий коммит `NODE_SIGNAL` приходит до того, как узел сигнала достигнет yield, он доставляется в момент регистрации yield.
- Каждый yield удовлетворяется только одним сигналом. Если второй сигнал с тем же `signal_id` приходит до удовлетворения yield, он перезаписывает первый.
- Когда несколько yield сигналов разделяют один `signal_id`, данные получает первый подходящий yield.
- Если поле `signal_id` отсутствует, сопоставление выполняется по дискриминатору узла.
- Доставленные данные сигнала передаются в вывод узла как полезная нагрузка сигнала.

#### Долговечность и восстановление

Yield сигнала является частью состояния рабочего процесса и сохраняется через тот же механизм outbox, что и любая другая команда. Если процесс оркестратора завершается во время ожидания:

- Ожидающий yield восстанавливается при перезапуске.
- Сигналы, доставленные во время простоя, ставятся в очередь и применяются при перезагрузке состояния.
- Составные конвейеры (`func → signal → signal → func`) восстанавливаются пошагово — каждый сигнал может быть доставлен через отдельный перезапуск.

Осиротевшие yield сигналов (родительский процесс которых завершился без завершения yield) очищаются обработчиком завершения процесса в состоянии рабочего процесса.

#### Паттерны конвейеров

Узлы сигналов участвуют в любой топологии:

```lua
-- Согласование человеком между двумя функциями
flow.create()
    :func("app:draft")
    :signal({ signal_id = "approve_draft" })
    :func("app:publish")
    :run()

-- Два параллельных согласования, оба должны прийти до релиза
flow.create()
    :with_input({ doc = "release-notes" })
        :as("trigger")
        :to("legal", "doc")
        :to("finance", "doc")

    :signal({ signal_id = "legal_ok", inputs = { required = { "doc" } } })
        :as("legal")
        :to("gate", "legal")

    :signal({ signal_id = "finance_ok", inputs = { required = { "doc" } } })
        :as("finance")
        :to("gate", "finance")

    :join({ inputs = { required = { "legal", "finance" } } })
        :as("gate")
        :to("release")

    :func("app:release"):as("release"):to("@success")
    :run()
```

Данные сигнала становятся выводом узла, поэтому нижестоящие узлы получают то, что было передано в `client:signal()`.

### Узел объединения

Собирает несколько входов перед продолжением:

```lua
:join({
    inputs = { required = { "source1", "source2" } },
    output_mode = "object",
    ignored_keys = { "triggered" }
})
```

| Опция | Тип | Описание |
|--------|------|-------------|
| `output_mode` | string | `"object"` (по умолчанию) или `"array"` (в порядке поступления) |
| `ignored_keys` | array | Ключи входов, исключаемые из вывода |
| `inputs` | table | Требования к входам |

## Шаблоны

Шаблоны определяют переиспользуемые подпроцессы. Создавайте через `flow.template()`, встраивайте через `:use()`:

```lua
local preprocessor = flow.template()
    :func("app:clean")
    :func("app:tokenize")

flow.create()
    :with_input(data)
    :use(preprocessor)
    :func("app:process")
    :run()
```

Шаблоны встраивают свои операции в родительский поток на этапе компиляции.

## Вложенные рабочие процессы

Функции, используемые в циклах и параллельных узлах, могут порождать дочерние рабочие процессы, возвращая `flow.create():run()`:

```lua
function my_processor(input)
    return flow.create()
        :with_input(input)
        :func("app:step_a")
        :func("app:step_b")
        :run()
end
```

Когда `:run()` выполняется внутри существующего контекста dataflow, он возвращает `{ _control = { commands = [...] } }` вместо непосредственного выполнения. Оркестратор обрабатывает дочерний рабочий процесс через механизм yield.

<note>
Функции, участвующие в композиции dataflow, <strong>обязаны</strong> возвращать <code>flow.create():run()</code>. Функции, возвращающие что-либо иное, не могут порождать дочерние рабочие процессы.
</note>

## Синхронный и асинхронный режимы

`:run()` блокируется до завершения рабочего процесса и возвращает вывод:

```lua
local result, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :run()
```

`:start()` возвращается немедленно с идентификатором рабочего процесса:

```lua
local dataflow_id, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :start()
```

`:start()` нельзя использовать во вложенных контекстах.

## Клиентский API

Для программного управления рабочими процессами:

```yaml
imports:
  client: userspace.dataflow:client
```

```lua
local client = require("client")

local c, err = client.new()
```

| Метод | Описание |
|--------|-------------|
| `client.new()` | Создать клиент (требует актора безопасности) |
| `:create_workflow(commands, options?)` | Создать рабочий процесс, возвращает `dataflow_id` |
| `:execute(dataflow_id, options?)` | Выполнить синхронно, возвращает результат |
| `:start(dataflow_id, options?)` | Выполнить асинхронно, возвращает `dataflow_id` |
| `:output(dataflow_id)` | Получить выводы рабочего процесса |
| `:get_status(dataflow_id)` | Получить текущий статус |
| `:cancel(dataflow_id, timeout?)` | Корректно отменить (по умолчанию: 30 с) |
| `:terminate(dataflow_id)` | Принудительно завершить |
| `:signal(dataflow_id, signal_id, data?)` | Доставить внешний сигнал ожидающему узлу сигнала |

## Статусы рабочего процесса

| Статус | Описание |
|--------|-------------|
| `template` | Узел является экземпляром шаблона |
| `pending` | Ожидание входов |
| `ready` | Входы собраны, готов к выполнению |
| `running` | Выполняется |
| `paused` | Уступил выполнение, ожидает дочерний рабочий процесс |
| `completed` | Успешно завершён |
| `failed` | Завершён с ошибкой |
| `cancelled` | Отменён пользователем |
| `skipped` | Условная ветвь не выбрана |
| `terminated` | Принудительно завершён |

## Метаданные

```lua
flow.create()
    :with_title("Document Processing Pipeline")
    :with_metadata({ source = "api", priority = "high" })
    :func("app:process", { metadata = { title = "Process Document" } })
    :run()
```

Если заголовок не задан, по умолчанию используется "Flow Builder Workflow".

## Правила валидации

Компилятор проверяет рабочие процессы на этапе компиляции:

- Все имена `:as(name)` должны быть уникальными
- Все цели `:to()` и `:error_to()` должны ссылаться на существующие имена (кроме `@success`, `@fail`)
- Граф должен быть ациклическим
- У всех узлов должны быть входящие маршруты (от другого узла, входа рабочего процесса или статических данных)
- `:cycle()` требует `func_id` или `template` (не оба сразу)
- `:parallel()` требует `source_array_key` и `template`
- Хотя бы один путь должен вести в `@success` или иметь автоматический вывод
- `:when()` следует только за `:to()` или `:error_to()` от узлов (не от статических данных)
- Узлы с `args` не могут получать входы с дискриминатором `"default"`

## Справочник по выражениям

Выражения используют синтаксис модуля `expr` и доступны в условиях `:when()` и значениях `input_transform`.

**Операторы:** `+`, `-`, `*`, `/`, `%`, `**`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`, `!`, `contains`, `startsWith`, `endsWith`

**Функции для массивов:** `all()`, `any()`, `none()`, `one()`, `filter()`, `map()`, `count()`, `len()`, `first()`, `last()`

**Математические функции:** `max()`, `min()`, `abs()`, `ceil()`, `floor()`, `round()`, `sqrt()`, `pow()`

**Строковые функции:** `len()`, `upper()`, `lower()`, `trim()`, `split()`, `join()`

**Функции типов:** `type()`, `int()`, `float()`, `string()`

**Литералы:** числа, строки, булевы значения (`true`/`false`), null (`nil`), массивы (`[1, 2, 3]`), объекты (`{key: value}`)

**Тернарный оператор:** `output.age >= 18 ? output.verified : false`

**Опциональная цепочка:** `output.data?.nested?.value`

## Обработка ошибок

И `:run()`, и `:start()` следуют стандартным соглашениям Lua об ошибках:

- Успех: `data, nil` (run) или `dataflow_id, nil` (start)
- Ошибка: `nil, error_message`

Категории ошибок: ошибки компиляции, ошибки клиента, ошибки создания рабочего процесса, ошибки выполнения и сбои рабочего процесса.

## Смотрите также

- [Агенты](framework/agents.md) - фреймворк агентов, используемый узлами агентов
- [LLM](framework/llm.md) - модуль LLM
- [Обзор фреймворка](framework/overview.md) - использование модулей фреймворка
