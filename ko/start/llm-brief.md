---
title: "LLM 브리프"
description: "Wippy 코드를 생성하는 에이전트를 위한 핵심 개념, 프로젝트 구조, API, 규약입니다."
---

# LLM 브리프

Wippy 프로젝트용 코드를 생성할 때 이 브리프를 시작 컨텍스트로 사용하세요.

**분류: 생성 레퍼런스.** 아래 블록은 하나의 실행 가능한 프로젝트가 아니라 핵심 계약 패턴입니다. 레지스트리 ID, 스키마, 정책, `user_id`, `config`, `content` 같은 애플리케이션별 값은 사용하는 프로젝트에서 정의해야 합니다.

## Wippy란 무엇인가

Wippy는 액터 모델 위에 구축된 단일 바이너리 애플리케이션 런타임입니다. 격리된 프로세스에서 Lua 코드를 실행하며, 프로세스는 공유 메모리 대신 메시지를 통해 통신합니다. 세 가지 컴퓨팅 모델은 함수(상태가 없고 요청 범위), 프로세스(상태를 가진 장기 실행 액터), 워크플로우(Temporal 기반의 내구성 액터)입니다. 레지스트리 기반 동작은 런타임을 재배포하지 않고 추가하거나 업데이트할 수 있습니다.

## 개념 모델

Wippy의 모든 것은 **레지스트리 엔트리**입니다. 엔트리는 ID(`namespace:name`), 동작을 결정하는 종류, 메타데이터, 데이터를 가집니다. YAML 파일은 엔트리를 선언하는 한 가지 방법이지만 레지스트리가 런타임의 진실의 원천입니다. 엔트리는 시스템 실행 중에도 생성, 업데이트, 삭제할 수 있습니다.

종류는 항목이 하는 일을 결정합니다:

- `function.lua` — 상태 없는 호출 가능 함수
- `process.lua` — 장기 실행 액터
- `workflow.lua` — 내구성 워크플로우(Temporal)
- `http.service` — HTTP 서버
- `http.router` — 미들웨어가 있는 라우트 그룹
- `http.endpoint` — HTTP 핸들러
- `db.sql.postgres` / `mysql` / `sqlite` — 데이터베이스 연결
- `store.memory` / `store.sql` — 키-값 저장소
- `queue.queue` — 메시지 큐
- `process.host` — 프로세스 실행 호스트
- `process.service` — 감독되는 프로세스
- `contract.definition` / `contract.binding` — 타입이 지정된 서비스 인터페이스
- `registry.entry` — 구성 데이터

## 프로젝트 구조

```
myapp/
├── .wippy.yaml              # Runtime configuration
├── wippy.lock               # Source directories
└── src/
    ├── _index.yaml          # Entry definitions (namespace: app)
    ├── api/
    │   ├── _index.yaml      # namespace: app.api
    │   └── handler.lua
    └── workers/
        ├── _index.yaml      # namespace: app.workers
        └── task.lua
```

항목 정의는 `_index.yaml` 파일에 있습니다:

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    source: file://handler.lua
    method: get_user
    modules: [sql]

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      router: app:api_router
    method: GET
    path: /users/{id}
    func: app.api:get_user
```

## 함수 작성

함수는 상태가 없습니다. 인수를 받아 작업을 수행하고 결과를 반환합니다. 호출자의 컨텍스트를 상속하며 호출자가 취소되면 함께 취소됩니다.

```lua
local sql = require("sql")

local function get_user(id)
    local db, err = sql.get("app:main_db")
    if err then return nil, err end

    local rows, err = db:query("SELECT * FROM users WHERE id = $1", {id})
    if err then
        local _, release_err = db:release()
        return nil, release_err or err
    end

    local _, release_err = db:release()
    if release_err then return nil, release_err end
    if #rows == 0 then
        return nil, errors.new({kind = errors.NOT_FOUND, message = "user not found"})
    end

    return rows[1]
end

return get_user
```

HTTP 핸들러에는 `http` 모듈을 사용합니다:

```lua
local http = require("http")
local funcs = require("funcs")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local id, param_err = req:param("id")
    if param_err then return nil, param_err end
    local user, err = funcs.call("app.api:get_user", id)
    if err then
        local status_err
        if errors.is(err, errors.NOT_FOUND) then
            status_err = res:set_status(404)
        else
            status_err = res:set_status(500)
        end
        if status_err then return nil, status_err end
        local write_err = res:write_json({error = err:message()})
        if write_err then return nil, write_err end
        return true
    end

    local write_err = res:write_json(user)
    if write_err then return nil, write_err end
    return true
end

return handler
```

## 프로세스 작성

프로세스는 액터입니다. 각 프로세스는 PID를 가지고 인박스로 메시지를 받으며 메시지 사이에 상태를 유지할 수 있습니다. I/O를 기다리는 동안 양보하여 다른 프로세스가 실행될 수 있게 합니다.

```lua
local function worker(initial_config)
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local r = channel.select {
            inbox:case_receive(),
            events:case_receive()
        }

        if not r.ok then break end

        if r.channel == events then
            local ev = r.value
            if ev.kind == process.event.CANCEL then
                break
            end
        elseif r.channel == inbox then
            local msg = r.value
            local topic = msg:topic()
            local data, err = msg:payload():data()
            if err then return nil, err end

            if topic == "work" then
                -- Perform the application-specific work here.
                print(data.item_id)
            end
        end
    end
end

return worker
```

다른 코드에서 프로세스를 생성합니다:

```lua
local pid, err = process.spawn("app.workers:task", "app:process_host", config)
if err then return nil, err end

local ok, send_err = process.send(pid, "work", {item_id = 123})
if send_err then return nil, send_err end
return ok
```

## 워크플로우 작성

워크플로우는 실행 이력을 영속화하여 크래시나 재시작 후에도 재개할 수 있습니다. 워크플로우 코드는 일반 Lua 문법을 사용하며, 런타임은 결정론적 리플레이를 위해 함수 결과, 슬립, 무작위 값을 기록합니다.

아래의 각 `funcs.call()` 대상은 같은 Temporal 워커에 `meta.temporal.activity.worker`를 통해 액티비티로 등록해야 합니다. 필요한 함수 메타데이터는 [액티비티](../temporal/activities.md)를 참고하세요.

```lua
local funcs = require("funcs")

local function compensate(inventory, payment)
    local _, refund_err = funcs.call("app:refund_payment", payment.id)
    local _, release_err = funcs.call("app:release_inventory", inventory.id)
    return refund_err or release_err
end

local function order_flow(order)
    local inventory, err = funcs.call("app:reserve_inventory", order.items)
    if err then return nil, err end

    local payment, payment_err = funcs.call("app:charge_payment", order.total)
    if payment_err then
        local _, release_err = funcs.call("app:release_inventory", inventory.id)
        return nil, release_err or payment_err
    end

    -- Wait for approval signal (can block for days)
    local msg, open = process.inbox():receive()
    if not open then
        local compensation_err = compensate(inventory, payment)
        return nil, compensation_err or errors.new("workflow inbox closed")
    end

    local decision, payload_err = msg:payload():data()
    if payload_err then
        local compensation_err = compensate(inventory, payment)
        return nil, compensation_err or payload_err
    end
    if not decision.approved then
        local compensation_err = compensate(inventory, payment)
        return nil, compensation_err or errors.new("rejected")
    end

    return funcs.call("app:fulfill_order", order.id)
end

return order_flow
```

## 주요 API

### 함수 호출

```lua
local funcs = require("funcs")

-- Synchronous
local result, err = funcs.call("namespace:function_name", arg1, arg2)
if err then return nil, err end

-- Asynchronous (returns Future)
local future, future_err = funcs.async("namespace:function_name", arg1)
if future_err then return nil, future_err end
local response_ch = future:response()
local _, response_open = response_ch:receive()
if not response_open then
    return nil, errors.new("future response channel closed")
end
local async_payload, async_err = future:result()
if async_err then return nil, async_err end
local async_result, decode_err = async_payload:data()
if decode_err then return nil, decode_err end

-- With context
local contextual_exec, contextual_err = funcs.new():with_context({user_id = "123"})
if contextual_err then return nil, contextual_err end
local contextual_result, contextual_err = contextual_exec:call("namespace:function_name")
if contextual_err then return nil, contextual_err end
```

### 프로세스 통신

```lua
-- Send message (fire-and-forget)
local ok, err = process.send(pid, "topic", data)
if err then return nil, err end

-- Receive messages
local inbox = process.inbox()
local msg, ok = inbox:receive()
if not ok then return nil, errors.new("process inbox closed") end
local topic = msg:topic()
local data, payload_err = msg:payload():data()
if payload_err then return nil, payload_err end

-- Monitor another process (receive EXIT on death)
local monitored, monitor_err = process.monitor(pid)
if monitor_err then return nil, monitor_err end

-- Link processes (bidirectional failure notification)
local linked_pid, spawn_err = process.spawn_linked("namespace:name", "host")
if spawn_err then return nil, spawn_err end
```

### 채널

코루틴 통신을 위한 Go 스타일 채널:

```lua
local ch = channel.new(10)  -- buffered
ch:send(value)
local val, ok = ch:receive()

-- Select on multiple channels
local r = channel.select {
    ch1:case_receive(),
    ch2:case_receive(),
    timeout:case_receive()
}
```

### 오류 처리

함수는 `result, error` 쌍을 반환합니다. 오류는 타입이 지정된 객체입니다:

```lua
local result, err = some_operation()
if err then
    if errors.is(err, errors.NOT_FOUND) then
        -- handle not found
    end
    return nil, errors.wrap(err, "context message")
end
```

오류 종류: `UNKNOWN`, `INVALID`, `NOT_FOUND`, `ALREADY_EXISTS`, `PERMISSION_DENIED`, `TIMEOUT`, `CANCELED`, `UNAVAILABLE`, `INTERNAL`, `CONFLICT`, `RATE_LIMITED`.

### 데이터 액세스

```lua
-- SQL
local sql = require("sql")
local db, db_err = sql.get("app:main_db")
if db_err then return nil, db_err end
local rows, err = db:query("SELECT * FROM users WHERE active = $1", {true})
if err then
    local _, release_err = db:release()
    return nil, release_err or err
end
local _, release_err = db:release()
if release_err then return nil, release_err end

-- Key-value store
local store = require("store")
local cache, cache_err = store.get("app:cache")
if cache_err then return nil, cache_err end
local stored, set_err = cache:set("key", value, 3600)  -- TTL in seconds
if set_err then
    cache:release()
    return nil, set_err
end
local val, get_err = cache:get("key")
cache:release()
if get_err then return nil, get_err end

-- Queue
local queue = require("queue")
local published, publish_err = queue.publish("app:tasks", {task = "process", id = 123})
if publish_err then return nil, publish_err end

-- Filesystem
local fs = require("fs")
local vol, volume_err = fs.get("app:storage")
if volume_err then return nil, volume_err end
local data, read_err = vol:readfile("path/to/file.txt")
if read_err then return nil, read_err end
local written, write_err = vol:writefile("output.txt", content)
if write_err then return nil, write_err end
```

### HTTP 클라이언트

```lua
local http_client = require("http_client")

local resp, err = http_client.get("https://api.example.com/data", {
    headers = {Authorization = "Bearer token"},
    timeout = "10s"
})
if err then return nil, err end
local body = resp.body
```

### 보안

```lua
local security = require("security")

local actor = security.actor()       -- who is calling
local scope = security.scope()       -- what permissions apply
if not actor then return nil, errors.new("security actor unavailable") end
if not scope then return nil, errors.new("security scope unavailable") end
local allowed = security.can("read", "resource:users")

-- Token management
local ts, store_err = security.token_store("app:tokens")
if store_err then return nil, store_err end
local token, create_err = ts:create(actor, scope, {expiration = "24h"})
if create_err then
    ts:close()
    return nil, create_err
end
local validated_actor, validated_scope, validate_err = ts:validate(token)
ts:close()
if validate_err then return nil, validate_err end
```

### 시간

```lua
local time = require("time")

time.sleep("5s")
local now = time.now()
local timeout, timeout_err = time.after("30s")  -- channel that fires once
if timeout_err then return nil, timeout_err end
local ticker, ticker_err = time.ticker("10s")  -- repeating channel
if ticker_err then return nil, ticker_err end
-- Stop the ticker when its consumer finishes.
ticker:stop()
```

### 레지스트리

```lua
local registry = require("registry")

local entry, entry_err = registry.get("app.api:get_user")
if entry_err then return nil, entry_err end
local tests, find_err = registry.find({["meta.type"] = "test"})
if find_err then return nil, find_err end

-- Create entries at runtime
local snap, snapshot_err = registry.snapshot()
if snapshot_err then return nil, snapshot_err end
local changes, changes_err = snap:changes()
if changes_err then return nil, changes_err end
local _, create_err = changes:create({id = "app:new_func", kind = "function.lua", data = {...}})
if create_err then return nil, create_err end
local version, apply_err = changes:apply()
if apply_err then return nil, apply_err end
```

### 이벤트

```lua
local events = require("events")

-- Publish
local sent, send_err = events.send("orders", "order.created", "/orders/123", {order_id = "123"})
if send_err then return nil, send_err end

-- Subscribe (wildcards supported)
local sub, subscribe_err = events.subscribe("orders.*")
if subscribe_err then return nil, subscribe_err end
local ch = sub:channel()
local evt, open = ch:receive()
sub:close()
if not open then return nil, errors.new("event subscription closed") end
```

## 모듈 액세스 제어

각 엔트리는 제한된 기본 환경과 표준 라이브러리를 받으며, 실행 가능한 엔트리는 앰비언트 `process` 모듈도 받습니다. 앰비언트가 아닌 런타임 모듈은 `modules:`에, 레지스트리 기반 라이브러리는 `imports:`에 추가하세요. 선언하지 않은 비앰비언트 모듈은 사용할 수 없습니다. `os.execute`, `io.open`, `debug.*`, 네이티브 모듈 로딩, 임의의 `package.path` 해석 같은 호스트 Lua 기능은 선택 가능한 런타임 모듈로 노출되지 않습니다. 런타임은 소스 코드를 스캔하는 대신 모듈 로더로 가용성을 제어합니다.

```yaml
modules: [sql, json, http, time, funcs, store]
```

워크플로우 엔트리는 결정론적 모듈만 받습니다. 런타임은 `time.now()`, `uuid.v4()` 및 기타 비결정론적 호출을 모듈 수준에서 가로채 결과를 리플레이용으로 기록합니다.

## 프레임워크 모듈

프레임워크 기능은 의존성으로 배포됩니다:

- **wippy/llm** — LLM 통합(OpenAI, Anthropic, Google). `llm.generate()`, 구조화된 출력, 임베딩, 스트리밍.
- **wippy/agent** — 도구 사용, 위임, 특성, 메모리가 포함된 에이전트 프레임워크. 에이전트는 레지스트리 항목으로 정의됩니다.
- **wippy/test** — BDD 테스트. `describe/it` 블록, 어설션, 모킹.
- **wippy/dataflow** — DAG 기반 워크플로우 오케스트레이션. Function, Agent, Cycle, Parallel 노드.
- **wippy/relay** — 중앙 허브, 사용자별 허브, 플러그인 라우팅을 갖춘 WebSocket 릴레이.
- **wippy/views** — 템플릿 렌더링이 있는 페이지 및 컴포넌트 시스템.
- **wippy/facade** — iframe 및 Web Fragment 페이지용 프런트엔드 파사드와 인증 브리지.

## 규약

- 항목 ID는 `namespace:name` 형식을 사용합니다
- 이름은 의미적 구분에 점을, 단어에 언더스코어를 사용합니다: `get_user.endpoint`
- 실패할 수 있는 API는 `result, error`를 반환합니다 — 항상 오류를 확인하세요
- 프로세스는 메시지 전달로 통신하며, 공유 상태를 사용하지 않습니다
- 여러 이벤트 소스를 다중화하려면 `channel.select`를 사용하세요
- 모든 작업에 로컬 복구를 추가하는 대신 감독 트리가 프로세스 실패를 처리하게 하세요
- 컨텍스트(trace ID, 사용자 정보, 보안)는 함수 호출을 통해 자동으로 전파됩니다
- 워크플로우는 비결정론적 작업을 직접 사용해서는 안 됩니다 — 런타임이 `funcs.call`, `time.sleep`, `uuid.v4`, `time.now`에 대해 이를 처리합니다

## 문서

전체 문서는 [docs.wippy.ai](https://docs.wippy.ai)에서 이용할 수 있습니다. LLM 친화적인 엔드포인트:

- 구조 탐색: `https://wippy.ai/llm/toc`
- 검색: `https://wippy.ai/llm/search?q=query`
- 페이지 가져오기: `https://wippy.ai/llm/path/en/<path>`
- 일괄 가져오기: `https://wippy.ai/llm/context?paths=path1,path2`
