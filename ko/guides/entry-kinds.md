---
title: "엔트리 종류 참조"
description: "런타임, 스토리지, 네트워킹, 보안, 실행, 라이프사이클 시스템의 Wippy 엔트리 종류를 설명합니다."
---

# 엔트리 종류 참조

이 페이지는 사용 가능한 엔트리 종류를 요약하고 자세한 모듈 및 시스템 레퍼런스로 연결합니다.

YAML과 Lua 블록은 하나의 애플리케이션이 아니라 레퍼런스 조각입니다. 레지스트리 ID, 자격 증명, 데이터 객체, `get_users`나 `delete_user` 같은 헬퍼는 예시입니다. 완전한 반환값과 오류 계약은 연결된 모듈 페이지를 확인하세요.

> 엔트리는 `namespace:name` 형식으로 서로 참조합니다. 레지스트리는 이 참조를 사용해 의존성과 초기화 순서를 결정합니다.

## 참고

- [레지스트리](../concepts/registry.md) - 엔트리 저장 및 해결 방법
- [설정](./configuration.md) - YAML 설정 형식

## Lua 런타임

| Kind | 설명 |
|------|-------------|
| `function.lua` | Lua 함수 진입점 |
| `process.lua` | 장기 실행 Lua 프로세스 |
| `workflow.lua` | Temporal 워크플로우 (결정론적) |
| `library.lua` | 공유 Lua 라이브러리 |
| `module.lua` | Lua 모듈 인터페이스 |
| `function.lua.bc` | 사전 컴파일된 함수 바이트코드 |
| `library.lua.bc` | 사전 컴파일된 라이브러리 바이트코드 |
| `process.lua.bc` | 사전 컴파일된 프로세스 바이트코드 |
| `workflow.lua.bc` | 사전 컴파일된 워크플로우 바이트코드 |

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
  imports:
    utils: app.lib:helpers  # Import another entry as module
```

<tip>
<code>imports</code>를 사용하여 다른 Lua 엔트리를 참조하세요. 코드에서 <code>require("alias_name")</code>으로 사용할 수 있습니다.
</tip>

## HTTP 서비스

| Kind | 설명 |
|------|-------------|
| `http.service` | HTTP 서버 (포트 바인딩) |
| `http.router` | 라우트 프리픽스와 미들웨어 |
| `http.endpoint` | HTTP 엔드포인트 (메서드 + 경로) |
| `http.static` | 정적 파일 서빙 |

```yaml
# HTTP server
- name: gateway
  kind: http.service
  addr: ":8080"
  lifecycle:
    auto_start: true

# Router with middleware
- name: api
  kind: http.router
  meta:
    server: gateway
  prefix: /api
  middleware:
    - cors
    - ratelimit

# Endpoint
- name: users_list
  kind: http.endpoint
  meta:
    router: app:api
  method: GET
  path: /users
  func: list_handler
```

**Lua API:** [HTTP 모듈](../lua/http/http.md) 참조

```lua
local http = require("http")
local req = http.request()
local resp = http.response()

resp:set_status(200)
resp:write_json({users = get_users()})
```

## 데이터베이스

| Kind | 설명 |
|------|-------------|
| `db.sql.sqlite` | SQLite 데이터베이스 |
| `db.sql.postgres` | PostgreSQL 데이터베이스 |
| `db.sql.mysql` | MySQL 데이터베이스 |
| `db.cdc.postgres` | Postgres Change Data Capture 소스 ([CDC](../system/cdc.md) 참조) |

### SQLite

```yaml
- name: database
  kind: db.sql.sqlite
  file: "./data/app.db"
  lifecycle:
    auto_start: true

# In-memory for testing
- name: testdb
  kind: db.sql.sqlite
  file: ":memory:"
```

### PostgreSQL

```yaml
- name: database
  kind: db.sql.postgres
  host: localhost
  port: 5432
  database: dbname
  username: user
  password: pass
  options:
    sslmode: disable
  pool:
    max_open: 25
    max_idle: 5
    max_lifetime: "30m"
  lifecycle:
    auto_start: true
```

### MySQL

```yaml
- name: database
  kind: db.sql.mysql
  host: localhost
  port: 3306
  database: dbname
  username: user
  password: pass
  options:
    parseTime: "true"
  lifecycle:
    auto_start: true
```

`${env:NAME}` 비밀 참조, TLS 옵션 및 연결 풀 튜닝은 [Database](../system/database.md)를 참고하세요. 데이터베이스 엔트리 뒤의 환경 변수 기반 값이 변경되면 풀이 라이브로 교체됩니다. 사용 중인 연결은 이전 연결 설정으로 작업을 마칩니다.

**Lua API:** [SQL 모듈](../lua/storage/sql.md) 참조

```lua
local sql = require("sql")
local db, err = sql.get("app:database")

local rows, err = db:query("SELECT * FROM users WHERE id = ?", {user_id})
db:execute("INSERT INTO logs (msg) VALUES (?)", {message})
```


## 키-값 스토어

| Kind | 설명 |
|------|-------------|
| `store.memory` | 인메모리 키-값 스토어 |
| `store.sql` | SQL 기반 키-값 스토어 |
| `store.kv.raft` | 클러스터 복제, 강한 일관성 KV (공유 Raft) |
| `store.kv.crdt` | 클러스터 복제, 최종 일관성 KV (gossip/CRDT) |

```yaml
# Memory store
- name: cache
  kind: store.memory
  lifecycle:
    auto_start: true

# SQL-backed store
- name: persistent_store
  kind: store.sql
  database: app:database
  table_name: kv_store
  lifecycle:
    auto_start: true

# Cluster-replicated store (requires clustering)
- name: deployments
  kind: store.kv.raft
  namespace: deploy
```

`store.kv.*` 종류는 [클러스터링](./cluster.md)이 활성화되어 있어야 합니다. 일관성 트레이드오프는 [스토어](../system/store.md#cluster-kv-stores)를 참고하세요.

**Lua API:** [Store 모듈](../lua/storage/store.md) 참조

```lua
local store = require("store")
local s, err = store.get("app:cache")

s:set("user:123", user_data, 3600)  -- TTL in seconds
local data = s:get("user:123")
```

## 큐

| Kind | 설명 |
|------|-------------|
| `queue.driver.memory` | 인메모리 큐 드라이버 |
| `queue.driver.amqp` | AMQP (RabbitMQ) 드라이버 |
| `queue.driver.sqs` | AWS SQS 드라이버 |
| `queue.queue` | 큐 선언 |
| `queue.consumer` | 큐 컨슈머 |

```yaml
# Driver
- name: queue_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true

# Queue
- name: jobs
  kind: queue.queue
  driver: queue_driver

# Consumer
- name: job_consumer
  kind: queue.consumer
  queue: app:jobs
  func: job_handler
  concurrency: 4
  prefetch: 10
  lifecycle:
    auto_start: true
```

**Lua API:** [Queue 모듈](../lua/storage/queue.md) 참조

```lua
local queue = require("queue")

-- Publish a message
queue.publish("app:jobs", {task = "process", id = 123})

-- In a consumer handler: the message body is the handler's argument
local function main(data)
    -- access delivery metadata via the current message
    local msg = queue.message()
    local id = msg:id()
    local priority = msg:header("priority")
    msg:ack()
end
```

<note>
컨슈머의 <code>func</code>는 메시지 본문을 인수로 받아 메시지마다 한 번 호출됩니다. 전달 메타데이터와 수명 주기 작업에는 핸들러 안에서 <code>queue.message()</code>를 사용하세요.
</note>

## 프로세스 관리

| Kind | 설명 |
|------|-------------|
| `process.host` | 프로세스 실행 호스트 |
| `process.service` | 슈퍼바이즈드 프로세스 (process.lua 래핑) |
| `terminal.host` | 터미널/CLI 호스트 |
| `pg.scope` | 프로세스 그룹 스코프 ([프로세스 그룹](../system/process-groups.md) 참조) |

```yaml
# Process host (where processes run)
- name: processes
  kind: process.host
  host:
    workers: 32             # Worker goroutines (default: NumCPU)
    queue_size: 1024        # Global queue capacity
    local_queue_size: 256   # Per-worker queue
  lifecycle:
    auto_start: true

# Process definition
- name: worker_process
  kind: process.lua
  source: file://worker.lua
  method: main

# Supervised process service
- name: worker
  kind: process.service
  process: app:worker_process
  host: app:processes
  input: ["arg1", "arg2"]
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10

- name: terminal
  kind: terminal.host
  lifecycle:
    auto_start: true
```

<tip>
자동 재시작이 필요한 감독 서비스로 프로세스를 실행할 때 <code>process.service</code>를 사용하세요. <code>process</code> 필드는 <code>process.lua</code> 엔트리를 참조합니다.
</tip>

라이브 `process.host` 엔트리를 업데이트하면 `host.workers`가 제자리에서 재조정됩니다 — 실행 중인 프로세스, PID, 큐는 보존됩니다. `host.queue_size`, `host.local_queue_size`, `lifecycle`은 생성 시 고정됩니다: 이를 변경하는 라이브 업데이트는 거부되며, 워커가 어피니티로 관리되는 호스트에서 워커 수를 조정하는 것도 마찬가지로 거부됩니다.

## Temporal (워크플로우)

| Kind | 설명 |
|------|-------------|
| `temporal.client` | Temporal 클라이언트 연결 |
| `temporal.worker` | Temporal 워커 |

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  namespace: "default"
  auth:
    type: none  # none, api_key, mtls
  lifecycle:
    auto_start: true

- name: temporal_worker
  kind: temporal.worker
  client: temporal_client
  task_queue: "main-queue"
  lifecycle:
    auto_start: true
```

## 클라우드 스토리지

| Kind | 설명 |
|------|-------------|
| `config.aws` | AWS 설정 |
| `cloudstorage.s3` | S3 버킷 접근 |

```yaml
- name: aws
  kind: config.aws
  region: "us-east-1"
  access_key_id: ${env:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:AWS_SECRET_ACCESS_KEY}

- name: uploads
  kind: cloudstorage.s3
  config: app:aws
  bucket: "my-uploads"
  endpoint: ""  # Optional, for S3-compatible services
```

**Lua API:** [클라우드 스토리지 모듈](../lua/storage/cloud.md) 참조

```lua
local cloudstorage = require("cloudstorage")
local storage, err = cloudstorage.get("app:uploads")

storage:upload_object("files/doc.pdf", file_content)
local url = storage:presigned_get_url("files/doc.pdf", {expiration = 3600})  -- seconds, default 3600
```

<tip>
MinIO나 DigitalOcean Spaces 같은 S3 호환 서비스에 연결하려면 <code>endpoint</code>를 사용하세요.
</tip>

## 파일 시스템

| Kind | 설명 |
|------|-------------|
| `fs.directory` | 디렉토리 접근 |
| `fs.embed` | 읽기 전용 내장 파일 시스템 |

```yaml
- name: data_dir
  kind: fs.directory
  directory: "./data"
  auto_init: true   # Create if not exists
  mode: "0755"      # Permissions
```

**Lua API:** [파일시스템 모듈](../lua/storage/filesystem.md) 참조

```lua
local fs = require("fs")
local filesystem, err = fs.get("app:data_dir")

local file = filesystem:open("output.txt", "w")
file:write("Hello, World!")
file:close()
```

## 환경

| Kind | 설명 |
|------|-------------|
| `env.storage.memory` | 인메모리 환경 스토리지 |
| `env.storage.file` | 파일 기반 환경 스토리지 |
| `env.storage.os` | OS 환경 |
| `env.storage.static` | 읽기 전용 정적 키-값 스토리지 |
| `env.storage.router` | 환경 라우터 (다중 스토리지) |
| `env.variable` | 환경 변수 |

```yaml
- name: os_env
  kind: env.storage.os

- name: file_env
  kind: env.storage.file
  file_path: ".env"
  auto_create: true

- name: defaults
  kind: env.storage.static
  values:
    PUBLIC_API_HOST: "https://api.example.com"
    APP_ENV: "production"

- name: app_env
  kind: env.storage.router
  storages:
    - app:os_env
    - app:file_env
    - app:defaults
```

**Lua API:** [Env 모듈](../lua/system/env.md) 참조

```lua
local env = require("env")

local api_key = env.get("API_KEY")
env.set("CACHE_TTL", "3600")
```

<note>
라우터는 순서대로 스토리지를 확인합니다. 읽기 시 첫 번째로 일치하는 값이 사용되고, 쓰기는 첫 번째 쓰기 가능한 스토리지에 저장됩니다.
</note>

## 템플릿

| Kind | 설명 |
|------|-------------|
| `template.jet` | 개별 Jet 템플릿 |
| `template.set` | 템플릿 세트 설정 |

```yaml
# Template set with engine configuration
- name: templates
  kind: template.set
  engine:
    development_mode: false
    extensions:
      - ".jet"
      - ".html.jet"

# Individual template
- name: email_template
  kind: template.jet
  source: file://templates/email.jet
  set: app:templates
```

**Lua API:** [템플릿 모듈](../lua/text/template.md) 참조

```lua
local templates = require("templates")
local set, err = templates.get("app:templates")

local html = set:render("email", {
    user = "Alice",
    message = "Welcome!"
})
```

## 보안

| Kind | 설명 |
|------|-------------|
| `security.policy` | 조건이 있는 보안 정책 |
| `security.policy.expr` | 표현식 기반 정책 |
| `security.token_store` | 토큰 스토리지 |

```yaml
# Condition-based policy
- name: admin_policy
  kind: security.policy
  policy:
    actions: "*"
    resources: "*"
    effect: allow
    conditions:
      - field: "actor.meta.role"
        operator: eq
        value: "admin"

# Expression-based policy
- name: owner_policy
  kind: security.policy.expr
  policy:
    actions: "*"
    resources: "*"
    effect: allow
    expression: 'actor.id == meta.owner_id || actor.meta.role == "admin"'
```

**Lua API:** [보안 모듈](../lua/security/security.md) 참조

```lua
local security = require("security")

-- Check permission before action
if security.can("delete", "users", {user_id = id}) then
    delete_user(id)
end

-- Get current actor
local actor = security.actor()
```

<warning>
정책 순서는 접근 여부를 결정하지 않습니다. 스코프는 정책 결정을 결합하며, 일치하는 <code>deny</code>는 일치하는 <code>allow</code> 정책보다 우선하고 평가를 즉시 중단할 수 있습니다. 일치하는 정책이 없으면 허용이 아니라 미정 상태가 됩니다.
</warning>

## 계약 (의존성 주입)

| Kind | 설명 |
|------|-------------|
| `contract.definition` | 메서드 명세가 있는 인터페이스 |
| `contract.binding` | 계약 메서드를 함수 구현에 매핑 |

```yaml
# Define the contract interface
- name: greeter
  kind: contract.definition
  methods:
    - name: greet
      description: Returns a greeting message
    - name: greet_with_name
      description: Returns a personalized greeting
      input_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}
      output_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}

# Implementation functions
- name: greeter_greet
  kind: function.lua
  source: file://greeter_greet.lua
  method: main

- name: greeter_greet_name
  kind: function.lua
  source: file://greeter_greet_name.lua
  method: main

# Bind contract methods to implementations
- name: greeter_impl
  kind: contract.binding
  contracts:
    - contract: app:greeter
      default: true
      methods:
        greet: app:greeter_greet
        greet_with_name: app:greeter_greet_name
```

Lua에서 사용:

```lua
local contract = require("contract")

-- Open binding by ID
local greeter, err = contract.open("app:greeter_impl")

-- Call methods
local result = greeter:greet()
local personalized = greeter:greet_with_name("Alice")

-- Check if instance implements contract
local is_greeter = contract.is(greeter, "app:greeter")
```

**Lua API:** [계약 모듈](../lua/core/contract.md) 참조

<tip>
바인딩 ID 없이 계약을 열 때 기본으로 사용하려면 하나의 바인딩에 <code>default: true</code>를 설정하세요(<code>context_required</code> 필드가 설정되지 않은 경우에만 작동).
</tip>

## 실행

| Kind | 설명 |
|------|-------------|
| `exec.native` | 네이티브 명령 실행 |
| `exec.docker` | Docker 컨테이너 실행 |

```yaml
- name: native_exec
  kind: exec.native
  default_work_dir: "/app"
  command_whitelist:
    - "ls"
    - "cat"

- name: docker_exec
  kind: exec.docker
  image: "python:3.11-slim"
  default_work_dir: "/workspace"
  auto_remove: true
  memory_limit: 536870912  # 512MB
  command_whitelist:
    - "python"
```

## WASM 런타임

| Kind | 설명 |
|------|-------------|
| `function.wat` | WebAssembly 함수 (WAT 텍스트 형식) |
| `function.wasm` | WebAssembly 함수 (바이너리) |
| `process.wasm` | WebAssembly 프로세스 |

```yaml
- name: sum
  kind: function.wasm
  source: file://sum.wasm
  transport: payload   # or wasi-http
```

[WASM 개요](../wasm/overview.md) 참조.

## 네트워크

| Kind | 설명 |
|------|-------------|
| `network` | 기본 네트워크 오버레이 |
| `network.socks5` | SOCKS5 프록시 오버레이 |
| `network.i2p` | I2P 네트워크 오버레이 |
| `network.tailscale` | Tailscale 오버레이 |

`http.service`에서는 `network:`를 통해, `funcs`/`process`에서는 `network` 옵션을 통해, `http_client`에서는 `overlay_network` 옵션을 통해 참조됩니다. [네트워크](../system/network.md)를 참고하세요.

## 레지스트리 프리미티브

| Kind | 설명 |
|------|-------------|
| `registry.entry` | 엔트리 디스크립터 (내부) |
| `ns.definition` | 네임스페이스 정의 |
| `ns.requirement` | 네임스페이스 요구사항 선언 |
| `ns.dependency` | 네임스페이스 의존성 |

`registry.entry`는 내부 디스크립터입니다. 작성자는 `_index.yaml`에 `ns.definition`, `ns.requirement`, `ns.dependency` 엔트리를 직접 정의합니다. 파일의 `version`과 `namespace` 필드는 이러한 엔트리를 생성하지 않습니다.

## 라이프사이클 설정

슈퍼바이저가 관리하는 서비스 엔트리는 라이프사이클 설정을 제공합니다. 아래 블록은 이를 지원하는 서비스 엔트리 안에 둡니다:

```yaml
lifecycle:
  auto_start: true          # Start automatically
  start_timeout: 10s        # Max startup time
  stop_timeout: 10s         # Max shutdown time
  stable_threshold: 5s      # Uninterrupted run time before retry accounting resets
  requires:
    - app:database
  restart:                  # Retry policy
    initial_delay: 1s
    max_delay: 90s
    backoff_factor: 2.0
    max_attempts: 0         # 0 = infinite
```

<note>
<code>requires</code>로 서비스 의존성을 선언하세요. 슈퍼바이저는 의존하는 서비스보다 먼저 필수 서비스를 시작하며, 필수 서비스가 실행 중이면 준비된 것으로 간주합니다. <code>depends_on</code>도 레거시 표기로 허용되지만 새 매니페스트는 <code>requires</code>를 사용해야 합니다.
</note>

## 엔트리 참조 형식

엔트리는 `namespace:name` 형식을 사용하여 참조됩니다:

```yaml
# Definition
namespace: app.users
entries:
  - name: handler
    kind: function.lua

# Reference from another entry
func: app.users:handler
```

## 엔트리 재정의 {id="overriding-entries"}

`override:` 설정 섹션이나 `-o` CLI 플래그를 사용하면, 소스 YAML을 편집하지 않고도 실행 시 엔트리의 모든 필드(`kind` 포함)를 재정의할 수 있습니다. 키는 `namespace:entry:path` 형식을 사용합니다:

```yaml
override:
  app:gateway:addr: ":9090"        # data field (a bare path targets data.*)
  app:worker:meta.priority: high    # meta field
  app:db:kind: db.sql.postgres      # the entry's typed kind
  app:db:data.kind: custom          # a payload field literally named "kind"
```

| 경로 | 대상 |
|------|---------|
| `kind` | 엔트리의 타입 지정 kind(비어 있지 않은 문자열이어야 함) |
| `data.<field>` 또는 단순 `<field>` | 엔트리 data 페이로드의 필드 |
| `meta.<field>` | 엔트리 메타데이터의 필드 |

동일한 재정의를 CLI에서도 적용할 수 있습니다:

```bash
wippy run -o app:db:kind=db.sql.postgres -o app:gateway:addr=:9090
```

CLI(`-o`) 값은 형태에 따라 변환됩니다(`true`/`false`는 bool로, 숫자는 숫자로, 그 외에는 string). `override:` 섹션 값은 YAML 타입을 그대로 유지합니다. 엔트리 대신 전역 [설정](./configuration.md) 섹션을 재정의하려면 `--set`을 사용하세요.
