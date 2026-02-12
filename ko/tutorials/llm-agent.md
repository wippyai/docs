# LLM 에이전트

간단한 LLM 호출부터 도구를 갖춘 스트리밍 에이전트까지, 단계별로 터미널 채팅 에이전트를 구축합니다.

## 구축 목표

다음 기능을 갖춘 터미널 채팅 에이전트:
- LLM을 사용한 텍스트 생성
- 다중 턴 대화 유지
- 실시간 응답 스트리밍
- 외부 기능에 접근하는 도구 사용

## 프로젝트 구조

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

## 1단계: 간단한 생성

문자열 프롬프트로 `llm.generate()`를 호출하는 기본 함수부터 시작합니다.

### 프로젝트 생성

```bash
mkdir llm-agent && cd llm-agent
mkdir -p src
```

### 엔트리 정의

`src/_index.yaml`을 생성합니다:

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

LLM 모듈에는 두 가지 인프라 엔트리가 필요합니다:
- `env.storage.os`는 환경 변수에서 API 키를 제공합니다
- `process.host`는 LLM 모듈이 내부적으로 사용하는 프로세스 런타임을 제공합니다

### 생성 코드

`src/ask.lua`를 생성합니다:

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

### 모델 정의

LLM 모듈은 레지스트리에서 모델을 해석합니다. `_index.yaml`에 모델 엔트리를 추가합니다:

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

### 초기화 및 테스트

```bash
wippy init
wippy run -x app:ask "What is the capital of France?"
```

함수를 직접 호출하고 결과를 출력합니다. 모델 정의는 LLM 모듈에 어떤 제공자를 사용하고 API에 어떤 모델 이름을 전송할지 알려줍니다.

## 2단계: 대화

단일 호출에서 프롬프트 빌더를 사용한 다중 턴 대화로 업그레이드합니다. 엔트리를 함수에서 터미널 I/O를 갖춘 프로세스로 변경합니다.

### 엔트리 정의 업데이트

`ask` 엔트리를 `chat` 프로세스로 교체하고 터미널 의존성을 추가합니다:

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

### 채팅 프로세스

`src/chat.lua`를 생성합니다:

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

### 실행

```bash
wippy update
wippy run chat
```

프롬프트 빌더는 전체 대화 이력을 유지합니다. 각 턴에서 사용자 메시지와 어시스턴트 응답이 추가되어, 모델에 이전 교환의 컨텍스트를 제공합니다.

## 3단계: 에이전트 프레임워크

에이전트 모듈은 원시 LLM 호출에 대한 상위 수준의 추상화를 제공합니다. 에이전트는 프롬프트, 모델, 도구와 함께 선언적으로 정의된 후, 컨텍스트/러너 패턴을 통해 로드되고 실행됩니다.

### 에이전트 의존성 추가

`_index.yaml`에 추가합니다:

```yaml
  - name: dep.agent
    kind: ns.dependency
    component: wippy/agent
    version: "*"
    parameters:
      - name: process_host
        value: app:processes
```

### 에이전트 정의

에이전트 엔트리를 추가합니다:

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

### 채팅 프로세스 업데이트

에이전트 프레임워크로 전환합니다. 엔트리 임포트를 업데이트합니다:

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

`src/chat.lua`를 업데이트합니다:

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

에이전트 프레임워크는 에이전트 정의(프롬프트, 모델, 파라미터)와 실행 로직을 분리합니다. 동일한 에이전트를 런타임에 다른 컨텍스트, 도구, 모델로 로드할 수 있습니다.

## 4단계: 스트리밍

전체 응답을 기다리는 대신 토큰 단위로 응답을 스트리밍합니다.

### 모듈 업데이트

프로세스 모듈에 `channel`을 추가합니다:

```yaml
    modules:
      - io
      - process
      - channel
```

### 스트리밍 구현

`src/chat.lua`를 업데이트합니다:

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

핵심 패턴:
- `coroutine.spawn`은 `runner:step()`을 별도의 코루틴에서 실행하여 메인 코루틴이 스트림 청크를 처리할 수 있게 합니다
- `channel.select`는 스트림 채널과 완료 채널을 멀티플렉싱합니다
- 단일 `process.listen()`이 한 번 생성되어 턴 간에 재사용됩니다
- 대화 이력에 추가하기 위해 텍스트가 누적됩니다

## 5단계: 도구

에이전트에 외부 기능에 접근할 수 있는 도구를 제공합니다.

### 도구 정의

`src/tools/_index.yaml`을 생성합니다:

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

도구 메타데이터는 LLM에 도구의 역할을 알려줍니다:
- `input_schema`는 인자를 정의하는 JSON Schema입니다
- `llm_alias`는 LLM이 보는 함수 이름입니다
- `llm_description`은 도구를 언제 사용해야 하는지 설명합니다

### 도구 구현

`src/tools/current_time.lua`를 생성합니다:

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

`src/tools/calculate.lua`를 생성합니다:

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

### 에이전트에 도구 등록

`src/_index.yaml`의 에이전트 엔트리를 업데이트하여 도구를 참조합니다:

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

### 도구 실행 추가

채팅 프로세스 모듈을 업데이트하여 `json`과 `funcs`를 포함합니다:

```yaml
    modules:
      - io
      - json
      - process
      - channel
      - funcs
```

`src/chat.lua`를 도구 실행으로 업데이트합니다:

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

도구 실행 루프:
1. 스트리밍으로 `runner:step()`을 호출합니다
2. 응답에 `tool_calls`가 포함되어 있으면 `funcs.call()`로 각 도구를 실행합니다
3. 도구 호출과 결과를 대화에 추가합니다
4. 에이전트가 결과를 반영할 수 있도록 1단계로 돌아갑니다
5. 더 이상 도구 호출이 없으면 최종 텍스트를 반환합니다

### 에이전트 실행

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

## 다음 단계

- [LLM 모듈](../framework/llm.md) - 전체 LLM API 레퍼런스
- [에이전트 모듈](../framework/agents.md) - 에이전트 프레임워크 레퍼런스
- [CLI 애플리케이션](cli.md) - 터미널 I/O 패턴
- [프로세스](processes.md) - 프로세스 모델과 통신
