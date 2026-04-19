# Relay

`wippy/relay` 모듈은 2계층 허브 아키텍처를 갖춘 WebSocket 릴레이 인프라를 제공합니다. 중앙 허브는 사용자별 허브를 관리하고, 사용자별 허브는 WebSocket 클라이언트 연결을 관리하며 메시지를 플러그인으로 라우팅합니다.

## 아키텍처

```
Central Hub
├── User Hub (alice)
│   ├── Plugin: session_
│   ├── Plugin: ai_
│   ├── WebSocket Client 1
│   └── WebSocket Client 2
├── User Hub (bob)
│   ├── Plugin: session_
│   └── WebSocket Client 1
└── ...
```

중앙 허브는 서비스로 실행됩니다. WebSocket 클라이언트가 연결되면 중앙 허브는 해당 사용자의 사용자 허브를 찾거나 생성합니다. 사용자 허브는 클라이언트의 수명을 관리하고 명령 접두사를 기반으로 메시지를 플러그인으로 라우팅합니다.

## 설정

프로젝트에 모듈 추가:

```bash
wippy add wippy/relay
wippy install
```

필수 파라미터와 함께 의존성 선언:

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

  - name: dep.relay
    kind: ns.dependency
    component: wippy/relay
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app:os_env
      - name: user_security_scope
        value: app.security:user_scope
```

### 설정 파라미터

| 파라미터 | 필수 | 기본값 | 설명 |
|-----------|----------|---------|-------------|
| `application_host` | 예 | — | 릴레이 프로세스용 프로세스 호스트 |
| `env_storage` | 아니오 | 내부 | 환경 변수 스토리지 |
| `user_security_scope` | 예 | — | 사용자 허브의 보안 스코프 |
| `max_connections_per_user` | 아니오 | `5` | 사용자당 WebSocket 연결 수 |
| `queue_multiplier` | 아니오 | `100` | 메시지 큐 = 연결 × 승수 |
| `user_hub_inactivity_timeout` | 아니오 | `7200s` | 허브 정리 전 유휴 시간 |

## 클라이언트 연결 흐름

1. WebSocket 클라이언트가 메타데이터에 `user_id`를 포함하여 연결
2. 중앙 허브가 연결을 검증하고 사용자별 제한 확인
3. 중앙 허브가 사용자에 대한 사용자 허브를 생성하거나 재사용
4. 사용자 허브가 클라이언트에 `welcome` 메시지 전송:

```json
{
    "user_id": "alice",
    "client_count": 1,
    "plugins": [
        { "prefix": "session_", "process_id": "...", "status": "running" },
        { "prefix": "ai_", "process_id": "...", "status": "pending" }
    ]
}
```

플러그인 `status`는 `"not_started"`(등록됨, 시작된 적 없음), `"pending"`(시작 진행 중), `"running"`, `"failed"`, `"stopped"` 중 하나입니다.

## 메시지 라우팅

클라이언트는 `type` 필드가 있는 JSON 메시지를 보냅니다. 사용자 허브는 타입 접두사를 등록된 플러그인과 매칭하여 메시지를 라우팅합니다:

```json
{ "type": "session_get_state", "data": { "key": "value" } }
```

`session_` 접두사는 session 플러그인과 일치합니다. 허브는 접두사를 제거하고 제거된 타입을 토픽으로 하여 플러그인 프로세스에 메시지를 보냅니다:

```lua
-- 프로세스 토픽: "get_state"
-- 페이로드:
{
    conn_pid = client_pid,
    type = "session_get_state",  -- 원래 전체 타입 보존됨
    data = { key = "value" },
    request_id = "...",
    session_id = "..."
}
```

플러그인은 `conn_pid`로 메시지를 다시 보내 응답합니다.

## 플러그인

플러그인은 `meta.type: relay.plugin`을 가진 `process.lua` 엔트리입니다:

```yaml
entries:
  - name: session_plugin
    kind: process.lua
    meta:
      type: relay.plugin
      command_prefix: session_
      auto_start: true
    source: file://session_plugin.lua
    modules: [json, time, logger]
    method: run
```

### 플러그인 메타데이터

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `meta.type` | string | `relay.plugin`이어야 함 |
| `meta.command_prefix` | string | 이 플러그인이 처리하는 메시지 타입 접두사 |
| `meta.auto_start` | boolean | 사용자 허브 초기화 시 시작 |
| `meta.default_host` | string | 프로세스 호스트 재정의 |

### 플러그인 라이프사이클

플러그인은 사용자 허브에서 생성됩니다. 시작 시 플러그인은 다음을 받습니다:

```lua
function run(args)
    local user_id = args.user_id
    local user_metadata = args.user_metadata
    local user_hub_pid = args.user_hub_pid
    local config = args.config
end
```

`session_` 플러그인은 라이프사이클 메시지를 받습니다:

| 메시지 | 시점 |
|---------|------|
| `"resume"` | 첫 번째 클라이언트가 사용자 허브에 연결 |
| `"shutdown"` | 마지막 클라이언트가 사용자 허브에서 연결 해제 |

플러그인은 크래시 시 자동 재시작이 1회 가능합니다. 두 번째 크래시 후 플러그인은 `"failed"`로 표시되고 재시작되지 않습니다.

### 플러그인 구현

플러그인은 프로세스 수신함에서 메시지를 받습니다. 각 메시지에는 토픽(제거된 명령 접두사)과 클라이언트로 응답을 보내기 위한 `conn_pid`를 포함한 원본 메시지 데이터가 담긴 페이로드가 있습니다.

```lua
local json = require("json")

local function handle_message(topic, payload)
    if topic == "get_state" then
        process.send(payload.conn_pid, "ws.message", json.encode({
            type = "session_state",
            data = { status = "active" }
        }))
    end
end

local function run(args)
    local user_id = args.user_id
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local result = channel.select({
            inbox:case_receive(),
            events:case_receive()
        })
        if not result.ok then break end

        if result.channel == inbox then
            local msg = result.value
            local topic = msg:topic()
            local payload = msg:payload():data()

            if topic == "resume" then
                -- 첫 번째 클라이언트 연결됨
            elseif topic == "shutdown" then
                -- 마지막 클라이언트 연결 해제됨
            else
                handle_message(topic, payload)
            end
        elseif result.channel == events then
            local event = result.value
            if event.kind == process.event.CANCEL then
                break
            end
        end
    end
end

return { run = run }
```

## 오류 처리

릴레이는 클라이언트에 구조화된 오류 메시지를 보냅니다:

| 오류 코드 | 설명 |
|------------|-------------|
| `max_connections_reached` | 사용자가 연결 제한에 도달 |
| `missing_user_id` | 연결 메타데이터에 user_id 없음 |
| `hub_creation_failed` | 사용자 허브 생성 실패 |
| `invalid_json` | 메시지 디코딩 오류 |
| `unknown_command` | 메시지에 type 필드 없음 |
| `plugin_not_found` | 명령 접두사와 일치하는 플러그인 없음 |
| `plugin_failed` | 플러그인을 사용할 수 없거나 크래시됨 |

## 허브 라이프사이클

### 사용자 허브 생성

사용자 허브는 사용자의 첫 클라이언트가 연결될 때 요청에 따라 생성됩니다. 허브는 사용자의 보안 액터와 스코프로 생성됩니다.

### 가비지 컬렉션

중앙 허브는 비활성 사용자 허브를 주기적으로 확인합니다. `user_hub_inactivity_timeout`(기본값 2시간)보다 오래 연결된 클라이언트가 없는 허브는 10초 취소 타임아웃과 함께 정상적으로 종료됩니다.

GC 확인 간격은 자동으로 계산됩니다: `inactivity_timeout / 2.5`.

### 보안

중앙 허브는 자체 보안 그룹(`wippy.relay.security:root`) 아래에서 전체 접근 권한으로 실행됩니다. 각 사용자 허브는 설정된 `user_security_scope`로 생성되어 사용자 수준 작업을 격리합니다.

## 내부 토픽

| 토픽 | 방향 | 설명 |
|-------|-----------|-------------|
| `ws.join` | Client → Central/User Hub | 연결 요청 |
| `ws.leave` | Client → Central/User Hub | 연결 해제 |
| `ws.message` | Client → User Hub | WebSocket 메시지 |
| `ws.cancel` | Central → User Hub | 정상 종료 |
| `ws.control` | Central → User Hub | 라우팅 제어 |
| `hub.activity_update` | User Hub → Central | 클라이언트 수 업데이트 |

## 참고

- [WebSocket Relay](../http/websocket-relay.md) - HTTP WebSocket 엔드포인트 설정
- [프로세스 모델](../concepts/process-model.md) - 프로세스 라이프사이클 및 메시징
- [보안](../system/security.md) - 보안 액터 및 스코프
- [프레임워크 개요](overview.md) - 프레임워크 모듈 사용법
