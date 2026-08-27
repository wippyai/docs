---
title: "LLM 에이전트"
description: "간단한 LLM 호출에서 도구를 사용하는 스트리밍 에이전트까지 터미널 채팅 에이전트를 단계별로 만듭니다."
---

# LLM 에이전트

단일 LLM 호출에서 스트리밍 응답과 도구 실행까지, 다섯 단계로 터미널 채팅 에이전트를 만듭니다.

**분류: 외부 제공자를 사용하는 실행 가능한 튜토리얼.** 각 단계는 같은 프로젝트에 누적되는 편집이며 다음 단계로 넘어가기 전에 실행할 수 있습니다. Wippy 계약과 로컬 제어 흐름은 자격 증명 없이 테스트할 수 있지만 생성에는 네트워크 접근과 유효한 `OPENAI_API_KEY`가 필요합니다.

## 만들 기능

다음 기능을 갖는 터미널 채팅 에이전트를 만듭니다.

- LLM으로 텍스트를 생성합니다.
- 여러 턴의 대화를 유지합니다.
- 응답을 점진적으로 스트리밍합니다.
- 등록된 도구를 호출합니다.

## 프로젝트 구조

```
llm-agent/
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

소스 디렉터리가 `./src`인 Wippy 프로젝트에서 시작합니다. Wippy를 시작하는 환경에 `OPENAI_API_KEY`를 설정하세요. 이 튜토리얼은 모델을 명시적으로 선언하므로 다른 애플리케이션에서 같은 모델 이름의 두 번째 엔트리를 복사하지 마세요.

### 엔트리 정의

`src/_index.yaml`을 만듭니다.

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

  - name: dep.security
    kind: ns.dependency
    component: wippy/security
    version: "*"

  - name: dep.terminal
    kind: ns.dependency
    component: wippy/terminal
    version: "*"

  - name: ask
    kind: process.lua
    meta:
      command:
        name: ask
        short: Ask one question
    source: file://ask.lua
    method: main
    modules:
      - io
    imports:
      llm: wippy.llm:llm
```

LLM 모듈에는 두 인프라 엔트리가 필요합니다.

- `env.storage.os`는 환경 변수에서 API 키를 제공합니다.
- `process.host`는 LLM 모듈이 내부적으로 사용하는 프로세스 런타임을 제공합니다.

### 생성 코드

`src/ask.lua`를 만듭니다.

```lua
local io = require("io")
local llm = require("llm")

local function main()
    io.write("Question: ")
    io.flush()
    local question = io.readline()
    if not question or question == "" then
        io.print("A question is required")
        return 1
    end

    local response, err = llm.generate(question, {
        model = "gpt-4o-mini",
        temperature = 0.7,
        max_tokens = 512,
    })

    if err then
        io.print("Error: " .. tostring(err))
        return 1
    end

    io.print(response.result)
    return 0
end

return { main = main }
```

### 모델 정의

LLM 모듈은 레지스트리에서 모델을 해석합니다. `_index.yaml`에 모델 엔트리를 추가합니다.

```yaml
  - name: gpt-4o-mini
    kind: registry.entry
    meta:
      name: gpt-4o-mini
      type: llm.model
      title: GPT-4o mini
      comment: Fast, affordable model
      capabilities:
        - generate
        - tool_use
        - structured_output
      class:
        - fast
      priority: 100
    max_tokens: 128000
    output_tokens: 16384
    pricing:
      input: 0.15
      output: 0.6
    providers:
      - id: wippy.llm.openai:provider
        provider_model: gpt-4o-mini
```

### 초기화 및 테스트

```bash
wippy init
wippy update
wippy install
wippy run ask
```

프롬프트에 `What is the capital of France?`를 입력합니다. 모델 정의가 제공자와 해당 API로 보낼 모델 이름을 선택합니다.

## 2단계: 대화

프롬프트 빌더를 사용해 단일 호출에서 여러 턴의 대화로 확장합니다. 엔트리를 함수에서 터미널 I/O를 사용하는 프로세스로 바꿉니다.

### 엔트리 정의 업데이트

`ask` 엔트리를 `chat` 프로세스로 교체합니다. 1단계의 `dep.terminal` 엔트리는 유지하세요.

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
    imports:
      llm: wippy.llm:llm
      prompt: wippy.llm:prompt
```

실행 가능한 Lua 엔트리는 `process`를 전역 런타임 모듈로 받습니다. 따라서 아래 코드에서는 직접 사용하며 엔트리의 `modules` 목록에 넣지 않습니다.

### 채팅 프로세스

`src/chat.lua`를 만듭니다.

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
            model = "gpt-4o-mini",
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
wippy install
wippy run chat
```

프롬프트 빌더는 전체 대화 기록을 유지합니다. 턴마다 사용자 메시지와 어시스턴트 응답을 추가하여 이전 교환의 컨텍스트를 모델에 제공합니다.

## 3단계: 에이전트 프레임워크

에이전트 모듈은 프롬프트, 모델, 도구를 선언적으로 정의한 뒤 컨텍스트와 러너를 통해 결과 에이전트를 로드하고 실행합니다.

### 에이전트 의존성 추가

`_index.yaml`에 추가합니다.

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

에이전트 엔트리를 추가합니다.

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
    model: gpt-4o-mini
    max_tokens: 1024
    temperature: 0.7
```

### 채팅 프로세스 업데이트

에이전트 프레임워크로 전환합니다. 엔트리의 가져오기를 업데이트합니다.

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
    imports:
      prompt: wippy.llm:prompt
      agent_context: wippy.agent:context
```

`src/chat.lua`를 업데이트합니다.

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

에이전트 정의에는 프롬프트, 모델, 매개변수가 있고 프로세스는 실행을 제어합니다. 컨텍스트는 런타임에 도구를 추가하거나 모델을 재정의할 수 있습니다.

새로 추가한 에이전트 의존성을 해석한 뒤 이 단계를 실행합니다.

```bash
wippy update
wippy install
wippy run chat
```

## 4단계: 스트리밍

전체 응답을 기다리지 않고 도착하는 대로 응답 청크를 처리합니다.

### 스트리밍 구현

`src/chat.lua`를 업데이트합니다.

```lua
local io = require("io")
local prompt = require("prompt")
local agent_context = require("agent_context")

local STREAM_TOPIC = "stream"
local stream_sequence = 0

local function stream_response(runner, conversation)
    stream_sequence = stream_sequence + 1
    local topic = STREAM_TOPIC .. ":" .. tostring(stream_sequence)
    local stream_ch = process.listen(topic)
    local done_ch = channel.new(1)

    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = topic,
            },
        })
        done_ch:send({ response = response, err = err })
    end)

    local full_text = ""
    local response_result = nil
    local stream_done = false

    local function finish(text, response, err)
        process.unlisten(stream_ch)
        return text, response, err
    end

    while true do
        local result = channel.select({
            stream_ch:case_receive(),
            done_ch:case_receive(),
        })
        if not result.ok then break end

        if result.channel == done_ch then
            response_result = result.value
        else
            local chunk = result.value
            if chunk.type == "chunk" then
                io.write(chunk.content or "")
                full_text = full_text .. (chunk.content or "")
            elseif chunk.type == "done" then
                stream_done = true
            elseif chunk.type == "error" then
                return finish(nil, nil, chunk.error and chunk.error.message or "stream error")
            end
        end

        if response_result and response_result.err then
            return finish(full_text, response_result.response, response_result.err)
        end

        if response_result and stream_done then
            return finish(full_text, response_result.response, response_result.err)
        end
    end

    return finish(full_text, nil, nil)
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
    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local text, _, gen_err = stream_response(runner, conversation)
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

    io.print("Bye!")
end

return { main = main }
```

핵심 패턴:

- `coroutine.spawn`이 `runner:step()`을 따로 실행하므로 주 코루틴이 스트림 청크를 처리할 수 있습니다.
- `channel.select`가 스트림 채널과 완료 채널을 함께 기다립니다.
- 각 턴은 고유한 주제를 사용하며 러너와 해당 턴의 스트림이 모두 완료되면 리스너를 제거합니다.
- 프로세스는 스트리밍된 텍스트를 대화 기록에 사용하도록 누적합니다.

같은 명령으로 스트리밍 단계를 실행합니다.

```bash
wippy run chat
```

## 5단계: 도구

에이전트가 외부 기능에 접근하기 위해 호출할 수 있는 도구를 제공합니다.

### 도구 정의

`src/tools/_index.yaml`을 만듭니다.

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

도구 메타데이터는 LLM에 호출 가능한 인터페이스를 설명합니다.

- `input_schema`는 JSON Schema로 인수를 정의합니다.
- `llm_alias`는 LLM에 표시되는 함수 이름입니다.
- `llm_description`은 도구를 언제 사용해야 하는지 설명합니다.

### 도구 구현

`src/tools/current_time.lua`를 만듭니다.

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

`src/tools/calculate.lua`를 만듭니다.

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

도구를 참조하도록 `src/_index.yaml`의 에이전트 엔트리를 업데이트합니다.

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
    model: gpt-4o-mini
    max_tokens: 1024
    temperature: 0.7
    tools:
      - app.tools:current_time
      - app.tools:calculate
```

### 도구 실행 추가

`json`과 `funcs`를 포함하도록 채팅 프로세스 모듈을 업데이트합니다.

```yaml
    modules:
      - io
      - json
      - funcs
```

도구 실행을 포함하도록 `src/chat.lua`를 업데이트합니다.

```lua
local io = require("io")
local json = require("json")
local funcs = require("funcs")
local prompt = require("prompt")
local agent_context = require("agent_context")

local STREAM_TOPIC = "stream"
local stream_sequence = 0

local function stream_response(runner, conversation)
    stream_sequence = stream_sequence + 1
    local topic = STREAM_TOPIC .. ":" .. tostring(stream_sequence)
    local stream_ch = process.listen(topic)
    local done_ch = channel.new(1)

    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = topic,
            },
        })
        done_ch:send({ response = response, err = err })
    end)

    local full_text = ""
    local response_result = nil
    local stream_done = false

    local function finish(text, response, err)
        process.unlisten(stream_ch)
        return text, response, err
    end

    while true do
        local result = channel.select({
            stream_ch:case_receive(),
            done_ch:case_receive(),
        })
        if not result.ok then break end

        if result.channel == done_ch then
            response_result = result.value
        else
            local chunk = result.value
            if chunk.type == "chunk" then
                io.write(chunk.content or "")
                full_text = full_text .. (chunk.content or "")
            elseif chunk.type == "done" then
                stream_done = true
            elseif chunk.type == "error" then
                return finish(nil, nil, chunk.error and chunk.error.message or "stream error")
            end
        end

        if response_result and response_result.err then
            return finish(full_text, response_result.response, response_result.err)
        end

        if response_result and stream_done then
            return finish(full_text, response_result.response, response_result.err)
        end
    end

    return finish(full_text, nil, nil)
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

local function run_turn(runner, conversation)
    while true do
        local text, response, err = stream_response(runner, conversation)
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
    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local text, gen_err = run_turn(runner, conversation)
        if gen_err then
            io.print("Error: " .. tostring(gen_err))
            goto continue
        end
        if text and text ~= "" then
            conversation:add_assistant(text)
        end

        ::continue::
    end

    io.print("Bye!")
end

return { main = main }
```

도구 실행 루프:

1. 스트리밍과 함께 `runner:step()`을 호출합니다.
2. 응답에 `tool_calls`가 있으면 각 도구를 `funcs.call()`로 실행합니다.
3. 도구 호출과 결과를 대화에 추가합니다.
4. 결과를 반영할 수 있도록 러너를 다시 호출합니다.
5. 응답에 도구 호출이 더 없으면 최종 텍스트를 반환합니다.

### 에이전트 실행

```bash
wippy update
wippy install
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

## 완전성과 제한 사항

- 이 페이지에는 다섯 단계에 필요한 모든 작성된 Lua 파일과 레지스트리 엔트리가 있습니다. `wippy.lock`과 설치된 모듈은 위 명령으로 생성됩니다.
- 모델 출력, 토큰 사용량, 도구 선택 순서, 표현은 제공자에 따라 달라집니다. 표시된 상호작용은 정확한 텍스트를 보장하는 것이 아니라 예시입니다.
- 계산기는 의도적으로 작은 산술 파서이며 범용 표현식 평가기가 아닙니다. 실제 도구는 모두 권한 경계로 취급하고 부작용을 노출하기 전에 범위가 좁은 보안 정책을 연결하세요.

## 다음 단계

- [LLM 모듈](../framework/llm.md) — LLM API 참조
- [에이전트 모듈](../framework/agents.md) — 에이전트 프레임워크 참조
- [CLI 애플리케이션](./cli.md) — 터미널 I/O 패턴
- [프로세스](./processes.md) — 프로세스 모델과 통신
