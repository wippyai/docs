# LLM-агент

Пошаговое создание терминального чат-агента: от простого вызова LLM до потокового агента с инструментами.

## Что мы создаём

Терминальный чат-агент, который:
- Генерирует текст с помощью LLM
- Поддерживает многоходовые диалоги
- Передаёт ответы в реальном времени
- Использует инструменты для доступа к внешним возможностям

## Структура проекта

```
llm-agent/
├── .wippy.yaml
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── ask.lua
    ├── chat.lua
    └── tools/
        ├── _index.yaml
        ├── current_time.lua
        └── calculate.lua
```

## Фаза 1: Простая генерация

Начнём с базовой функции, которая вызывает `llm.generate()` со строковым промптом.

### Создание проекта

```bash
mkdir llm-agent && cd llm-agent
mkdir -p src
```

### Определение записей

Создайте `src/_index.yaml`:

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

  - name: ask
    kind: function.lua
    source: file://ask.lua
    method: handler
    imports:
      llm: wippy.llm:llm
```

Модулю LLM нужны две инфраструктурные записи:
- `env.storage.os` предоставляет API-ключи из переменных окружения
- `process.host` предоставляет среду выполнения процессов, используемую модулем LLM

### Код генерации

Создайте `src/ask.lua`:

```lua
local llm = require("llm")

local function handler(input)
    local response, err = llm.generate(input, {
        model = "gpt-4.1-nano",
        temperature = 0.7,
        max_tokens = 512,
    })

    if err then
        return nil, err
    end

    return response.result
end

return { handler = handler }
```

### Определение модели

Модуль LLM разрешает модели из реестра. Добавьте запись модели в `_index.yaml`:

```yaml
  - name: gpt-4.1-nano
    kind: registry.entry
    meta:
      name: gpt-4.1-nano
      type: llm.model
      title: GPT-4.1 Nano
      comment: Fast, affordable model
      capabilities:
        - generate
        - tool_use
        - structured_output
      class:
        - fast
      priority: 100
    max_tokens: 1047576
    output_tokens: 32768
    pricing:
      input: 0.1
      output: 0.4
    providers:
      - id: wippy.llm.openai:provider
        provider_model: gpt-4.1-nano
```

### Инициализация и тестирование

```bash
wippy init
wippy run -x app:ask "What is the capital of France?"
```

Это вызывает функцию напрямую и выводит результат. Определение модели указывает модулю LLM, какой провайдер использовать и какое имя модели отправлять в API.

## Фаза 2: Диалоги

Переход от одиночного вызова к многоходовому диалогу с использованием построителя промптов. Запись меняется с функции на процесс с терминальным вводом-выводом.

### Обновление определений записей

Замените запись `ask` на процесс `chat` и добавьте зависимость терминала:

```yaml
  - name: dep.terminal
    kind: ns.dependency
    component: wippy/terminal
    version: "*"

  - name: chat
    kind: process.lua
    meta:
      command:
        name: chat
        short: Start a terminal chat
    source: file://chat.lua
    method: main
    modules:
      - io
      - process
    imports:
      llm: wippy.llm:llm
      prompt: wippy.llm:prompt
```

### Процесс чата

Создайте `src/chat.lua`:

```lua
local io = require("io")
local llm = require("llm")
local prompt = require("prompt")

local function main()
    io.print("Chat (type 'quit' to exit)")
    io.print("")

    local conversation = prompt.new()
    conversation:add_system("You are a helpful assistant. Be concise and direct.")

    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local response, err = llm.generate(conversation, {
            model = "gpt-4.1-nano",
            temperature = 0.7,
            max_tokens = 1024,
        })

        if err then
            io.print("Error: " .. tostring(err))
            goto continue
        end

        io.print(response.result)
        io.print("")
        conversation:add_assistant(response.result)

        ::continue::
    end

    io.print("Bye!")
end

return { main = main }
```

### Запуск

```bash
wippy update
wippy run chat
```

Построитель промптов хранит полную историю диалога. На каждом ходе добавляются сообщение пользователя и ответ ассистента, обеспечивая модели контекст предыдущих обменов.

## Фаза 3: Фреймворк агентов

Модуль агентов предоставляет более высокоуровневую абстракцию над прямыми вызовами LLM. Агенты определяются декларативно с промптом, моделью и инструментами, а затем загружаются и выполняются через паттерн контекст/раннер.

### Добавление зависимости агента

Добавьте в `_index.yaml`:

```yaml
  - name: dep.agent
    kind: ns.dependency
    component: wippy/agent
    version: "*"
    parameters:
      - name: process_host
        value: app:processes
```

### Определение агента

Добавьте запись агента:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
      title: Assistant
      comment: Terminal chat agent
    prompt: |
      You are a helpful terminal assistant. Be concise and direct.
      Answer questions clearly. If you don't know something, say so.
      Do not use emoji in responses.
    model: gpt-4.1-nano
    max_tokens: 1024
    temperature: 0.7
```

### Обновление процесса чата

Переключаемся на фреймворк агентов. Обновите импорты записи:

```yaml
  - name: chat
    kind: process.lua
    meta:
      command:
        name: chat
        short: Start a terminal chat
    source: file://chat.lua
    method: main
    modules:
      - io
      - process
    imports:
      prompt: wippy.llm:prompt
      agent_context: wippy.agent:context
```

Обновите `src/chat.lua`:

```lua
local io = require("io")
local prompt = require("prompt")
local agent_context = require("agent_context")

local function main()
    io.print("Chat (type 'quit' to exit)")
    io.print("")

    local ctx = agent_context.new()
    local runner, err = ctx:load_agent("app:assistant")
    if err then
        io.print("Failed to load agent: " .. tostring(err))
        return
    end

    local conversation = prompt.new()

    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local response, gen_err = runner:step(conversation)
        if gen_err then
            io.print("Error: " .. tostring(gen_err))
            goto continue
        end

        io.print(response.result)
        io.print("")
        conversation:add_assistant(response.result)

        ::continue::
    end

    io.print("Bye!")
end

return { main = main }
```

Фреймворк агентов отделяет определение агента (промпт, модель, параметры) от логики выполнения. Один и тот же агент может загружаться с разными контекстами, инструментами и моделями во время выполнения.

## Фаза 4: Потоковая передача

Передача ответов токен за токеном вместо ожидания полного ответа.

### Обновление модулей

Добавьте `channel` к модулям процесса:

```yaml
    modules:
      - io
      - process
      - channel
```

### Реализация потоковой передачи

Обновите `src/chat.lua`:

```lua
local io = require("io")
local prompt = require("prompt")
local agent_context = require("agent_context")

local STREAM_TOPIC = "stream"

local function stream_response(runner, conversation, stream_ch)
    local done_ch = channel.new(1)

    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = STREAM_TOPIC,
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
            local r = result.value
            return full_text, r.response, r.err
        end

        local chunk = result.value
        if chunk.type == "chunk" then
            io.write(chunk.content or "")
            full_text = full_text .. (chunk.content or "")
        elseif chunk.type == "done" then
            local r, ok = done_ch:receive()
            if ok and r then
                return full_text, r.response, r.err
            end
            return full_text, nil, nil
        elseif chunk.type == "error" then
            return nil, nil, chunk.error and chunk.error.message or "stream error"
        end
    end

    return full_text, nil, nil
end

local function main()
    io.print("Chat (type 'quit' to exit)")
    io.print("")

    local ctx = agent_context.new()
    local runner, err = ctx:load_agent("app:assistant")
    if err then
        io.print("Failed to load agent: " .. tostring(err))
        return
    end

    local conversation = prompt.new()
    local stream_ch = process.listen(STREAM_TOPIC)

    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local text, _, gen_err = stream_response(runner, conversation, stream_ch)
        if gen_err then
            io.print("Error: " .. tostring(gen_err))
            goto continue
        end

        io.print("")
        if text and text ~= "" then
            conversation:add_assistant(text)
        end

        ::continue::
    end

    process.unlisten(stream_ch)
    io.print("Bye!")
end

return { main = main }
```

Ключевые паттерны:
- `coroutine.spawn` запускает `runner:step()` в отдельной корутине, чтобы основная корутина могла обрабатывать чанки потока
- `channel.select` мультиплексирует канал потока и канал завершения
- Один `process.listen()` создаётся один раз и переиспользуется между ходами
- Текст накапливается для добавления в историю диалога

## Фаза 5: Инструменты

Предоставьте агенту инструменты, которые он может вызывать для доступа к внешним возможностям.

### Определение инструментов

Создайте `src/tools/_index.yaml`:

```yaml
version: "1.0"
namespace: app.tools

entries:
  - name: current_time
    kind: function.lua
    meta:
      type: tool
      title: Current Time
      input_schema: |
        { "type": "object", "properties": {}, "additionalProperties": false }
      llm_alias: get_current_time
      llm_description: Get the current date and time in UTC.
    source: file://current_time.lua
    modules: [time]
    method: handler

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
      llm_description: Evaluate a mathematical expression and return the result.
    source: file://calculate.lua
    modules: [expr]
    method: handler
```

Метаданные инструмента сообщают LLM, что делает инструмент:
- `input_schema` -- JSON Schema, определяющая аргументы
- `llm_alias` -- имя функции, видимое для LLM
- `llm_description` -- описание, когда использовать инструмент

### Реализация инструментов

Создайте `src/tools/current_time.lua`:

```lua
local time = require("time")

local function handler()
    local now = time.now()
    return {
        utc = now:format("2006-01-02T15:04:05Z"),
        unix = now:unix(),
    }
end

return { handler = handler }
```

Создайте `src/tools/calculate.lua`:

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

### Регистрация инструментов в агенте

Обновите запись агента в `src/_index.yaml`, добавив ссылки на инструменты:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
      title: Assistant
      comment: Terminal chat agent
    prompt: |
      You are a helpful terminal assistant. Be concise and direct.
      Answer questions clearly. If you don't know something, say so.
      Use tools when they help answer the question.
      Do not use emoji in responses.
    model: gpt-4.1-nano
    max_tokens: 1024
    temperature: 0.7
    tools:
      - app.tools:current_time
      - app.tools:calculate
```

### Добавление выполнения инструментов

Обновите модули процесса чата, добавив `json` и `funcs`:

```yaml
    modules:
      - io
      - json
      - process
      - channel
      - funcs
```

Обновите `src/chat.lua` с выполнением инструментов:

```lua
local io = require("io")
local json = require("json")
local funcs = require("funcs")
local prompt = require("prompt")
local agent_context = require("agent_context")

local STREAM_TOPIC = "stream"

local function stream_response(runner, conversation, stream_ch)
    local done_ch = channel.new(1)

    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = STREAM_TOPIC,
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
            local r = result.value
            return full_text, r.response, r.err
        end

        local chunk = result.value
        if chunk.type == "chunk" then
            io.write(chunk.content or "")
            full_text = full_text .. (chunk.content or "")
        elseif chunk.type == "done" then
            local r, ok = done_ch:receive()
            if ok and r then
                return full_text, r.response, r.err
            end
            return full_text, nil, nil
        elseif chunk.type == "error" then
            return nil, nil, chunk.error and chunk.error.message or "stream error"
        end
    end

    return full_text, nil, nil
end

local function execute_tools(tool_calls)
    local results = {}
    for _, tc in ipairs(tool_calls) do
        local args = tc.arguments
        if type(args) == "string" then
            args = json.decode(args) or {}
        end

        io.write("[" .. tc.name .. "] ")
        io.flush()

        local result, err = funcs.call(tc.registry_id, args)
        if err then
            results[tc.id] = { error = tostring(err) }
            io.print("error")
        else
            results[tc.id] = result
            io.print("done")
        end
    end
    return results
end

local function run_turn(runner, conversation, stream_ch)
    while true do
        local text, response, err = stream_response(runner, conversation, stream_ch)
        if err then
            io.print("")
            return nil, err
        end

        if text and text ~= "" then
            io.print("")
        end

        local tool_calls = response and response.tool_calls
        if not tool_calls or #tool_calls == 0 then
            return text, nil
        end

        if text and text ~= "" then
            conversation:add_assistant(text)
        end

        local results = execute_tools(tool_calls)

        for _, tc in ipairs(tool_calls) do
            local result = results[tc.id]
            local result_str = json.encode(result) or "{}"
            conversation:add_function_call(tc.name, tc.arguments, tc.id)
            conversation:add_function_result(tc.name, result_str, tc.id)
        end
    end
end

local function main()
    io.print("Terminal Agent (type 'quit' to exit)")
    io.print("")

    local ctx = agent_context.new()
    local runner, err = ctx:load_agent("app:assistant")
    if err then
        io.print("Failed to load agent: " .. tostring(err))
        return
    end

    local conversation = prompt.new()
    local stream_ch = process.listen(STREAM_TOPIC)

    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local text, gen_err = run_turn(runner, conversation, stream_ch)
        if gen_err then
            io.print("Error: " .. tostring(gen_err))
            goto continue
        end
        if text and text ~= "" then
            conversation:add_assistant(text)
        end

        ::continue::
    end

    process.unlisten(stream_ch)
    io.print("Bye!")
end

return { main = main }
```

Цикл выполнения инструментов:
1. Вызов `runner:step()` с потоковой передачей
2. Если ответ содержит `tool_calls`, выполнить каждый инструмент через `funcs.call()`
3. Добавить вызовы инструментов и результаты в диалог
4. Вернуться к шагу 1, чтобы агент обработал результаты
5. Когда вызовов инструментов больше нет, вернуть финальный текст

### Запуск агента

```bash
wippy update
wippy run chat
```

```
Terminal Agent (type 'quit' to exit)

> what time is it?
[get_current_time] done
The current time is 17:20 UTC on February 12, 2026.

> what is 125 * 16?
[calculate] done
125 * 16 = 2000.

> quit
Bye!
```

## Дальнейшие шаги

- [Модуль LLM](../framework/llm.md) - Полный справочник API LLM
- [Модуль агентов](../framework/agents.md) - Справочник фреймворка агентов
- [CLI-приложения](cli.md) - Паттерны терминального ввода-вывода
- [Процессы](processes.md) - Модель процессов и взаимодействие
