# LLM

Модуль `wippy/llm` предоставляет унифицированный интерфейс для работы с большими языковыми моделями от различных провайдеров (OpenAI, Anthropic, Google, локальные модели). Поддерживается генерация текста, вызов инструментов, структурированный вывод, эмбеддинги и потоковая передача.

## Настройка

Добавьте модуль в проект:

```bash
wippy add wippy/llm
wippy install
```

Объявите зависимость в `_index.yaml`. Модуль LLM требует хранилище окружения (для API-ключей) и хост процессов:

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
```

Запись `env.storage.os` предоставляет переменные окружения ОС для провайдеров LLM. Установите API-ключи как переменные окружения (например, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).

## Генерация текста

Импортируйте библиотеку `llm` в запись и вызовите `generate()`:

```yaml
entries:
  - name: ask
    kind: function.lua
    source: file://ask.lua
    method: handler
    imports:
      llm: wippy.llm:llm
```

```lua
local llm = require("llm")

local function handler()
    local response, err = llm.generate("What are the three laws of robotics?", {
        model = "gpt-4o"
    })

    if err then
        return nil, err
    end

    return response.result
end

return { handler = handler }
```

Первый аргумент `generate()` может быть строковым промптом, построителем промптов или таблицей сообщений. Второй аргумент -- таблица параметров.

### Параметры генерации

| Параметр | Тип | Описание |
|----------|-----|----------|
| `model` | string | Имя модели или класс (обязательный) |
| `temperature` | number | Контроль случайности, 0-1 |
| `max_tokens` | number | Максимальное количество токенов для генерации |
| `top_p` | number | Параметр nucleus-сэмплирования |
| `top_k` | number | Фильтрация top-k |
| `thinking_effort` | number | Глубина размышления 0-100 (модели с возможностью размышления) |
| `tools` | table | Массив определений инструментов |
| `tool_choice` | string | `"auto"`, `"none"`, `"any"` или имя инструмента |
| `stream` | table | Конфигурация потоковой передачи: `{ reply_to, topic, buffer_size }` |
| `timeout` | number | Таймаут запроса в секундах (по умолчанию 600) |

### Структура ответа

| Поле | Тип | Описание |
|------|-----|----------|
| `result` | string | Сгенерированный текстовый контент |
| `tokens` | table | Использование токенов: `prompt_tokens`, `completion_tokens`, `thinking_tokens`, `total_tokens` |
| `finish_reason` | string | Причина остановки генерации: `"stop"`, `"length"`, `"tool_call"` |
| `tool_calls` | table? | Массив вызовов инструментов (если модель использовала инструменты) |
| `metadata` | table | Метаданные, специфичные для провайдера |
| `usage_record` | table? | Запись об использовании |

## Построитель промптов

Для многоходовых диалогов и сложных промптов используйте построитель промптов:

```yaml
imports:
  llm: wippy.llm:llm
  prompt: wippy.llm:prompt
```

```lua
local llm = require("llm")
local prompt = require("prompt")

local conversation = prompt.new()
conversation:add_system("You are a helpful assistant.")
conversation:add_user("What is the capital of France?")

local response, err = llm.generate(conversation, {
    model = "gpt-4o",
    temperature = 0.7,
    max_tokens = 500
})
```

### Методы построителя

| Метод | Описание |
|-------|----------|
| `prompt.new()` | Создать пустой построитель |
| `prompt.with_system(content)` | Создать построитель с системным сообщением |
| `:add_system(content, meta?)` | Добавить системное сообщение |
| `:add_user(content, meta?)` | Добавить сообщение пользователя |
| `:add_assistant(content, meta?)` | Добавить сообщение ассистента |
| `:add_developer(content, meta?)` | Добавить сообщение разработчика |
| `:add_message(role, content_parts, name?, meta?)` | Добавить сообщение с ролью и частями контента |
| `:add_function_call(name, args, id?)` | Добавить вызов инструмента от ассистента |
| `:add_function_result(name, result, id?)` | Добавить результат выполнения инструмента |
| `:add_cache_marker(id?)` | Отметить границу кэша (модели Claude) |
| `:get_messages()` | Получить массив сообщений |
| `:build()` | Получить таблицу `{ messages = ... }` для `llm.generate()` |
| `:clone()` | Глубокая копия построителя |
| `:clear()` | Удалить все сообщения |

Все методы `add_*` возвращают построитель для цепочечного вызова.

### Многоходовые диалоги

Накапливайте контекст между ходами, добавляя сообщения:

```lua
local conversation = prompt.new()
conversation:add_system("You are a helpful assistant.")

-- first turn
conversation:add_user("What is Lua?")
local r1 = llm.generate(conversation, { model = "gpt-4o" })
conversation:add_assistant(r1.result)

-- second turn with full context
conversation:add_user("What makes it different from Python?")
local r2 = llm.generate(conversation, { model = "gpt-4o" })
```

### Мультимодальный контент

Объединяйте текст и изображения в одном сообщении:

```lua
local conversation = prompt.new()
conversation:add_message(prompt.ROLE.USER, {
    prompt.text("What's in this image?"),
    prompt.image("https://example.com/photo.jpg")
})
```

| Функция | Описание |
|---------|----------|
| `prompt.text(content)` | Текстовая часть контента |
| `prompt.image(url, mime_type?)` | Изображение по URL |
| `prompt.image_base64(mime_type, data)` | Изображение в кодировке Base64 |

### Константы ролей

| Константа | Значение |
|-----------|----------|
| `prompt.ROLE.SYSTEM` | `"system"` |
| `prompt.ROLE.USER` | `"user"` |
| `prompt.ROLE.ASSISTANT` | `"assistant"` |
| `prompt.ROLE.DEVELOPER` | `"developer"` |
| `prompt.ROLE.FUNCTION_CALL` | `"function_call"` |
| `prompt.ROLE.FUNCTION_RESULT` | `"function_result"` |

### Клонирование

Клонируйте построитель для создания вариаций без изменения оригинала:

```lua
local base = prompt.new()
base:add_system("You are a helpful assistant.")

local conv1 = base:clone()
conv1:add_user("What is AI?")

local conv2 = base:clone()
conv2:add_user("What is ML?")
```

## Потоковая передача

Передавайте ответы в реальном времени, используя систему межпроцессного взаимодействия. Для этого требуется запись типа `process.lua`:

```lua
local llm = require("llm")

local TOPIC = "llm_stream"

local function main()
    local stream_ch = process.listen(TOPIC)

    local response = llm.generate("Write a short story", {
        model = "gpt-4o",
        stream = {
            reply_to = process.pid(),
            topic = TOPIC,
        },
    })

    while true do
        local chunk, ok = stream_ch:receive()
        if not ok then break end

        if chunk.type == "chunk" then
            io.write(chunk.content)
        elseif chunk.type == "thinking" then
            io.write(chunk.content)
        elseif chunk.type == "error" then
            io.print("Error: " .. chunk.error.message)
            break
        elseif chunk.type == "done" then
            break
        end
    end

    process.unlisten(stream_ch)
end
```

### Типы чанков

| Тип | Поля | Описание |
|-----|------|----------|
| `"chunk"` | `content` | Фрагмент текстового контента |
| `"thinking"` | `content` | Процесс размышления модели |
| `"tool_call"` | `name`, `arguments`, `id` | Вызов инструмента |
| `"error"` | `error.message`, `error.type` | Ошибка потока |
| `"done"` | `meta` | Поток завершён |

<note>
Потоковая передача требует запись типа <code>process.lua</code>, так как использует систему межпроцессного взаимодействия Wippy (<code>process.pid()</code>, <code>process.listen()</code>).
</note>

## Вызов инструментов

Определите инструменты как встроенные схемы и передайте их в `generate()`:

```lua
local llm = require("llm")
local prompt = require("prompt")
local json = require("json")

local tools = {
    {
        name = "get_weather",
        description = "Get current weather for a location",
        schema = {
            type = "object",
            properties = {
                location = { type = "string", description = "City name" },
            },
            required = { "location" },
        },
    },
}

local conversation = prompt.new()
conversation:add_user("What's the weather in Tokyo?")

local response = llm.generate(conversation, {
    model = "gpt-4o",
    tools = tools,
    tool_choice = "auto",
})

if response.tool_calls and #response.tool_calls > 0 then
    for _, tc in ipairs(response.tool_calls) do
        -- execute the tool and get a result
        local result = { temperature = 22, condition = "sunny" }

        -- add the exchange to the conversation
        conversation:add_function_call(tc.name, tc.arguments, tc.id)
        conversation:add_function_result(tc.name, json.encode(result), tc.id)
    end

    -- continue generation with tool results
    local final = llm.generate(conversation, { model = "gpt-4o" })
    print(final.result)
end
```

### Поля вызова инструмента

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный идентификатор вызова |
| `name` | string | Имя инструмента |
| `arguments` | table | Разобранные аргументы, соответствующие схеме |

### Выбор инструмента

| Значение | Поведение |
|----------|-----------|
| `"auto"` | Модель решает, когда использовать инструменты (по умолчанию) |
| `"none"` | Никогда не использовать инструменты |
| `"any"` | Обязательно использовать хотя бы один инструмент |
| `"tool_name"` | Обязательно использовать указанный инструмент |

## Структурированный вывод

Генерация валидированного JSON, соответствующего схеме:

```lua
local llm = require("llm")

local schema = {
    type = "object",
    properties = {
        name = { type = "string" },
        age = { type = "number" },
        hobbies = {
            type = "array",
            items = { type = "string" },
        },
    },
    required = { "name", "age", "hobbies" },
    additionalProperties = false,
}

local response, err = llm.structured_output(schema, "Describe a fictional character", {
    model = "gpt-4o",
})

if not err then
    print(response.result.name)
    print(response.result.age)
end
```

<tip>
Для моделей OpenAI все свойства должны быть перечислены в массиве <code>required</code>. Для необязательных полей используйте union-типы: <code>type = {"string", "null"}</code>. Установите <code>additionalProperties = false</code>.
</tip>

## Конфигурация моделей

Модели определяются как записи реестра с `meta.type: llm.model`:

```yaml
entries:
  - name: gpt-4o
    kind: registry.entry
    meta:
      name: gpt-4o
      type: llm.model
      title: GPT-4o
      comment: OpenAI's flagship model
      capabilities:
        - generate
        - tool_use
        - structured_output
        - vision
      class:
        - balanced
      priority: 100
    max_tokens: 128000
    output_tokens: 16384
    pricing:
      input: 2.5
      output: 10
    providers:
      - id: wippy.llm.openai:provider
        provider_model: gpt-4o
```

### Поля записи модели

| Поле | Описание |
|------|----------|
| `meta.name` | Идентификатор модели, используемый в API-вызовах |
| `meta.type` | Должен быть `llm.model` |
| `meta.capabilities` | Список возможностей: `generate`, `tool_use`, `structured_output`, `embed`, `thinking`, `vision`, `caching` |
| `meta.class` | Принадлежность к классу: `fast`, `balanced`, `reasoning` и т.д. |
| `meta.priority` | Числовой приоритет для разрешения по классу (больше -- выше приоритет) |
| `max_tokens` | Максимальное контекстное окно |
| `output_tokens` | Максимальное количество выходных токенов |
| `pricing` | Стоимость за миллион токенов: `input`, `output` |
| `providers` | Массив с `id` (запись провайдера) и `provider_model` (имя модели у провайдера) |

### Локальные модели

Для локально размещённых моделей (LM Studio, Ollama) определите отдельную запись провайдера с пользовательским `base_url`:

```yaml
  - name: local_provider
    kind: registry.entry
    meta:
      name: ollama
      type: llm.provider
      title: Ollama Local
    driver:
      id: wippy.llm.openai:driver
      options:
        api_key_env: none
        base_url: http://127.0.0.1:11434/v1

  - name: local-llama
    kind: registry.entry
    meta:
      name: local-llama
      type: llm.model
      title: Local Llama
      capabilities:
        - generate
    max_tokens: 4096
    output_tokens: 4096
    pricing:
      input: 0
      output: 0
    providers:
      - id: app:local_provider
        provider_model: llama-3.2
```

## Разрешение моделей

На модели можно ссылаться по точному имени, классу или явному префиксу класса:

```lua
-- exact model name
llm.generate("Hello", { model = "gpt-4o" })

-- model class (picks highest priority in that class)
llm.generate("Hello", { model = "fast" })

-- explicit class syntax
llm.generate("Hello", { model = "class:reasoning" })
```

Порядок разрешения:
1. Совпадение по точному `meta.name`
2. Совпадение по имени класса (побеждает наивысший `meta.priority`)
3. С префиксом `class:` поиск только в указанном классе

## Обнаружение моделей

Запрашивайте доступные модели и их возможности во время выполнения:

```lua
local llm = require("llm")

-- all models
local models = llm.available_models()

-- filter by capability
local tool_models = llm.available_models("tool_use")
local embed_models = llm.available_models("embed")

-- list model classes
local classes = llm.get_classes()
for _, c in ipairs(classes) do
    print(c.name .. ": " .. c.title)
end
```

## Эмбеддинги

Генерация векторных эмбеддингов для семантического поиска:

```lua
local llm = require("llm")

-- single text
local response = llm.embed("The quick brown fox", {
    model = "text-embedding-3-small",
    dimensions = 512,
})
-- response.result is a float array

-- multiple texts
local response = llm.embed({
    "First document",
    "Second document",
}, { model = "text-embedding-3-small" })
-- response.result is an array of float arrays
```

## Обработка ошибок

Ошибки возвращаются как второе возвращаемое значение. При ошибке первое значение равно `nil`:

```lua
local response, err = llm.generate("Hello", { model = "gpt-4o" })

if err then
    io.print("Error: " .. tostring(err))
    return
end

io.print(response.result)
```

### Типы ошибок

| Константа | Описание |
|-----------|----------|
| `llm.ERROR_TYPE.INVALID_REQUEST` | Некорректный запрос |
| `llm.ERROR_TYPE.AUTHENTICATION` | Неверный API-ключ |
| `llm.ERROR_TYPE.RATE_LIMIT` | Превышен лимит запросов провайдера |
| `llm.ERROR_TYPE.SERVER_ERROR` | Серверная ошибка провайдера |
| `llm.ERROR_TYPE.CONTEXT_LENGTH` | Входные данные превышают контекстное окно |
| `llm.ERROR_TYPE.CONTENT_FILTER` | Контент отфильтрован системой безопасности |
| `llm.ERROR_TYPE.TIMEOUT` | Таймаут запроса |
| `llm.ERROR_TYPE.MODEL_ERROR` | Некорректная или недоступная модель |

### Причины завершения

| Константа | Описание |
|-----------|----------|
| `llm.FINISH_REASON.STOP` | Нормальное завершение |
| `llm.FINISH_REASON.LENGTH` | Достигнут лимит токенов |
| `llm.FINISH_REASON.CONTENT_FILTER` | Контент отфильтрован |
| `llm.FINISH_REASON.TOOL_CALL` | Модель выполнила вызов инструмента |
| `llm.FINISH_REASON.ERROR` | Ошибка при генерации |

## Возможности

| Константа | Описание |
|-----------|----------|
| `llm.CAPABILITY.GENERATE` | Генерация текста |
| `llm.CAPABILITY.TOOL_USE` | Вызов инструментов/функций |
| `llm.CAPABILITY.STRUCTURED_OUTPUT` | Структурированный вывод в формате JSON |
| `llm.CAPABILITY.EMBED` | Векторные эмбеддинги |
| `llm.CAPABILITY.THINKING` | Расширенное размышление |
| `llm.CAPABILITY.VISION` | Понимание изображений |
| `llm.CAPABILITY.CACHING` | Кэширование промптов |

## Смотрите также

- [Агенты](agents.md) - Фреймворк агентов с инструментами, делегатами и памятью
- [Создание LLM-агента](../tutorials/llm-agent.md) - Пошаговое руководство
- [Обзор фреймворка](overview.md) - Использование модулей фреймворка
