---
title: "Lua 엔트리 종류"
description: "Lua 기반 엔트리 설정: 함수, 프로세스, 워크플로우, 라이브러리."
---

# Lua 엔트리 종류

Lua 엔트리 종류는 소스 코드를 함수, 프로세스, 워크플로우, 라이브러리로 로드하고 실행하는 방식을 정의합니다.

이 페이지는 설정 레퍼런스입니다. YAML 블록은 Wippy 인덱스의 `entries:` 매핑 아래에 둘 부분 엔트리 정의이며 그 자체로 완전한 애플리케이션이 아닙니다. 참조하는 소스 파일, 임포트, 의존성, 프로세스 호스트, 보안 정책은 주변 프로젝트에 있어야 합니다.

## 엔트리 종류

| 종류 | 설명 |
|------|------|
| `function.lua` | 상태 없는 함수, 요청 시 실행 |
| `process.lua` | 상태를 가진 장기 실행 액터 |
| `workflow.lua` | 내구성 있는 워크플로우 (Temporal) |
| `library.lua` | 다른 엔트리가 임포트하는 공유 코드 |

각 종류에는 `wippy pack --bytecode '**'` 또는 `--bytecode 'app:**'` 같은 패턴으로 생성되는 사전 컴파일된 바이트코드 대응 항목(`function.lua.bc`, `library.lua.bc`, `process.lua.bc`, `workflow.lua.bc`)이 있습니다. 작성자는 `.lua` 엔트리를 작성하고, 해당 플래그로 패킹할 때 바이트코드 종류가 생성됩니다.

`module.lua`는 런타임이 생성하는 내장 모듈 정의용으로 예약되어 있습니다. 작성 가능한 소스 엔트리가 아니며 바이트코드 대응 항목도 없습니다.

## 공통 필드

모든 Lua 엔트리는 이 필드를 공유합니다:

| 필드 | 필수 | 설명 |
|------|------|------|
| `name` | 예 | 네임스페이스 내 고유 이름 |
| `kind` | 예 | 위의 Lua 종류 중 하나 |
| `source` | 예 | 인라인 Lua 소스 또는 레지스트리 로드 시 해석되는 `file://path.lua` 참조 |
| `method` | function/process/workflow | 내보낼 함수 (라이브러리는 사용하지 않음) |
| `modules` | 아니오 | `require()`에 허용된 모듈 |
| `imports` | 아니오 | 로컬 모듈로 사용할 다른 엔트리 |
| `meta` | 아니오 | 검색 가능한 메타데이터 |

`pool`은 `function.lua`에만 적용됩니다. `security`는 `function.lua`와 `process.lua`에 적용됩니다.

## `function.lua`

`function.lua` 엔트리는 요청 시 실행되며 각 호출은 독립적으로 처리됩니다.

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

## `process.lua`

`process.lua` 엔트리는 상태를 유지하고 메시지로 통신하는 장기 실행 액터입니다.

```yaml
- name: worker
  kind: process.lua
  source: file://worker.lua
  method: main
  modules:
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

## `workflow.lua`

`workflow.lua` 엔트리는 상태를 Temporal에 지속하는 내구성 워크플로우를 정의합니다.

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

## `library.lua`

`library.lua` 엔트리는 다른 엔트리가 임포트할 수 있는 공유 코드를 제공합니다.

```yaml
- name: helpers
  kind: library.lua
  source: file://helpers.lua
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
```

`channel`, `payload`, `print`, `process`, `subscribe`, `unsubscribe`는 Lua 전역으로 로드되어 `modules:`에 나열할 필요가 없습니다. `require("process")`도 `modules:` 선언 없이 허용됩니다.

나열된 내장 모듈과 `imports`에 선언한 별칭만 사용할 수 있습니다. 모듈 허용 목록은 런타임 기능에 대한 접근을 제한하고, 의존성을 명시하며, 워크플로우를 호환되는 모듈 클래스로 제한합니다.

사용 가능한 모듈은 [Lua 런타임](overview.md)을 참고하세요.

## 임포트

다른 엔트리를 로컬 모듈로 임포트합니다:

```yaml
imports:
  utils: app.lib:utils       # require("utils")
  auth: app.auth:helpers     # require("auth")
```

키가 Lua 코드의 모듈 이름이 됩니다. 값은 엔트리 ID (`namespace:name`)입니다.

## 함수 풀

`pool`로 함수 엔트리의 실행 방식을 설정합니다:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  pool:
    type: adaptive    # explicit; omit to use auto-select (lazy)
    max_size: 16      # cap for elastic growth
```

| 필드 | 풀 | 설명 |
|------|----|------|
| `type` | 모두 | 스케줄러 구현 (아래 표 참조) |
| `workers` | static | 워커 수. 설정 검증 중 값이 있으면 `size`도 양수여야 함 |
| `size` | static | `workers`가 없을 때의 워커 수. `type`이 없고 양수 `size`만 있으면 `inline` 선택 |
| `buffer` | static | 작업 큐 용량 (기본값: `workers * 64`) |
| `max_size` | lazy, adaptive | 탄력적 확장 상한 (명시적 타입의 기본값: 16) |
| `warm_start` | 모두 | 허용되는 설정 플래그지만 이 런타임 릴리스에서는 효과 없음 |

| 유형 | 동작 |
|------|------|
| `inline` | 호출자의 고루틴에서 동기 실행. 호출 간 격리 없음. |
| `lazy` | 유휴 시 워커 없음, 요청 시 생성, 유휴 시 제거. |
| `static` | 채널 기반 고정 크기 풀. 안정 부하에서 예측 가능. |
| `adaptive` | 자동 확장 풀 — 부하 시 증가, 유휴 시 감소. |

`type`을 생략하면 런타임은 다음과 같이 선택합니다:

- `workers`가 양수이면 `static`
- `workers`가 0이고 `size`가 0이거나 `max_size`가 양수이면 `lazy`
- `size`가 양수이고 `max_size`가 0이면 `inline`

자동 선택된 lazy 풀은 `max_size`가 양수이면 그 값을 사용하고, 아니면 기본값 100을 사용합니다. 명시적 `lazy` 또는 `adaptive` 풀의 `max_size` 기본값은 16입니다. 명시적 `static` 풀은 `workers`, `size`, 8 순서로 워커 수를 정하며 기본 버퍼는 선택한 워커 수의 64배입니다.

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
    - registry
```

메타데이터는 레지스트리를 통해 검색 가능합니다:

```lua
local registry = require("registry")
local handlers, err = registry.find({["meta.type"] = "handler"})
if err then
    return nil, err
end
```

쿼리는 일치하는 모든 레지스트리 엔트리를 반환합니다. 이 Lua 코드는 위 `api_handler`처럼 `modules` 목록에 `registry`를 포함한 실행 가능 엔트리에 둡니다.

## 참고

- [엔트리 종류](../guides/entry-kinds.md) - 모든 엔트리 종류 참조
- [컴퓨팅 단위](../concepts/compute-units.md) - 함수 vs 프로세스 vs 워크플로우
- [Lua 런타임](overview.md) - 사용 가능한 모듈
