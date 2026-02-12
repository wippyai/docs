# Агенты

Модуль `wippy/agent` предоставляет фреймворк для создания AI-агентов с поддержкой инструментов, потоковой передачи, делегирования, трейтов и памяти. Агенты определяются декларативно и выполняются через паттерн контекст/раннер.

## Настройка

Добавьте модуль в проект:

```bash
wippy add wippy/agent
wippy install
```

Модуль агентов требует `wippy/llm` и хост процессов. Объявите обе зависимости:

```yaml
version: "1.0"
namespace: app

entries:
  - name: os_env
    kind: env.storage.os

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: dep.llm
    kind: ns.dependency
    component: wippy/llm
    version: "*"
    parameters:
      - name: env_storage
        value: app:os_env
      - name: process_host
        value: app:processes

  - name: dep.agent
    kind: ns.dependency
    component: wippy/agent
    version: "*"
    parameters:
      - name: process_host
        value: app:processes
```

## Определение агентов

Агенты -- это записи реестра с `meta.type: agent.gen1`:

```yaml
entries:
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
      title: Assistant
      comment: A helpful chat assistant
    prompt: |
      You are a helpful assistant. Be concise and direct.
      Answer questions clearly.
    model: gpt-4o
    max_tokens: 1024
    temperature: 0.7
```

### Поля агента

| Поле | Тип | Описание |
|------|-----|----------|
| `meta.type` | string | Должен быть `agent.gen1` |
| `meta.name` | string | Идентификатор агента |
| `prompt` | string | Системный промпт |
| `model` | string | Имя модели или класс |
| `max_tokens` | number | Максимальное количество выходных токенов |
| `temperature` | number | Контроль случайности, 0-1 |
| `thinking_effort` | number | Глубина размышления 0-100 |
| `tools` | array | Идентификаторы инструментов в реестре |
| `traits` | array | Ссылки на трейты |
| `delegates` | array | Ссылки на агентов-делегатов |
| `memory` | array | Статические элементы памяти (строки) |
| `memory_contract` | table | Конфигурация динамической памяти |

## Контекст агента

Контекст агента -- это основная точка входа. Создайте контекст, при необходимости настройте его, затем загрузите агента:

```yaml
imports:
  agent_context: wippy.agent:context
```

```lua
local agent_context = require("agent_context")

local ctx = agent_context.new()
local runner, err = ctx:load_agent("app:assistant")
if err then
    error("Failed to load agent: " .. tostring(err))
end
```

### Методы контекста

| Метод | Описание |
|-------|----------|
| `agent_context.new(options?)` | Создать новый контекст |
| `:add_tools(specs)` | Добавить инструменты во время выполнения |
| `:add_delegates(specs)` | Добавить агентов-делегатов |
| `:set_memory_contract(config)` | Настроить динамическую память |
| `:update_context(updates)` | Обновить контекст выполнения |
| `:load_agent(spec_or_id, options?)` | Загрузить и скомпилировать агента, возвращает раннер |
| `:switch_to_agent(id, options?)` | Переключиться на другого агента, возвращает `(boolean, string?)` |
| `:switch_to_model(name)` | Изменить модель текущего агента, возвращает `(boolean, string?)` |
| `:get_current_agent()` | Получить текущий раннер |

### Параметры контекста

```lua
local ctx = agent_context.new({
    context = { session_id = "abc", user_id = "u1" },
    delegate_tools = { enabled = true },
})
```

### Загрузка по встроенной спецификации

Загрузите агента без записи в реестре:

```lua
local runner, err = ctx:load_agent({
    id = "inline-agent",
    name = "helper",
    prompt = "You are a helpful assistant.",
    model = "gpt-4o",
    max_tokens = 1024,
    tools = { "app.tools:search" },
})
```

## Выполнение шагов

Раннер выполняет один шаг рассуждения. Передайте построитель промптов с диалогом:

```lua
local prompt = require("prompt")

local conversation = prompt.new()
conversation:add_user("What is the capital of France?")

local response, err = runner:step(conversation)
if err then
    error(tostring(err))
end

print(response.result)
```

### Параметры шага

```lua
local response, err = runner:step(conversation, {
    context = { session_id = "abc" },
    stream_target = { reply_to = process.pid(), topic = "stream" },
    tool_call = "auto",
})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `context` | table | Контекст выполнения, объединяемый с контекстом агента |
| `stream_target` | table | Потоковая передача: `{ reply_to, topic }` |
| `tool_call` | string | `"auto"`, `"required"`, `"none"` |

### Ответ шага

| Поле | Тип | Описание |
|------|-----|----------|
| `result` | string | Сгенерированный текст |
| `tokens` | table | Использование токенов |
| `finish_reason` | string | Причина остановки |
| `tool_calls` | table? | Вызовы инструментов для выполнения |
| `delegate_calls` | table? | Вызовы делегатов |

### Статистика раннера

```lua
local stats = runner:get_stats()
-- stats.id, stats.name, stats.total_tokens
```

## Определение инструментов

Инструменты -- это записи `function.lua` с `meta.type: tool`. Определяйте их в отдельном `_index.yaml`:

```yaml
version: "1.0"
namespace: app.tools

entries:
  - name: calculate
    kind: function.lua
    meta:
      type: tool
      title: Calculate
      input_schema: |
        {
          "type": "object",
          "properties": {
            "expression": {
              "type": "string",
              "description": "Math expression to evaluate"
            }
          },
          "required": ["expression"],
          "additionalProperties": false
        }
      llm_alias: calculate
      llm_description: Evaluate a mathematical expression.
    source: file://calculate.lua
    modules: [expr]
    method: handler
```

```lua
local expr = require("expr")

local function handler(args)
    local result, err = expr.eval(args.expression)
    if err then
        return { error = tostring(err) }
    end
    return { result = result }
end

return { handler = handler }
```

### Метаданные инструмента

| Поле | Тип | Описание |
|------|-----|----------|
| `meta.type` | string | Должен быть `tool` |
| `meta.input_schema` | string/table | JSON Schema для аргументов инструмента |
| `meta.llm_alias` | string | Имя, видимое для LLM |
| `meta.llm_description` | string | Описание, видимое для LLM |
| `meta.exclusive` | boolean | Если true, отменяет параллельные вызовы инструментов |

### Ссылки на инструменты в агентах

Перечислите идентификаторы инструментов из реестра в определении агента:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
    prompt: You are a helpful assistant with tools.
    model: gpt-4o
    max_tokens: 1024
    tools:
      - app.tools:calculate
      - app.tools:search
      - app.tools:*          # wildcard: all tools in namespace
```

На инструменты также можно ссылаться с пользовательскими алиасами и контекстом:

```yaml
    tools:
      - id: app.tools:search
        alias: web_search
        context:
          api_key: "${SEARCH_API_KEY}"
```

## Выполнение инструментов

Когда шаг агента возвращает `tool_calls`, выполните их и передайте результаты обратно:

```lua
local json = require("json")
local funcs = require("funcs")

local function execute_and_continue(runner, conversation)
    while true do
        local response, err = runner:step(conversation)
        if err then return nil, err end

        local tool_calls = response.tool_calls
        if not tool_calls or #tool_calls == 0 then
            return response.result, nil
        end

        for _, tc in ipairs(tool_calls) do
            local result, call_err = funcs.call(tc.registry_id, tc.arguments)
            local result_str
            if call_err then
                result_str = json.encode({ error = tostring(call_err) })
            else
                result_str = json.encode(result)
            end

            conversation:add_function_call(tc.name, tc.arguments, tc.id)
            conversation:add_function_result(tc.name, result_str, tc.id)
        end
    end
end
```

### Поля вызова инструмента

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный идентификатор вызова |
| `name` | string | Имя инструмента (алиас или llm_alias) |
| `arguments` | table | Разобранные аргументы |
| `registry_id` | string | Полный идентификатор в реестре для `funcs.call()` |

<note>
Используйте <code>funcs.call(tc.registry_id, tc.arguments)</code> для выполнения инструментов. Поле <code>registry_id</code> напрямую соответствует записи инструмента в реестре.
</note>

## Потоковая передача

Передавайте ответы агента в реальном времени, используя `stream_target`:

```lua
local TOPIC = "agent_stream"

local function stream_step(runner, conversation)
    local stream_ch = process.listen(TOPIC)

    local done_ch = channel.new(1)
    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = TOPIC,
            },
        })
        done_ch:send({ response = response, err = err })
    end)

    local full_text = ""
    while true do
        local result = channel.select({
            stream_ch:case_receive(),
            done_ch:case_receive(),
        })
        if not result.ok then break end

        if result.channel == done_ch then
            process.unlisten(stream_ch)
            local r = result.value
            return full_text, r.response, r.err
        end

        local chunk = result.value
        if chunk.type == "chunk" then
            io.write(chunk.content or "")
            full_text = full_text .. (chunk.content or "")
        elseif chunk.type == "done" then
            -- wait for the step to complete
            local r, ok = done_ch:receive()
            process.unlisten(stream_ch)
            if ok and r then
                return full_text, r.response, r.err
            end
            return full_text, nil, nil
        end
    end

    process.unlisten(stream_ch)
    return full_text, nil, nil
end
```

Поток использует те же типы чанков, что и прямая потоковая передача LLM: `"chunk"`, `"thinking"`, `"tool_call"`, `"error"`, `"done"`.

<tip>
Используйте <code>coroutine.spawn</code> для запуска <code>runner:step()</code> в отдельной корутине, чтобы получать чанки потока параллельно. Используйте <code>channel.select</code> для мультиплексирования каналов потока и завершения.
</tip>

## Делегаты

Агенты могут делегировать задачи другим агентам. Делегаты отображаются как инструменты для родительского агента:

```yaml
  - name: coordinator
    kind: registry.entry
    meta:
      type: agent.gen1
      name: coordinator
    prompt: Route questions to the right specialist.
    model: gpt-4o
    max_tokens: 1024
    delegates:
      - id: app:code_agent
        name: ask_coder
        rule: for programming questions
      - id: app:math_agent
        name: ask_mathematician
        rule: for math problems
```

Вызовы делегатов появляются в `response.delegate_calls`:

```lua
local response = runner:step(conversation)

if response.delegate_calls then
    for _, dc in ipairs(response.delegate_calls) do
        -- dc.agent_id - target agent registry ID
        -- dc.name - delegate tool name
        -- dc.arguments - forwarded message
    end
end
```

Делегатов также можно добавлять во время выполнения:

```lua
ctx:add_delegates({
    { id = "app:specialist", name = "ask_specialist", rule = "for domain questions" },
})
```

## Трейты

Трейты -- это переиспользуемые возможности, которые добавляют промпты, инструменты и поведение агентам:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
    prompt: You are a helpful assistant.
    model: gpt-4o
    traits:
      - time_aware
      - id: custom_trait
        context:
          key: value
```

### Встроенные трейты

| Трейт | Описание |
|-------|----------|
| `time_aware` | Добавляет текущую дату и время в промпт |

Трейт `time_aware` принимает параметры контекста:

```yaml
    traits:
      - id: time_aware
        context:
          timezone: America/New_York
          time_interval: 15
```

### Пользовательские трейты

Трейты -- это записи реестра с `meta.type: agent.trait`. Они могут предоставлять:
- **prompt** -- статический текст, добавляемый к системному промпту
- **build_func_id** -- функция, вызываемая при компиляции для добавления инструментов, промптов, делегатов
- **prompt_func_id** -- функция, вызываемая на каждом шаге для внедрения динамического контента
- **step_func_id** -- функция, вызываемая на каждом шаге для побочных эффектов

## Память

### Статическая память

Простые элементы памяти, добавляемые к системному промпту:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
    prompt: You are a helpful assistant.
    model: gpt-4o
    memory:
      - "User prefers concise answers"
      - "Always cite sources when possible"
```

### Динамический контракт памяти

Настройка динамического извлечения памяти из внешнего источника:

```yaml
    memory_contract:
      implementation_id: app:memory_store
      context:
        user_id: "${user_id}"
      options:
        max_items: 5
        max_length: 2000
        recall_cooldown: 2
        min_conversation_length: 3
```

Контракт памяти вызывается во время `runner:step()` для извлечения релевантных элементов на основе контекста диалога. Результаты внедряются как сообщения разработчика.

| Параметр | Описание |
|----------|----------|
| `max_items` | Максимальное количество элементов памяти за одно извлечение |
| `max_length` | Максимальная общая длина в символах |
| `recall_cooldown` | Минимальное количество шагов между извлечениями |
| `min_conversation_length` | Минимальное количество ходов диалога до первого извлечения |

## Контракт резолвера

Когда `load_agent()` получает строковый идентификатор, сначала выполняется попытка разрешить его через контракт `wippy.agent:resolver`. Если резолвер не привязан или возвращает nil, используется поиск в реестре.

Это позволяет приложениям реализовать пользовательское разрешение агентов, например загрузку определений агентов из базы данных.

### Привязка резолвера

Определите функцию резолвера и привяжите её к контракту:

```yaml
entries:
  - name: agent_resolver.resolve
    kind: function.lua
    source: file://agent_resolver.lua
    method: resolve
    modules:
      - logger
    imports:
      agent_registry: wippy.agent.discovery:registry

  - name: agent_resolver_binding
    kind: contract.binding
    contracts:
      - contract: wippy.agent:resolver
        default: true
        methods:
          resolve: app:agent_resolver.resolve
```

### Реализация резолвера

Резолвер получает `{ agent_id = "..." }` и возвращает таблицу спецификации агента или nil:

```lua
local agent_registry = require("agent_registry")

local CUSTOM_PREFIX = "custom:"

function resolve(args)
    local agent_id = args.agent_id
    if not agent_id then
        return nil, "agent_id is required"
    end

    if agent_id:sub(1, #CUSTOM_PREFIX) == CUSTOM_PREFIX then
        local id = agent_id:sub(#CUSTOM_PREFIX + 1)

        -- load from database, config file, or any other source
        return {
            id = agent_id,
            name = "custom-agent",
            prompt = "You are a custom agent.",
            model = "class:balanced",
            max_tokens = 1024,
            tools = {},
        }
    end

    -- fall back to registry
    local spec, err = agent_registry.get_by_id(agent_id)
    if not spec then
        spec, err = agent_registry.get_by_name(agent_id)
    end
    return spec, err
end

return {
    resolve = resolve,
}
```

### Порядок разрешения

1. Попытка через контракт `wippy.agent:resolver` (если привязан)
2. Поиск в реестре по ID
3. Поиск в реестре по имени
4. Возврат ошибки, если не найден

Этот паттерн позволяет создавать мультитенантные приложения, где агенты настраиваются для каждого пользователя или рабочего пространства и хранятся за пределами реестра фреймворка.

## Смотрите также

- [LLM](llm.md) - Базовый модуль LLM
- [Создание LLM-агента](../tutorials/llm-agent.md) - Пошаговое руководство
- [Обзор фреймворка](overview.md) - Использование модулей фреймворка
