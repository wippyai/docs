# Lua 엔트리 종류

Lua 기반 엔트리 설정: 함수, 프로세스, 워크플로우, 라이브러리.

## 엔트리 종류

| 종류 | 설명 |
|------|------|
| `function.lua` | 상태 없는 함수, 요청 시 실행 |
| `process.lua` | 상태를 가진 장기 실행 액터 |
| `workflow.lua` | 내구성 있는 워크플로우 (Temporal) |
| `library.lua` | 다른 엔트리가 임포트하는 공유 코드 |

## 공통 필드

모든 Lua 엔트리는 이 필드를 공유합니다:

| 필드 | 필수 | 설명 |
|------|------|------|
| `name` | 예 | 네임스페이스 내 고유 이름 |
| `kind` | 예 | 위의 Lua 종류 중 하나 |
| `source` | 예 | Lua 파일 경로 (`file://path.lua`) |
| `method` | 예 | 내보낼 함수 |
| `modules` | 아니오 | `require()`에 허용된 모듈 |
| `imports` | 아니오 | 로컬 모듈로 사용할 다른 엔트리 |
| `meta` | 아니오 | 검색 가능한 메타데이터 |

## function.lua

요청 시 호출되는 상태 없는 함수. 각 호출은 독립적입니다.

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
```

용도: HTTP 핸들러, 데이터 변환, 유틸리티.

## process.lua

메시지 간 상태를 유지하는 장기 실행 액터. 메시지 전달을 통해 통신합니다.

```yaml
- name: worker
  kind: process.lua
  source: file://worker.lua
  method: main
  modules:
    - process
    - channel
    - sql
```

용도: 백그라운드 워커, 서비스 데몬, 상태를 가진 액터.

슈퍼바이즈되는 서비스로 실행하려면:

```yaml
- name: worker_service
  kind: process.service
  process: app:worker
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

## workflow.lua

재시작에도 유지되는 내구성 있는 워크플로우. 상태는 Temporal에 지속됩니다.

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - workflow
    - time
```

용도: 다단계 비즈니스 프로세스, 장기 실행 오케스트레이션.

## library.lua

다른 엔트리가 임포트할 수 있는 공유 코드.

```yaml
- name: helpers
  kind: library.lua
  source: file://helpers.lua
  method: main
  modules:
    - json
    - base64
```

다른 엔트리에서 `imports`로 참조합니다:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  imports:
    helpers: app.lib:helpers
```

Lua 코드에서:

```lua
local helpers = require("helpers")
helpers.format_date(timestamp)
```

## 모듈

`modules` 필드는 `require()`로 로드할 수 있는 모듈을 제어합니다:

```yaml
modules:
  - http
  - json
  - sql
  - process
  - channel
```

나열된 모듈만 사용 가능합니다. 이는 다음을 제공합니다:
- 보안: 시스템 모듈 접근 방지
- 명시적 의존성: 코드가 필요한 것이 명확
- 결정론: 워크플로우는 결정론적 모듈만 받음

사용 가능한 모듈은 [Lua 런타임](lua-overview.md)을 참조하세요.

## 임포트

다른 엔트리를 로컬 모듈로 임포트합니다:

```yaml
imports:
  utils: app.lib:utils       # require("utils")
  auth: app.auth:helpers     # require("auth")
```

키가 Lua 코드의 모듈 이름이 됩니다. 값은 엔트리 ID (`namespace:name`)입니다.

## 풀 설정

함수의 실행 풀을 설정합니다:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  pool:
    type: inline    # 호출자 컨텍스트에서 실행
```

풀 유형:
- `inline` - 호출자 컨텍스트에서 실행 (HTTP 핸들러의 기본값)

## 메타데이터

라우팅 및 발견을 위해 `meta`를 사용합니다:

```yaml
- name: api_handler
  kind: function.lua
  meta:
    type: handler
    version: "2.0"
    tags: [api, users]
  source: file://api.lua
  method: handle
  modules:
    - http
    - json
```

메타데이터는 레지스트리를 통해 검색 가능합니다:

```lua
local registry = require("registry")
local handlers = registry.find({type = "handler"})
```

## 참고

- [엔트리 종류](guide-entry-kinds.md) - 모든 엔트리 종류 참조
- [컴퓨팅 단위](concept-compute-units.md) - 함수 vs 프로세스 vs 워크플로우
- [Lua 런타임](lua-overview.md) - 사용 가능한 모듈
