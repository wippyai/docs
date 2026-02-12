# LLM

`wippy/llm` 모듈은 여러 제공자(OpenAI, Anthropic, Google, 로컬 모델)의 대규모 언어 모델과 작업하기 위한 통합 인터페이스를 제공합니다. 텍스트 생성, 도구 호출, 구조화된 출력, 임베딩, 스트리밍을 지원합니다.

## 설정

프로젝트에 모듈을 추가합니다:

```bash
wippy add wippy/llm
wippy install
```

`_index.yaml`에 의존성을 선언합니다. LLM 모듈은 환경 저장소(API 키용)와 프로세스 호스트가 필요합니다:

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

`env.storage.os` 엔트리는 OS 환경 변수를 LLM 제공자에게 노출합니다. API 키를 환경 변수로 설정하세요 (예: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).

## 텍스트 생성

엔트리에 `llm` 라이브러리를 임포트하고 `generate()`를 호출합니다:

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

`generate()`의 첫 번째 인자는 문자열 프롬프트, 프롬프트 빌더, 또는 메시지 테이블이 될 수 있습니다. 두 번째 인자는 옵션 테이블입니다.

### 생성 옵션

| 옵션 | 타입 | 설명 |
|--------|------|-------------|
| `model` | string | 모델 이름 또는 클래스 (필수) |
| `temperature` | number | 무작위성 제어, 0-1 |
| `max_tokens` | number | 생성할 최대 토큰 수 |
| `top_p` | number | 핵 샘플링 파라미터 |
| `top_k` | number | Top-k 필터링 |
| `thinking_effort` | number | 사고 깊이 0-100 (사고 기능이 있는 모델) |
| `tools` | table | 도구 정의 배열 |
| `tool_choice` | string | `"auto"`, `"none"`, `"any"`, 또는 도구 이름 |
| `stream` | table | 스트리밍 설정: `{ reply_to, topic, buffer_size }` |
| `timeout` | number | 요청 타임아웃(초 단위, 기본값 600) |

### 응답 구조

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `result` | string | 생성된 텍스트 콘텐츠 |
| `tokens` | table | 토큰 사용량: `prompt_tokens`, `completion_tokens`, `thinking_tokens`, `total_tokens` |
| `finish_reason` | string | 생성이 중지된 이유: `"stop"`, `"length"`, `"tool_call"` |
| `tool_calls` | table? | 도구 호출 배열 (모델이 도구를 호출한 경우) |
| `metadata` | table | 제공자별 메타데이터 |
| `usage_record` | table? | 사용량 추적 레코드 |

## 프롬프트 빌더

다중 턴 대화 및 복잡한 프롬프트의 경우 프롬프트 빌더를 사용합니다:

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

### 빌더 메서드

| 메서드 | 설명 |
|--------|-------------|
| `prompt.new()` | 빈 빌더 생성 |
| `prompt.with_system(content)` | 시스템 메시지를 포함한 빌더 생성 |
| `:add_system(content, meta?)` | 시스템 메시지 추가 |
| `:add_user(content, meta?)` | 사용자 메시지 추가 |
| `:add_assistant(content, meta?)` | 어시스턴트 메시지 추가 |
| `:add_developer(content, meta?)` | 개발자 메시지 추가 |
| `:add_message(role, content_parts, name?, meta?)` | 역할과 콘텐츠 파트를 지정하여 메시지 추가 |
| `:add_function_call(name, args, id?)` | 어시스턴트의 도구 호출 추가 |
| `:add_function_result(name, result, id?)` | 도구 실행 결과 추가 |
| `:add_cache_marker(id?)` | 캐시 경계 표시 (Claude 모델) |
| `:get_messages()` | 메시지 배열 가져오기 |
| `:build()` | `llm.generate()`용 `{ messages = ... }` 테이블 가져오기 |
| `:clone()` | 빌더 딥 카피 |
| `:clear()` | 모든 메시지 제거 |

모든 `add_*` 메서드는 체이닝을 위해 빌더를 반환합니다.

### 다중 턴 대화

메시지를 추가하여 턴 간의 컨텍스트를 구축합니다:

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

### 멀티모달 콘텐츠

단일 메시지에서 텍스트와 이미지를 결합합니다:

```lua
local conversation = prompt.new()
conversation:add_message(prompt.ROLE.USER, {
    prompt.text("What's in this image?"),
    prompt.image("https://example.com/photo.jpg")
})
```

| 함수 | 설명 |
|----------|-------------|
| `prompt.text(content)` | 텍스트 콘텐츠 파트 |
| `prompt.image(url, mime_type?)` | URL에서 이미지 로드 |
| `prompt.image_base64(mime_type, data)` | Base64 인코딩 이미지 |

### 역할 상수

| 상수 | 값 |
|----------|-------|
| `prompt.ROLE.SYSTEM` | `"system"` |
| `prompt.ROLE.USER` | `"user"` |
| `prompt.ROLE.ASSISTANT` | `"assistant"` |
| `prompt.ROLE.DEVELOPER` | `"developer"` |
| `prompt.ROLE.FUNCTION_CALL` | `"function_call"` |
| `prompt.ROLE.FUNCTION_RESULT` | `"function_result"` |

### 복제

원본을 수정하지 않고 변형을 생성하려면 빌더를 복제합니다:

```lua
local base = prompt.new()
base:add_system("You are a helpful assistant.")

local conv1 = base:clone()
conv1:add_user("What is AI?")

local conv2 = base:clone()
conv2:add_user("What is ML?")
```

## 스트리밍

프로세스 통신을 사용하여 응답을 실시간으로 스트리밍합니다. `process.lua` 엔트리가 필요합니다:

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

### 청크 타입

| 타입 | 필드 | 설명 |
|------|--------|-------------|
| `"chunk"` | `content` | 텍스트 콘텐츠 조각 |
| `"thinking"` | `content` | 모델 사고 과정 |
| `"tool_call"` | `name`, `arguments`, `id` | 도구 호출 |
| `"error"` | `error.message`, `error.type` | 스트림 오류 |
| `"done"` | `meta` | 스트림 완료 |

<note>
스트리밍은 Wippy의 프로세스 통신 시스템(<code>process.pid()</code>, <code>process.listen()</code>)을 사용하므로 <code>process.lua</code> 엔트리가 필요합니다.
</note>

## 도구 호출

인라인 스키마로 도구를 정의하고 `generate()`에 전달합니다:

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

### 도구 호출 필드

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `id` | string | 고유 호출 식별자 |
| `name` | string | 도구 이름 |
| `arguments` | table | 스키마에 맞게 파싱된 인자 |

### 도구 선택

| 값 | 동작 |
|-------|----------|
| `"auto"` | 모델이 도구 사용 여부를 결정합니다 (기본값) |
| `"none"` | 도구를 사용하지 않습니다 |
| `"any"` | 최소 하나의 도구를 사용해야 합니다 |
| `"tool_name"` | 지정된 도구를 사용해야 합니다 |

## 구조화된 출력

스키마에 맞는 검증된 JSON을 생성합니다:

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
OpenAI 모델의 경우, 모든 속성이 <code>required</code> 배열에 포함되어야 합니다. 선택적 필드에는 유니온 타입을 사용합니다: <code>type = {"string", "null"}</code>. <code>additionalProperties = false</code>를 설정하세요.
</tip>

## 모델 설정

모델은 `meta.type: llm.model`을 가진 레지스트리 엔트리로 정의됩니다:

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

### 모델 엔트리 필드

| 필드 | 설명 |
|-------|-------------|
| `meta.name` | API 호출에 사용되는 모델 식별자 |
| `meta.type` | `llm.model`이어야 합니다 |
| `meta.capabilities` | 기능 목록: `generate`, `tool_use`, `structured_output`, `embed`, `thinking`, `vision`, `caching` |
| `meta.class` | 클래스 소속: `fast`, `balanced`, `reasoning` 등 |
| `meta.priority` | 클래스 기반 해석을 위한 숫자 우선순위 (높을수록 우선) |
| `max_tokens` | 최대 컨텍스트 윈도우 |
| `output_tokens` | 최대 출력 토큰 수 |
| `pricing` | 백만 토큰당 비용: `input`, `output` |
| `providers` | `id` (제공자 엔트리)와 `provider_model` (제공자별 모델 이름)을 포함하는 배열 |

### 로컬 모델

로컬에서 호스팅되는 모델(LM Studio, Ollama)의 경우, 사용자 정의 `base_url`을 가진 별도의 제공자 엔트리를 정의합니다:

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

## 모델 해석

모델은 정확한 이름, 클래스, 또는 명시적 클래스 접두사로 참조할 수 있습니다:

```lua
-- exact model name
llm.generate("Hello", { model = "gpt-4o" })

-- model class (picks highest priority in that class)
llm.generate("Hello", { model = "fast" })

-- explicit class syntax
llm.generate("Hello", { model = "class:reasoning" })
```

해석 순서:
1. 정확한 `meta.name`으로 일치
2. 클래스 이름으로 일치 (가장 높은 `meta.priority` 우선)
3. `class:` 접두사가 있으면 해당 클래스 내에서만 검색

## 모델 탐색

런타임에 사용 가능한 모델과 그 기능을 조회합니다:

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

## 임베딩

시맨틱 검색을 위한 벡터 임베딩을 생성합니다:

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

## 오류 처리

오류는 두 번째 반환 값으로 반환됩니다. 오류 발생 시 첫 번째 반환 값은 `nil`입니다:

```lua
local response, err = llm.generate("Hello", { model = "gpt-4o" })

if err then
    io.print("Error: " .. tostring(err))
    return
end

io.print(response.result)
```

### 오류 타입

| 상수 | 설명 |
|----------|-------------|
| `llm.ERROR_TYPE.INVALID_REQUEST` | 잘못된 요청 형식 |
| `llm.ERROR_TYPE.AUTHENTICATION` | 유효하지 않은 API 키 |
| `llm.ERROR_TYPE.RATE_LIMIT` | 제공자 요청 제한 초과 |
| `llm.ERROR_TYPE.SERVER_ERROR` | 제공자 서버 오류 |
| `llm.ERROR_TYPE.CONTEXT_LENGTH` | 입력이 컨텍스트 윈도우를 초과 |
| `llm.ERROR_TYPE.CONTENT_FILTER` | 안전 시스템에 의해 콘텐츠 필터링됨 |
| `llm.ERROR_TYPE.TIMEOUT` | 요청 시간 초과 |
| `llm.ERROR_TYPE.MODEL_ERROR` | 유효하지 않거나 사용할 수 없는 모델 |

### 완료 이유

| 상수 | 설명 |
|----------|-------------|
| `llm.FINISH_REASON.STOP` | 정상 완료 |
| `llm.FINISH_REASON.LENGTH` | 최대 토큰 수 도달 |
| `llm.FINISH_REASON.CONTENT_FILTER` | 콘텐츠 필터링됨 |
| `llm.FINISH_REASON.TOOL_CALL` | 모델이 도구를 호출함 |
| `llm.FINISH_REASON.ERROR` | 생성 중 오류 발생 |

## 기능

| 상수 | 설명 |
|----------|-------------|
| `llm.CAPABILITY.GENERATE` | 텍스트 생성 |
| `llm.CAPABILITY.TOOL_USE` | 도구/함수 호출 |
| `llm.CAPABILITY.STRUCTURED_OUTPUT` | JSON 구조화된 출력 |
| `llm.CAPABILITY.EMBED` | 벡터 임베딩 |
| `llm.CAPABILITY.THINKING` | 확장된 사고 |
| `llm.CAPABILITY.VISION` | 이미지 이해 |
| `llm.CAPABILITY.CACHING` | 프롬프트 캐싱 |

## 참고 항목

- [에이전트](agents.md) - 도구, 위임, 메모리를 갖춘 에이전트 프레임워크
- [LLM 에이전트 만들기](../tutorials/llm-agent.md) - 단계별 튜토리얼
- [프레임워크 개요](overview.md) - 프레임워크 모듈 사용법
