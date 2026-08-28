---
title: "Dataflow: 내구성 있는 DAG 실행"
description: "지속 상태, 자동 마이그레이션, 두 개의 함수 노드를 갖춘 작은 wippy/dataflow 워크플로를 만들고 실행합니다."
---

# Dataflow: 내구성 있는 DAG 실행

**분류: 실행 가능한 튜토리얼.** 이 페이지에서는 외부 제공자가 필요 없는 완전한 `wippy/dataflow` 프로젝트를 만듭니다. 임베딩이나 LLM은 사용하지 않습니다. 해당 사용 사례는 [검색 증강 생성](tutorials/rag.md)을 참조하세요.

워크플로는 하나의 입력을 두 함수 노드로 전달합니다.

```text
{ values = { 2, 4, 6 } } -> double -> summarize -> { count = 3, total = 24 }
```

Dataflow는 워크플로, 노드, 명령, 깨우기, 활성화를 SQL에 영속화합니다. 명령은 마이그레이션 부트로더가 해당 테이블을 만들 때까지 기다린 뒤 흐름을 시작합니다.

## 사전 요구 사항

- 소스 디렉터리가 `./src`인 Wippy 프로젝트
- Wippy 런타임 `v0.3.32a` 이상
- 최초 의존성 설치 시 모듈 레지스트리에 접근할 수 있는 환경

모델 제공자나 API 키는 필요하지 않습니다.

## 프로젝트 구조

```text
dataflow-demo/
├── wippy.lock                 # generated
└── src/
    ├── _index.yaml
    ├── double.lua
    ├── summarize.lua
    └── run.lua
```

## 런타임 구성

`src/_index.yaml`을 만듭니다.

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./.wippy/dataflow.db
    lifecycle:
      auto_start: true

  - name: env_storage
    kind: env.storage.file
    file_path: ./.wippy/dataflow.env
    auto_create: true

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  # Dataflow includes session views, so its standalone configuration supplies
  # the router those transitive entries target. The HTTP service need not start.
  - name: gateway
    kind: http.service
    addr: ":18080"
    lifecycle:
      auto_start: false

  - name: api.public
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api

  - name: dep.dataflow
    kind: ns.dependency
    component: wippy/dataflow
    version: "0.7.6"
    parameters:
      - name: userspace.dataflow:target_db
        value: app:db
      - name: userspace.dataflow:process_host
        value: app:processes
      - name: wippy.migration:app_db
        value: app:db

  - name: dep.security
    kind: ns.dependency
    component: wippy/security
    version: "*"

  - name: dep.bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: wippy.bootloader:application_host
        value: app:processes
      - name: wippy.bootloader:env_storage
        value: app:env_storage

  - name: dep.llm
    kind: ns.dependency
    component: wippy/llm
    version: "*"
    parameters:
      - name: wippy.llm:process_host
        value: app:processes
      - name: wippy.llm:env_storage
        value: app:env_storage

  - name: dep.session
    kind: ns.dependency
    component: wippy/session
    version: "*"
    parameters:
      - name: wippy.session:database_resource
        value: app:db
      - name: wippy.session:api_router
        value: app:api.public
      - name: wippy.session:env_storage
        value: app:env_storage
      - name: wippy.session:delegation_func_id
        value: userspace.dataflow.session:delegate

  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: wippy.views:api_router
        value: app:api.public
      - name: wippy.views:env_storage
        value: app:env_storage

  - name: demo_policy
    kind: security.policy
    policy:
      actions: "*"
      resources: "*"
      effect: allow

  - name: double
    kind: function.lua
    source: file://double.lua
    method: handler

  - name: summarize
    kind: function.lua
    source: file://summarize.lua
    method: handler

  - name: run
    kind: process.lua
    meta:
      command:
        name: dataflow-demo
        short: Run the Dataflow tutorial DAG
        security:
          actor:
            id: app:dataflow-demo
          policies:
            - app:demo_policy
    source: file://run.lua
    method: main
    modules:
      - io
      - sql
      - time
    imports:
      flow: userspace.dataflow.flow:flow
```

마이그레이션 엔트리는 `wippy/dataflow`가 소유합니다. `wippy/migration` 의존성은 전이적으로 포함되며, `wippy/bootloader`는 런타임 시작 중에 마이그레이션 부트로더를 실행합니다. 위의 명시적 매개변수는 두 시스템을 모두 `app:db`에 바인딩합니다.

광범위한 정책은 이 격리된 튜토리얼이 워크플로 동작에 집중하도록 합니다. 프로덕션 명령에서는 워크플로에 필요한 정확한 함수, 데이터베이스, 프로세스 작업만 허용하는 정책으로 교체하세요.

## 노드 구현

`src/double.lua`를 만듭니다.

```lua
local function handler(input)
    local result = { values = {} }
    for _, value in ipairs(input.values or {}) do
        table.insert(result.values, value * 2)
    end
    return result
end

return { handler = handler }
```

`src/summarize.lua`를 만듭니다.

```lua
local function handler(input)
    local total = 0
    for _, value in ipairs(input.values or {}) do
        total = total + value
    end
    return { count = #(input.values or {}), total = total }
end

return { handler = handler }
```

## 흐름 빌드 및 실행

`src/run.lua`를 만듭니다.

```lua
local io = require("io")
local sql = require("sql")
local time = require("time")
local flow = require("flow")

local function wait_for_schema()
    for _ = 1, 100 do
        local db, err = sql.get("app:db")
        if not err then
            local rows, query_err = db:query(
                "SELECT name FROM sqlite_master " ..
                "WHERE type='table' AND name='dataflows'"
            )
            db:release()
            if not query_err and rows and #rows > 0 then
                return true
            end
        end
        time.sleep("100ms")
    end
    return nil, "Dataflow migrations did not finish within 10 seconds"
end

local function main()
    local ready, ready_err = wait_for_schema()
    if not ready then
        io.print("dataflow failed: " .. ready_err)
        return 1
    end

    local result, err = flow.create()
        :with_title("Double and summarize")
        :with_input({ values = { 2, 4, 6 } })
        :func("app:double")
        :as("double")
        :to("summarize", "default")
        :func("app:summarize")
        :as("summarize")
        :run()

    if err then
        io.print("dataflow failed: " .. tostring(err))
        return 1
    end

    io.print(string.format("count=%d total=%d", result.count, result.total))
    return 0
end

return { main = main }
```

잠금 파일을 초기화하고 의존성 그래프를 해석해 설치한 다음, 콘솔 로그를 활성화하여 이름 있는 명령을 실행합니다.

```bash
wippy init
wippy update
wippy install
wippy run -c dataflow-demo
```

처음 실행할 때 부트로더가 Dataflow 마이그레이션을 적용합니다. 그런 다음 명령은 다음을 출력합니다.

```text
count=3 total=24
```

이후 실행에서는 마이그레이션이 이미 적용되었다고 보고하고 새로운 영속 워크플로를 실행합니다.

## 영속성 확인

SQLite 파일은 `./.wippy/dataflow.db`입니다. 실행에 성공하면 이 파일에는 워크플로, 노드, 데이터, 커밋, 깨우기, 활성화 저장소를 포함하여 모듈이 소유하는 Dataflow 테이블이 들어 있습니다. 애플리케이션은 이 테이블에 직접 쓰지 말고 Dataflow 클라이언트 또는 Keeper를 통해 검사해야 합니다.

호출자가 워크플로 ID를 즉시 받아야 한다면 `:run()` 대신 `:start()`를 사용합니다. 상태나 출력을 읽거나 비동기 워크플로를 취소, 종료, 복구 또는 신호 처리하려면 Dataflow 클라이언트를 사용하세요.

## 다음 단계

- [Dataflow 프레임워크](../framework/dataflow.md) — 라우팅, 병렬 노드, 순환, 에이전트, 신호, 클라이언트 API
- [검색 증강 생성](tutorials/rag.md) — 임베딩 기반 검색
- [MCP를 통한 Keeper](./keeper-mcp.md) — MCP 클라이언트에서 실행 중인 워크플로 검사
