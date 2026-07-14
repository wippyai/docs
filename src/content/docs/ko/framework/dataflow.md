---
title: "Dataflow"
---

# Dataflow

`wippy/dataflow` 모듈은 유향 비순환 그래프(DAG)를 기반으로 하는 워크플로우 오케스트레이션 엔진을 제공합니다. 워크플로우는 노드로 구성되며—함수, 에이전트, 사이클, 병렬 프로세서—타입이 지정된 데이터 라우트로 연결됩니다. 오케스트레이터는 실행, 상태 영속성, 복구를 관리합니다.

## 설치

모듈을 프로젝트에 추가합니다:

```bash
wippy add wippy/dataflow
wippy install
```

의존성을 선언합니다:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.dataflow
    kind: ns.dependency
    component: wippy/dataflow
    version: "*"
```

dataflow 모듈은 `wippy/agent`, `wippy/llm`, `wippy/session`에 의존합니다 — `wippy install`을 실행하면 이들이 자동으로 해결됩니다. 이 모듈은 워크플로우 영속화를 위해 `app:db`에 데이터베이스 리소스가 필요하며, `wippy/migration`을 통해 마이그레이션을 자동으로 실행합니다.

이 모듈은 `env.variable` 항목 `userspace.dataflow.env:web_host_origin`(기본값 `https://front.wippy.ai`)을 게시하며, 다운스트림 플로우는 공개 URL을 구성하기 위해 이를 읽을 수 있습니다. env 라우터 또는 requirement를 통해 재정의하십시오.

## Flow Builder

flow builder는 워크플로우를 구성하기 위한 유창한 인터페이스를 제공합니다. 항목에 가져옵니다:

```yaml
imports:
  flow: userspace.dataflow.flow:flow
```

```lua
local flow = require("flow")
```

### 핵심 API

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
    :run()   -- synchronous
    :start() -- asynchronous

flow.template()
    :[operations]...
```

### 선형 파이프라인

명시적 라우팅이 정의되지 않은 경우 노드는 자동으로 체인됩니다. 각 노드의 출력이 다음으로 흐릅니다:

```lua
local result, err = flow.create()
    :with_input({ text = "Hello world" })
    :func("app:tokenize")
    :func("app:translate", { args = { target_lang = "fr" } })
    :func("app:format_output")
    :run()
```

### 명명된 라우팅

`:as()`로 노드의 이름을 지정하고 `:to()`로 그들 사이에 데이터를 라우팅합니다. 노드를 참조해야 할 때만 `:as()`를 사용하십시오:

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

`:to()`의 두 번째 매개변수는 **판별자**(discriminator)입니다 — 수신 노드의 입력 키. 노드가 여러 입력을 받을 때, 이들은 판별자를 키로 하는 테이블로 수집됩니다.

### 워크플로우 입력 및 정적 데이터

`:with_input()`은 워크플로우로의 단일 주요 입력입니다. `:with_data()`는 독립적인 정적 데이터 소스를 생성합니다:

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

워크플로우로 들어오는 외부 데이터에는 `:with_input()`을 사용합니다. 여러 노드 간에 공유되는 구성, 상수, 참조 데이터에는 `:with_data()`를 사용합니다. 정적 데이터는 참조 최적화를 사용합니다 — 첫 번째 경로는 실제 데이터를 만들고, 후속 경로는 가벼운 참조를 만듭니다.

### 조건부 라우팅

`:to()` 다음에 `:when()`을 사용하여 조건을 추가합니다. 조건은 `expr` 구문을 사용하여 노드의 출력에 대해 평가됩니다:

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

조건은 더 복잡한 라우팅을 위해 인라인 변환과 결합될 수 있습니다:

```lua
:func("app:decompose"):as("decompose")
    :to("@success", nil, "{passed: true, feedback: nil}"):when("len(output.items) == 0")
    :to("processor", "items", "output.items")
```

조건부 표현식은 다음을 지원합니다: 비교(`output.score > 0.8`), 논리 연산자(`output.valid && output.count > 5`), 배열 함수(`len(output.items) > 0`, `any(output.errors, {.critical})`), 문자열 연산(`output.status contains 'success'`), 옵셔널 체이닝(`output.data?.nested?.value`).

### 워크플로우 터미널

`@success` 또는 `@fail`로 라우팅하여 워크플로우를 명시적으로 종료합니다. 중첩된 컨텍스트(사이클, 병렬)에서 터미널은 워크플로우 출력 대신 노드 출력을 생성합니다:

```lua
:func("app:final_step"):to("@success")
:func("app:handler"):error_to("@fail")
```

### 오류 라우팅

`:error_to()`를 사용하여 노드 오류를 핸들러로 라우팅합니다. 오류는 복구 노드에 대한 일반 입력으로 라우팅될 수 있습니다:

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

이 패턴은 두 플래너를 병렬로 실행합니다 — 하나가 실패하면 그 오류가 consolidator의 입력이 되고, consolidator는 사용 가능한 모든 결과로 진행합니다.

## 입력 병합

노드가 입력을 받는 방식은 판별자와 `args`가 구성되었는지에 따라 다릅니다.

**args 없음 — 단일 기본 입력:**

```lua
:func("source"):to("target")
-- target receives: raw content (unwrapped)
```

**args 없음 — 단일 명명된 입력:**

```lua
:func("source"):to("target", "task")
-- target receives: { task = content }
```

**args 없음 — 다중 입력:**

```lua
:func("source1"):to("target", "data")
:func("source2"):to("target", "config")
-- target receives: { data = content1, config = content2 }
```

**args 있음 — 입력이 기본 항목에 병합됨:**

```lua
:func("app:api_client", {
    args = { base_url = "https://api.com", timeout = 5000 }
})
-- with :to("api_client", "body") from upstream
-- api_client receives: { base_url = "https://api.com", timeout = 5000, body = content }
```

<note>
<code>args</code>가 있는 노드는 <code>"default"</code> 판별자로 입력을 받을 수 없습니다. 대신 <code>:to(target, "input_key")</code>와 함께 명명된 판별자를 사용하십시오.
</note>

## 입력 변환

데이터가 노드에 도달하기 전에 변환합니다:

```lua
-- String transform: single expression
:func("app:step", { input_transform = "input.nested.field" })

-- Table transform: named expressions
:func("app:step", {
    input_transform = {
        task = "inputs.task",
        config = "inputs.settings",
        priority = "output.score > 0.8 ? 'high' : 'normal'"
    }
})
```

변환에서 사용할 수 있는 컨텍스트 변수: `input`(워크플로우 입력), `inputs`(모든 들어오는 노드 입력), `output`(라우팅 시 현재 노드의 출력).

### 인라인 라우트 변환

`:to()`의 세 번째 매개변수는 인라인 변환 표현식입니다:

```lua
:func("source"):as("source")
    :to("target", nil, "output.data")
    :to("other", nil, "{passed: true, value: output.x}")
    :to("list", nil, "map(output.items, {.id})")
```

## 노드 타입

### 함수 노드

등록된 `function.lua` 항목을 실행합니다:

```lua
:func("app:my_function", {
    args = { key = "value" },
    inputs = { required = { "task", "config" } },
    context = { session_id = "abc" },
    input_transform = { task = "inputs.prompt" },
    metadata = { title = "Process Data" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `args` | table | 노드 입력과 병합되는 기본 인수 |
| `inputs` | table | 입력 요구사항: `{ required = {...}, optional = {...} }` |
| `context` | table | 함수에 전달되는 실행 컨텍스트 |
| `input_transform` | string/table | 입력을 변환하는 표현식 |
| `metadata` | table | 노드 메타데이터(예: `{ title = "..." }`) |

함수가 `{ _control = { commands = [...] } }`를 반환하면 오케스트레이터가 자식 워크플로우를 생성합니다. 중첩된 플로우가 이렇게 작동합니다.

### 에이전트 노드

도구 호출과 선택적 구조화된 종료를 포함하여 에이전트를 실행합니다:

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

| Option | Type | Description |
|--------|------|-------------|
| `model` | string | 모델 오버라이드 |
| `arena.prompt` | string | 시스템 프롬프트 |
| `arena.max_iterations` | number | 최대 추론 루프(기본값: 64) |
| `arena.min_iterations` | number | 종료 전 최소 반복(기본값: 1) |
| `arena.tool_calling` | string | `"auto"`, `"any"`(`exit_schema` 필요), `"none"`(`exit_schema` 거부) |
| `arena.tools` | array | 도구 레지스트리 ID |
| `arena.exit_schema` | table | 구조화된 종료를 위한 JSON schema |
| `arena.exit_func_id` | string | 종료 출력을 검증하는 함수 |
| `arena.context` | table | 추가 컨텍스트 |
| `inputs` | table | 입력 요구사항 |
| `show_tool_calls` | boolean | 출력에 도구 호출 포함 |
| `input_transform` | string/table | 입력 변환 |
| `metadata` | table | 노드 메타데이터 |

**동적 에이전트 선택:** 에이전트 ID로 빈 문자열을 전달하고 `input_transform`을 통해 해석합니다:

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

**종료 검증:** `exit_func_id`가 설정된 경우, 함수는 에이전트의 종료 출력을 검증합니다. 검증 실패 시 에이전트는 오류를 관찰로 받고 계속 진행합니다(최대 `max_iterations`까지).

### 사이클 노드

영속 상태를 가지고 함수나 템플릿을 반복적으로 반복합니다:

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

사이클 함수는 각 반복마다 다음을 받습니다:

```lua
{
    input = <workflow_input>,
    state = <accumulated_state>,
    last_result = <previous_iteration_output>,
    iteration = <current_iteration_number>
}
```

함수는 계속을 제어합니다:

```lua
function my_cycle(cycle_context)
    -- stop if approved
    if cycle_context.last_result and cycle_context.last_result.approved then
        return {
            state = cycle_context.state,
            result = cycle_context.last_result,
            continue = false
        }
    end

    -- spawn child workflow for this iteration
    return flow.create()
        :with_input({ task = cycle_context.input.task })
        :agent("app:worker")
        :agent("app:qa")
        :run()
end
```

| Option | Type | Description |
|--------|------|-------------|
| `func_id` | string | 반복 함수(`template`과 상호 배타적) |
| `template` | FlowBuilder | 각 반복의 템플릿(`func_id`와 상호 배타적) |
| `max_iterations` | number | 최대 반복 횟수 |
| `initial_state` | table | 시작 상태 |
| `continue_condition` | string | 표현식: 참인 동안 계속 |

**템플릿 기반 사이클:**

```lua
:cycle({
    template = flow.template()
        :agent("app:worker")
        :func("app:validator"),
    max_iterations = 5
})
```

### 병렬 노드

배열에 대한 map-reduce 패턴:

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

| Option | Type | Description |
|--------|------|-------------|
| `source_array_key` | string | 배열을 포함하는 입력 키(필수) |
| `template` | FlowBuilder | 각 항목의 템플릿(필수, `@success`로 라우팅해야 함) |
| `iteration_input_key` | string | 현재 항목의 입력 키(기본값: `"default"`) |
| `batch_size` | number | 병렬 배치당 항목 수(기본값: 1 = 순차) |
| `on_error` | string | `"collect_errors"`(기본값) 또는 `"fail_fast"` |
| `filter` | string | `"all"`(기본값), `"successes"`, `"failures"` |
| `unwrap` | boolean | 메타데이터가 포함된 래핑된 결과 대신 원시 결과 반환(기본값: false) |
| `passthrough_keys` | array | 모든 반복에 전달되는 입력 키 |

**Passthrough 키**는 소스 배열의 데이터를 중복하지 않고 모든 반복에 공유 컨텍스트(구성, 작업 설명)를 제공합니다:

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

### 시그널 노드

외부 시그널이 도착할 때까지 실행을 일시 중지합니다. 사람의 승인, 외부 이벤트, 단계별 워크플로우에 사용합니다:

```lua
:signal({
    signal_id = "approval",
    inputs = { required = { "draft" } },
    metadata = { title = "Wait for approval" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `signal_id` | string | `client:signal()`과 매칭되는 시그널 이름. 비어 있거나 생략된 경우 런타임에 UUID v7이 생성됨 |
| `inputs` | table | 입력 요구사항 |
| `input_transform` | string/table | 노드가 입력을 받기 전에 변환 |
| `metadata` | table | 노드 메타데이터 |

클라이언트 API를 사용하여 워크플로우 외부에서 시그널을 전송합니다(아래의 `client:signal()` 참조).

#### 동작

노드는 `wait_for_signal = true`로 yield하고 해당 yield를 워크플로우 상태에 영속화합니다. 매칭되는 `NODE_SIGNAL` 커밋이 도착하면 오케스트레이터가 노드를 재개합니다.

- 시그널은 `nil`이 아닌 모든 페이로드로 충족됩니다. `false`, `0`, `""`, `{}` 모두 yield를 충족시킵니다; `nil`만이 보류 상태를 유지합니다.
- 시그널 yield는 `COMPLETE_WORKFLOW`를 차단하지만 다른 보류 중인 노드는 차단하지 않습니다 — 한 분기가 대기하는 동안 병렬 분기는 계속 실행됩니다.
- 시그널은 `:start()` 전에 사전 큐잉될 수 있습니다: 시그널 노드가 yield에 도달하기 전에 매칭되는 `NODE_SIGNAL` 커밋이 도착하면, yield가 추적되는 순간 전달됩니다.
- 각 yield는 하나의 시그널로만 충족됩니다. yield가 충족되기 전에 동일한 `signal_id`를 가진 두 번째 시그널이 도착하면 첫 번째를 덮어씁니다.
- 여러 시그널 yield가 동일한 `signal_id`를 공유할 때, 첫 번째 매칭되는 yield가 데이터를 받습니다.
- `signal_id` 필드가 없으면 매칭은 노드의 판별자로 대체됩니다.
- 전달된 시그널 데이터는 시그널 페이로드로 노드 출력에 전달됩니다.

#### 내구성 및 복구

시그널 yield는 워크플로우 상태의 일부이며, 다른 모든 명령과 동일한 outbox 메커니즘을 통해 영속화됩니다. 오케스트레이터 프로세스가 대기 중에 종료되는 경우:

- 보류 중인 yield는 재시작 시 복원됩니다.
- 중단 기간 동안 전달된 시그널은 큐에 쌓이고 상태가 다시 로드될 때 적용됩니다.
- 복합 파이프라인(`func → signal → signal → func`)은 단계별로 복구됩니다 — 각 시그널은 별도의 재시작에 걸쳐 전달될 수 있습니다.

고아 시그널 yield(부모 프로세스가 완료 없이 종료된 yield)는 워크플로우 상태의 프로세스 종료 핸들러에 의해 정리됩니다.

#### 파이프라인 패턴

시그널 노드는 모든 토폴로지에 참여할 수 있습니다:

```lua
-- Human-in-the-loop approval between two functions
flow.create()
    :func("app:draft")
    :signal({ signal_id = "approve_draft" })
    :func("app:publish")
    :run()

-- Two parallel approvals that must both arrive before release
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

시그널 데이터는 노드 출력으로 노출되므로 다운스트림 노드는 `client:signal()`에 전달된 것을 그대로 받습니다.

### Join 노드

진행하기 전에 여러 입력을 수집합니다:

```lua
:join({
    inputs = { required = { "source1", "source2" } },
    output_mode = "object",
    ignored_keys = { "triggered" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `output_mode` | string | `"object"`(기본값) 또는 `"array"`(도착 순서) |
| `ignored_keys` | array | 출력에서 제외되는 입력 키 |
| `inputs` | table | 입력 요구사항 |

## 템플릿

템플릿은 재사용 가능한 하위 워크플로우를 정의합니다. 생성하려면 `flow.template()`을, 인라인하려면 `:use()`를 사용합니다:

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

템플릿은 컴파일 시간에 해당 작업을 부모 플로우에 인라인합니다.

## 중첩된 워크플로우

사이클 및 병렬 노드에서 사용되는 함수는 `flow.create():run()`을 반환하여 자식 워크플로우를 생성할 수 있습니다:

```lua
function my_processor(input)
    return flow.create()
        :with_input(input)
        :func("app:step_a")
        :func("app:step_b")
        :run()
end
```

`:run()`이 기존 dataflow 컨텍스트 내에서 실행되면 직접 실행하는 대신 `{ _control = { commands = [...] } }`를 반환합니다. 오케스트레이터는 yield 메커니즘을 통해 자식 워크플로우를 처리합니다.

<note>
dataflow 구성에 참여하는 함수는 <code>flow.create():run()</code>을 반환해야 <strong>합니다</strong>. 다른 것을 반환하는 함수는 자식 워크플로우를 생성할 수 없습니다.
</note>

## 동기 vs 비동기

`:run()`은 워크플로우가 완료될 때까지 차단하고 출력을 반환합니다:

```lua
local result, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :run()
```

`:start()`는 즉시 워크플로우 ID와 함께 반환합니다:

```lua
local dataflow_id, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :start()
```

`:start()`는 중첩된 컨텍스트에서 사용할 수 없습니다.

## 클라이언트 API

프로그래밍 방식 워크플로우 관리를 위해:

```yaml
imports:
  client: userspace.dataflow:client
```

```lua
local client = require("client")

local c, err = client.new()
```

| Method | Description |
|--------|-------------|
| `client.new()` | 클라이언트 생성(보안 액터 필요) |
| `:create_workflow(commands, options?)` | 워크플로우 생성, `dataflow_id` 반환 |
| `:execute(dataflow_id, options?)` | 동기적으로 실행, 결과 반환 |
| `:start(dataflow_id, options?)` | 비동기적으로 실행, `dataflow_id` 반환 |
| `:output(dataflow_id)` | 워크플로우 출력 가져오기 |
| `:get_status(dataflow_id)` | 현재 상태 가져오기 |
| `:cancel(dataflow_id, timeout?)` | 우아하게 취소(기본값: 30초) |
| `:terminate(dataflow_id)` | 강제 종료 |
| `:signal(dataflow_id, signal_id, data?)` | 대기 중인 시그널 노드에 외부 시그널 전달 |

## 워크플로우 상태

| Status | Description |
|--------|-------------|
| `template` | 노드가 템플릿 인스턴스 |
| `pending` | 입력 대기 중 |
| `ready` | 입력 수집됨, 실행 준비 완료 |
| `running` | 활발히 실행 중 |
| `paused` | yield됨, 자식 워크플로우 대기 중 |
| `completed` | 성공적으로 완료됨 |
| `failed` | 실패 |
| `cancelled` | 사용자 취소 |
| `skipped` | 선택되지 않은 조건부 분기 |
| `terminated` | 강제 종료됨 |

## 메타데이터

```lua
flow.create()
    :with_title("Document Processing Pipeline")
    :with_metadata({ source = "api", priority = "high" })
    :func("app:process", { metadata = { title = "Process Document" } })
    :run()
```

제공되지 않으면 제목은 기본값 "Flow Builder Workflow"입니다.

## 검증 규칙

컴파일러는 컴파일 시 워크플로우를 검증합니다:

- 모든 `:as(name)` 이름은 고유해야 합니다
- 모든 `:to()` 및 `:error_to()` 대상은 기존 이름을 참조해야 합니다(`@success`, `@fail` 제외)
- 그래프는 비순환이어야 합니다
- 모든 노드는 들어오는 라우트가 있어야 합니다(다른 노드, 워크플로우 입력 또는 정적 데이터로부터)
- `:cycle()`은 `func_id` 또는 `template`이 필요합니다(둘 다 불가)
- `:parallel()`은 `source_array_key`와 `template`이 필요합니다
- 적어도 하나의 경로가 `@success`로 이어지거나 자동 출력이 있어야 합니다
- `:when()`은 노드에서 `:to()` 또는 `:error_to()` 뒤에만 옵니다(정적 데이터 아님)
- `args`가 있는 노드는 `"default"` 판별자로 입력을 받을 수 없습니다

## 표현식 참조

표현식은 `expr` 모듈 구문을 사용하며, `:when()` 조건 및 `input_transform` 값에서 사용할 수 있습니다.

**연산자:** `+`, `-`, `*`, `/`, `%`, `**`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`, `!`, `contains`, `startsWith`, `endsWith`

**배열 함수:** `all()`, `any()`, `none()`, `one()`, `filter()`, `map()`, `count()`, `len()`, `first()`, `last()`

**수학 함수:** `max()`, `min()`, `abs()`, `ceil()`, `floor()`, `round()`, `sqrt()`, `pow()`

**문자열 함수:** `len()`, `upper()`, `lower()`, `trim()`, `split()`, `join()`

**타입 함수:** `type()`, `int()`, `float()`, `string()`

**리터럴:** 숫자, 문자열, 불리언(`true`/`false`), null(`nil`), 배열(`[1, 2, 3]`), 객체(`{key: value}`)

**삼항:** `output.age >= 18 ? output.verified : false`

**옵셔널 체이닝:** `output.data?.nested?.value`

## 오류 처리

`:run()`과 `:start()` 모두 표준 Lua 오류 규칙을 따릅니다:

- 성공: `data, nil`(run) 또는 `dataflow_id, nil`(start)
- 실패: `nil, error_message`

오류 범주: 컴파일 오류, 클라이언트 오류, 워크플로우 생성 오류, 실행 오류 및 워크플로우 실패.

## 참고

- [Agents](framework/agents.md) - 에이전트 노드가 사용하는 에이전트 프레임워크
- [LLM](framework/llm.md) - LLM 모듈
- [Framework Overview](framework/overview.md) - 프레임워크 모듈 사용법
