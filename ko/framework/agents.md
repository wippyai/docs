# 에이전트

`wippy/agent` 모듈은 도구 사용, 스트리밍, 위임, 트레이트, 메모리를 갖춘 AI 에이전트를 구축하기 위한 프레임워크를 제공합니다. 에이전트는 선언적으로 정의되며 컨텍스트/러너 패턴을 통해 실행됩니다.

## 설정

프로젝트에 모듈을 추가합니다:

```bash
wippy add wippy/agent
wippy install
```

에이전트 모듈은 `wippy/llm`과 프로세스 호스트가 필요합니다. 두 의존성을 모두 선언합니다:

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

## 에이전트 정의

에이전트는 `meta.type: agent.gen1`을 가진 레지스트리 엔트리입니다:

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

### 에이전트 필드

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `meta.type` | string | `agent.gen1`이어야 합니다 |
| `meta.name` | string | 에이전트 식별자 |
| `prompt` | string | 시스템 프롬프트 |
| `model` | string | 모델 이름 또는 클래스 |
| `max_tokens` | number | 최대 출력 토큰 수 |
| `temperature` | number | 무작위성 제어, 0-1 |
| `thinking_effort` | number | 사고 깊이 0-100 |
| `tools` | array | 도구 레지스트리 ID |
| `traits` | array | 트레이트 참조 |
| `delegates` | array | 위임 에이전트 참조 |
| `memory` | array | 정적 메모리 항목 (문자열) |
| `memory_contract` | table | 동적 메모리 설정 |

## 에이전트 컨텍스트

에이전트 컨텍스트는 주요 진입점입니다. 컨텍스트를 생성하고, 선택적으로 설정한 뒤, 에이전트를 로드합니다:

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

### 컨텍스트 메서드

| 메서드 | 설명 |
|--------|-------------|
| `agent_context.new(options?)` | 새 컨텍스트 생성 |
| `:add_tools(specs)` | 런타임에 도구 추가 |
| `:add_delegates(specs)` | 위임 에이전트 추가 |
| `:set_memory_contract(config)` | 동적 메모리 설정 |
| `:update_context(updates)` | 런타임 컨텍스트 업데이트 |
| `:load_agent(spec_or_id, options?)` | 에이전트를 로드하고 컴파일하여 러너 반환 |
| `:switch_to_agent(id, options?)` | 다른 에이전트로 전환, `(boolean, string?)` 반환 |
| `:switch_to_model(name)` | 현재 에이전트의 모델 변경, `(boolean, string?)` 반환 |
| `:get_current_agent()` | 현재 러너 가져오기 |

### 컨텍스트 옵션

```lua
local ctx = agent_context.new({
    context = { session_id = "abc", user_id = "u1" },
    delegate_tools = { enabled = true },
})
```

### 인라인 스펙으로 로드

레지스트리 엔트리 없이 에이전트를 로드합니다:

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

## 스텝 실행

러너는 단일 추론 스텝을 실행합니다. 대화가 담긴 프롬프트 빌더를 전달합니다:

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

### 스텝 옵션

```lua
local response, err = runner:step(conversation, {
    context = { session_id = "abc" },
    stream_target = { reply_to = process.pid(), topic = "stream" },
    tool_call = "auto",
})
```

| 옵션 | 타입 | 설명 |
|--------|------|-------------|
| `context` | table | 에이전트 컨텍스트와 병합되는 런타임 컨텍스트 |
| `stream_target` | table | 스트리밍: `{ reply_to, topic }` |
| `tool_call` | string | `"auto"`, `"required"`, `"none"` |

### 스텝 응답

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `result` | string | 생성된 텍스트 |
| `tokens` | table | 토큰 사용량 |
| `finish_reason` | string | 중지 이유 |
| `tool_calls` | table? | 실행할 도구 호출 |
| `delegate_calls` | table? | 위임 호출 |

### 러너 통계

```lua
local stats = runner:get_stats()
-- stats.id, stats.name, stats.total_tokens
```

## 도구 정의

도구는 `meta.type: tool`을 가진 `function.lua` 엔트리입니다. 별도의 `_index.yaml`에 정의합니다:

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

### 도구 메타데이터

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `meta.type` | string | `tool`이어야 합니다 |
| `meta.input_schema` | string/table | 도구 인자를 위한 JSON Schema |
| `meta.llm_alias` | string | LLM에 노출되는 이름 |
| `meta.llm_description` | string | LLM에 노출되는 설명 |
| `meta.exclusive` | boolean | true이면 동시 도구 호출을 취소합니다 |

### 에이전트에서 도구 참조

에이전트 정의에 도구 레지스트리 ID를 나열합니다:

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

도구는 사용자 정의 별칭과 컨텍스트를 지정하여 참조할 수도 있습니다:

```yaml
    tools:
      - id: app.tools:search
        alias: web_search
        context:
          api_key: "${SEARCH_API_KEY}"
```

## 도구 실행

에이전트 스텝이 `tool_calls`를 반환하면, 도구를 실행하고 결과를 다시 전달합니다:

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

### 도구 호출 필드

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `id` | string | 고유 호출 식별자 |
| `name` | string | 도구 이름 (별칭 또는 llm_alias) |
| `arguments` | table | 파싱된 인자 |
| `registry_id` | string | `funcs.call()`용 전체 레지스트리 ID |

<note>
<code>funcs.call(tc.registry_id, tc.arguments)</code>을 사용하여 도구를 실행합니다. <code>registry_id</code> 필드는 레지스트리의 도구 엔트리에 직접 매핑됩니다.
</note>

## 스트리밍

`stream_target`을 사용하여 에이전트 응답을 실시간으로 스트리밍합니다:

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

스트림은 직접 LLM 스트리밍과 동일한 청크 타입을 사용합니다: `"chunk"`, `"thinking"`, `"tool_call"`, `"error"`, `"done"`.

<tip>
<code>coroutine.spawn</code>을 사용하여 <code>runner:step()</code>을 별도의 코루틴에서 실행하면 스트림 청크를 동시에 수신할 수 있습니다. <code>channel.select</code>를 사용하여 스트림 채널과 완료 채널을 멀티플렉싱합니다.
</tip>

## 위임

에이전트는 다른 에이전트에게 위임할 수 있습니다. 위임 에이전트는 부모 에이전트에게 도구로 표시됩니다:

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

위임 호출은 `response.delegate_calls`에 나타납니다:

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

위임 에이전트는 런타임에도 추가할 수 있습니다:

```lua
ctx:add_delegates({
    { id = "app:specialist", name = "ask_specialist", rule = "for domain questions" },
})
```

## 트레이트

트레이트는 에이전트에 프롬프트, 도구, 동작을 제공하는 재사용 가능한 기능입니다:

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

### 내장 트레이트

| 트레이트 | 설명 |
|-------|-------------|
| `time_aware` | 현재 날짜와 시간을 프롬프트에 주입합니다 |

`time_aware` 트레이트는 컨텍스트 옵션을 받습니다:

```yaml
    traits:
      - id: time_aware
        context:
          timezone: America/New_York
          time_interval: 15
```

### 사용자 정의 트레이트

트레이트는 `meta.type: agent.trait`을 가진 레지스트리 엔트리입니다. 다음을 제공할 수 있습니다:
- **prompt** - 시스템 프롬프트에 추가되는 정적 텍스트
- **build_func_id** - 컴파일 시 도구, 프롬프트, 위임을 제공하기 위해 호출되는 함수
- **prompt_func_id** - 각 스텝에서 동적 콘텐츠를 주입하기 위해 호출되는 함수
- **step_func_id** - 각 스텝에서 부수 효과를 위해 호출되는 함수

## 메모리

### 정적 메모리

시스템 프롬프트에 추가되는 간단한 메모리 항목입니다:

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

### 동적 메모리 컨트랙트

외부 소스에서 동적 메모리 회상을 설정합니다:

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

메모리 컨트랙트는 `runner:step()` 실행 중에 대화 컨텍스트를 기반으로 관련 항목을 회상하기 위해 호출됩니다. 결과는 개발자 메시지로 주입됩니다.

| 옵션 | 설명 |
|--------|-------------|
| `max_items` | 회상당 최대 메모리 항목 수 |
| `max_length` | 최대 총 문자 수 |
| `recall_cooldown` | 회상 사이의 최소 스텝 수 |
| `min_conversation_length` | 첫 회상 전 최소 대화 턴 수 |

## 리졸버 컨트랙트

`load_agent()`가 문자열 식별자를 받으면, 먼저 `wippy.agent:resolver` 컨트랙트를 통해 해석을 시도합니다. 리졸버가 바인딩되지 않았거나 리졸버가 nil을 반환하면, 레지스트리 조회로 대체됩니다.

이를 통해 애플리케이션은 데이터베이스에서 에이전트 정의를 로드하는 등의 사용자 정의 에이전트 해석을 구현할 수 있습니다.

### 리졸버 바인딩

리졸버 함수를 정의하고 컨트랙트에 바인딩합니다:

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

### 리졸버 구현

리졸버는 `{ agent_id = "..." }`를 받고 에이전트 스펙 테이블 또는 nil을 반환합니다:

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

### 해석 순서

1. `wippy.agent:resolver` 컨트랙트 시도 (바인딩된 경우)
2. ID로 레지스트리 조회 시도
3. 이름으로 레지스트리 조회 시도
4. 찾지 못하면 오류 반환

이 패턴은 에이전트가 사용자별 또는 워크스페이스별로 설정되어 프레임워크 레지스트리 외부에 저장되는 멀티 테넌트 애플리케이션을 가능하게 합니다.

## 참고 항목

- [LLM](llm.md) - 기반 LLM 모듈
- [LLM 에이전트 만들기](../tutorials/llm-agent.md) - 단계별 튜토리얼
- [프레임워크 개요](overview.md) - 프레임워크 모듈 사용법
