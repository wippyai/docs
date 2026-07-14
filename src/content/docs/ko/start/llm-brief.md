---
title: "LLM 브리프"
---

# LLM 브리프

이 페이지는 AI 에이전트와 LLM을 위한 것입니다. Wippy 위에서 빌드하거나 Wippy 프로젝트용 코드를 생성하는 경우, 먼저 이 문서를 읽으세요.

## Wippy란 무엇인가

Wippy는 액터 모델 위에 구축된 단일 바이너리 애플리케이션 런타임입니다. 격리된 프로세스에서 Lua 코드를 실행하며, 메시지 전달을 통해 통신합니다 — 공유 메모리도 락도 없습니다. 세 가지 컴퓨팅 모델이 존재합니다: 함수(상태 없음, 요청 범위), 프로세스(상태를 가진 장기 실행 액터), 워크플로우(Temporal에 의해 뒷받침되며 크래시에서 살아남는 내구성 액터). 시스템은 에이전트가 코드를 생성하고 등록하며 재배포 없이 애플리케이션을 개선할 수 있도록 설계되어 있습니다.

## 개념 모델

Wippy의 모든 것은 **레지스트리 항목**(registry entry)입니다. 항목은 ID(`namespace:name`), 종류(동작을 결정), 메타데이터, 데이터를 가집니다. YAML 파일은 항목을 선언하는 하나의 방법이지만, 레지스트리가 런타임의 진실의 원천이며, 항목은 시스템이 실행되는 동안 생성, 업데이트, 삭제될 수 있습니다.

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
    modules: [sql, json]

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      router: app:api_router
    method: GET
    path: /users/{id}
    func: app.api:get_user
```

## 함수 작성

함수는 상태가 없습니다. 인수를 받고, 작업을 수행하고, 결과를 반환합니다. 호출자의 컨텍스트를 상속하며 호출자가 취소되면 취소됩니다.

```lua
local sql = require("sql")
local json = require("json")
local http = require("http")

local function get_user(id)
    local db, err = sql.get("app:main_db")
    if err then return nil, err end

    local rows, err = db:query("SELECT * FROM users WHERE id = $1", id)
    if err then return nil, err end
    if #rows == 0 then return nil, errors.new(errors.NOT_FOUND, "user not found") end

    return rows[1]
end

return get_user
```

HTTP 핸들러에는 `http` 모듈을 사용합니다:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    local id = req:param("id")
    local user, err = funcs.call("app.api:get_user", id)
    if err then
        res:set_status(404)
        res:write_json({error = err:message()})
        return
    end

    res:write_json(user)
end

return handler
```

## 프로세스 작성

프로세스는 액터입니다. 자체 PID를 가지고, 받은편지함을 통해 메시지를 받으며, 메시지 간 상태를 유지합니다. 블로킹 I/O에서 양보(yield)하므로 수천 개가 동시에 실행될 수 있습니다.

```lua
local function worker(initial_config)
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local r = channel.select {
            inbox:case_receive(),
            events:case_receive()
        }

        if r.channel == events then
            local ev = r.value
            if ev.type == process.event.CANCEL then
                break
            end
        elseif r.channel == inbox then
            local msg = r.value
            local topic = msg:topic()
            local data = msg:payload():data()
            handle_message(topic, data)
        end
    end
end

return worker
```

다른 코드에서 프로세스를 생성합니다:

```lua
local pid = process.spawn("app.workers:task", "app:process_host", config)
process.send(pid, "work", {item_id = 123})
```

## 워크플로우 작성

워크플로우는 내구성이 있습니다 — 크래시와 재시작을 견뎌냅니다. 코드는 일반 Lua처럼 보입니다. 런타임은 함수 호출 결과, 슬립, 무작위 값을 자동으로 기록하여 리플레이가 결정론적이 되도록 합니다.

```lua
local function order_flow(order)
    local inventory = funcs.call("app:reserve_inventory", order.items)
    if not inventory then
        return nil, errors.new("out of stock")
    end

    local payment = funcs.call("app:charge_payment", order.total)
    if not payment then
        funcs.call("app:release_inventory", inventory.id)
        return nil, errors.new("payment failed")
    end

    -- Wait for approval signal (can block for days)
    local msg = process.inbox():receive()
    if not msg:payload():data().approved then
        funcs.call("app:refund_payment", payment.id)
        funcs.call("app:release_inventory", inventory.id)
        return nil, errors.new("rejected")
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

-- Asynchronous (returns Future)
local future = funcs.async("namespace:function_name", arg1)
local result, err = future:result()

-- With context
local exec = funcs.new():with_context({user_id = "123"})
exec:call("namespace:function_name")
```

### 프로세스 통신

```lua
-- Send message (fire-and-forget)
process.send(pid, "topic", data)

-- Receive messages
local inbox = process.inbox()
local msg, ok = inbox:receive()
local topic = msg:topic()
local data = msg:payload():data()

-- Monitor another process (receive EXIT on death)
process.monitor(pid)

-- Link processes (bidirectional failure notification)
process.spawn_linked("namespace:name", "host")
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
local db = sql.get("app:main_db")
local rows, err = db:query("SELECT * FROM users WHERE active = $1", true)
db:execute("INSERT INTO users (name) VALUES ($1)", name)

-- Key-value store
local store = require("store")
local cache = store.get("app:cache")
cache:set("key", value, 3600)  -- TTL in seconds
local val = cache:get("key")

-- Queue
local queue = require("queue")
queue.publish("app:tasks", {task = "process", id = 123})

-- Filesystem
local fs = require("fs")
local vol = fs.get("app:storage")
local data = vol:readfile("path/to/file.txt")
vol:writefile("output.txt", content)
```

### HTTP 클라이언트

```lua
local http_client = require("http_client")

local resp, err = http_client.get("https://api.example.com/data", {
    headers = {Authorization = "Bearer token"},
    timeout = "10s"
})
local body = resp.body
```

### 보안

```lua
local security = require("security")

local actor = security.actor()       -- who is calling
local scope = security.scope()       -- what permissions apply
local allowed = security.can("read", "resource:users")

-- Token management
local ts = security.token_store("app:tokens")
local token = ts:create(actor, scope, {expiration = "24h"})
local validated_actor, validated_scope = ts:validate(token)
```

### 시간

```lua
local time = require("time")

time.sleep("5s")
local now = time.now()
local timeout = time.after("30s")  -- channel that fires once
local ticker = time.ticker("10s")  -- repeating channel
```

### 레지스트리

```lua
local registry = require("registry")

local entry = registry.get("app.api:get_user")
local tests = registry.find({["meta.type"] = "test"})

-- Create entries at runtime
local snap = registry.snapshot()
local changes = snap:changes()
changes:create({id = "app:new_func", kind = "function.lua", data = {...}})
changes:apply()
```

### 이벤트

```lua
local events = require("events")

-- Publish
events.send("orders", "order.created", "/orders/123", {order_id = "123"})

-- Subscribe (wildcards supported)
local sub = events.subscribe("orders.*")
local ch = sub:channel()
local evt = ch:receive()
```

## 모듈 액세스 제어

각 항목은 어떤 모듈을 `require()`할 수 있는지 선언합니다. 목록에 없는 모듈은 단순히 사용할 수 없습니다 — 명시적으로 부여하지 않는 한 `os.execute`, `io.open`, `debug.*`, `package.*`는 존재하지 않습니다. 런타임은 소스 코드를 스캔하거나 검증하지 않습니다. 모듈 수준에서 액세스를 제어합니다. 모듈이 목록에 없으면 해당 항목에 대해 존재하지 않습니다.

```yaml
modules: [sql, json, http, time, funcs, store]
```

이는 워크플로우 결정성이 작동하는 방식이기도 합니다 — 워크플로우 항목은 결정론적 모듈만 받습니다. 런타임은 `time.now()`, `uuid.v4()` 및 기타 비결정론적 호출을 모듈 수준에서 가로채 결과를 리플레이를 위해 기록합니다.

## 프레임워크 모듈

Wippy에는 의존성을 통해 설치되는 프레임워크 모듈이 있습니다:

- **wippy/llm** — LLM 통합(OpenAI, Anthropic, Google). `llm.generate()`, 구조화된 출력, 임베딩, 스트리밍.
- **wippy/agent** — 도구 사용, 위임, 특성, 메모리가 포함된 에이전트 프레임워크. 에이전트는 레지스트리 항목으로 정의됩니다.
- **wippy/test** — BDD 테스트. `describe/it` 블록, 어설션, 모킹.
- **wippy/dataflow** — DAG 기반 워크플로우 오케스트레이션. Function, Agent, Cycle, Parallel 노드.
- **wippy/relay** — 중앙 허브, 사용자별 허브, 플러그인 라우팅을 갖춘 WebSocket 릴레이.
- **wippy/views** — 템플릿 렌더링이 있는 페이지 및 컴포넌트 시스템.
- **wippy/facade** — 인증 브리징이 있는 프런트엔드 iframe 파사드.

## 규약

- 항목 ID는 `namespace:name` 형식을 사용합니다
- 이름은 의미적 구분에 점을, 단어에 언더스코어를 사용합니다: `get_user.endpoint`
- 함수는 `result, error`를 반환합니다 — 항상 오류를 확인하세요
- 프로세스는 메시지 전달로 통신하며, 공유 상태를 사용하지 않습니다
- 여러 이벤트 소스를 다중화하려면 `channel.select`를 사용하세요
- 감독 트리가 실패를 처리합니다 — "let it crash"에 따라 설계하세요
- 컨텍스트(trace ID, 사용자 정보, 보안)는 함수 호출을 통해 자동으로 전파됩니다
- 워크플로우는 비결정론적 작업을 직접 사용해서는 안 됩니다 — 런타임이 `funcs.call`, `time.sleep`, `uuid.v4`, `time.now`에 대해 이를 처리합니다

## 문서

전체 문서는 [wippy.ai/docs](https://wippy.ai/docs)에서 이용할 수 있습니다. LLM 친화적인 엔드포인트:

- 구조 탐색: `https://wippy.ai/llm/toc`
- 검색: `https://wippy.ai/llm/search?q=query`
- 페이지 가져오기: `https://wippy.ai/llm/path/en/<path>`
- 일괄 가져오기: `https://wippy.ai/llm/context?paths=path1,path2`
