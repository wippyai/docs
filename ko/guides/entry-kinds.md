# 엔트리 종류 참조

Wippy에서 사용 가능한 모든 엔트리 종류의 전체 참조입니다.

> 엔트리는 `namespace:name` 형식을 사용하여 서로 참조합니다. 레지스트리는 이러한 참조를 기반으로 의존성을 자동으로 연결하여 리소스가 올바른 순서로 초기화되도록 합니다.

## 참고

- [레지스트리](concept-registry.md) - 엔트리 저장 및 해결 방법
- [설정](guide-configuration.md) - YAML 설정 형식

## Lua 런타임

| Kind | 설명 |
|------|-------------|
| `function.lua` | Lua 함수 진입점 |
| `process.lua` | 장기 실행 Lua 프로세스 |
| `workflow.lua` | Temporal 워크플로우 (결정론적) |
| `library.lua` | 공유 Lua 라이브러리 |

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
  imports:
    utils: app.lib:helpers  # 다른 엔트리를 모듈로 가져오기
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
# HTTP 서버
- name: gateway
  kind: http.service
  addr: ":8080"
  lifecycle:
    auto_start: true

# 미들웨어가 있는 라우터
- name: api
  kind: http.router
  meta:
    server: gateway
  prefix: /api
  middleware:
    - cors
    - rate_limit

# 엔드포인트
- name: users_list
  kind: http.endpoint
  meta:
    router: app:api
  method: GET
  path: /users
  func: list_handler
```

**Lua API:** [HTTP 모듈](lua-http.md) 참조

```lua
local http = require("http")
local req = http.request()
local resp = http.response()

resp:status(200):json({users = get_users()})
```

## 데이터베이스

| Kind | 설명 |
|------|-------------|
| `db.sql.sqlite` | SQLite 데이터베이스 |
| `db.sql.postgres` | PostgreSQL 데이터베이스 |
| `db.sql.mysql` | MySQL 데이터베이스 |
| `db.sql.mssql` | Microsoft SQL Server |
| `db.sql.oracle` | Oracle 데이터베이스 |

### SQLite

```yaml
- name: database
  kind: db.sql.sqlite
  file: "./data/app.db"
  lifecycle:
    auto_start: true

# 테스트용 인메모리
- name: testdb
  kind: db.sql.sqlite
  file: ":memory:"
```

### PostgreSQL

```yaml
- name: database
  kind: db.sql.postgres
  dsn: "postgres://user:pass@localhost:5432/dbname?sslmode=disable"
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
  dsn: "user:pass@tcp(localhost:3306)/dbname?parseTime=true"
  lifecycle:
    auto_start: true
```

### MSSQL

```yaml
- name: database
  kind: db.sql.mssql
  dsn: "sqlserver://user:pass@localhost:1433?database=dbname"
  lifecycle:
    auto_start: true
```

**Lua API:** [SQL 모듈](lua-sql.md) 참조

```lua
local sql = require("sql")
local db, err = sql.get("app:database")

local rows, err = db:query("SELECT * FROM users WHERE id = ?", user_id)
db:execute("INSERT INTO logs (msg) VALUES (?)", message)
```


## 키-값 스토어

| Kind | 설명 |
|------|-------------|
| `store.memory` | 인메모리 키-값 스토어 |
| `store.sql` | SQL 기반 키-값 스토어 |

```yaml
# 메모리 스토어
- name: cache
  kind: store.memory
  lifecycle:
    auto_start: true

# SQL 기반 스토어
- name: persistent_store
  kind: store.sql
  database: app:database
  table: kv_store
  lifecycle:
    auto_start: true
```

**Lua API:** [Store 모듈](lua-store.md) 참조

```lua
local store = require("store")
local s, err = store.get("app:cache")

s:set("user:123", user_data, 3600)  -- TTL(초)
local data = s:get("user:123")
```

## 큐

| Kind | 설명 |
|------|-------------|
| `queue.driver.memory` | 인메모리 큐 드라이버 |
| `queue.queue` | 큐 선언 |
| `queue.consumer` | 큐 컨슈머 |

```yaml
# 드라이버
- name: queue_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true

# 큐
- name: jobs
  kind: queue.queue
  driver: queue_driver

# 컨슈머
- name: job_consumer
  kind: queue.consumer
  queue: app:jobs
  func: job_handler
  concurrency: 4
  prefetch: 10
  lifecycle:
    auto_start: true
```

**Lua API:** [Queue 모듈](lua-queue.md) 참조

```lua
local queue = require("queue")

-- 메시지 발행
queue.publish("app:jobs", {task = "process", id = 123})

-- 컨슈머 핸들러에서 현재 메시지 접근
local msg = queue.message()
local data = msg:body_json()
```

<note>
컨슈머의 <code>func</code>는 각 메시지에 대해 호출됩니다. 핸들러 내에서 <code>queue.message()</code>를 사용하여 현재 메시지에 접근하세요.
</note>

## 프로세스 관리

| Kind | 설명 |
|------|-------------|
| `process.host` | 프로세스 실행 호스트 |
| `process.service` | 슈퍼바이즈드 프로세스 (process.lua 래핑) |
| `terminal.host` | 터미널/CLI 호스트 |

```yaml
# 프로세스 호스트 (프로세스가 실행되는 곳)
- name: processes
  kind: process.host
  host:
    workers: 32             # 워커 고루틴 (기본값: NumCPU)
    queue_size: 1024        # 글로벌 큐 용량
    local_queue_size: 256   # 워커별 큐
  lifecycle:
    auto_start: true

# 프로세스 정의
- name: worker_process
  kind: process.lua
  source: file://worker.lua
  method: main

# 슈퍼바이즈드 프로세스 서비스
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
자동 재시작이 있는 슈퍼바이즈드 서비스로 프로세스를 실행해야 할 때 <code>process.service</code>를 사용하세요. <code>process</code> 필드는 <code>process.lua</code> 엔트리를 참조합니다.
</tip>

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
  access_key_id_env: "AWS_ACCESS_KEY_ID"
  secret_access_key_env: "AWS_SECRET_ACCESS_KEY"

- name: uploads
  kind: cloudstorage.s3
  config: app:aws
  bucket: "my-uploads"
  endpoint: ""  # 선택적, S3 호환 서비스용
```

**Lua API:** [클라우드 스토리지 모듈](lua-cloudstorage.md) 참조

```lua
local cloudstorage = require("cloudstorage")
local storage, err = cloudstorage.get("app:uploads")

storage:upload_object("files/doc.pdf", file_content)
local url = storage:presigned_get_url("files/doc.pdf", {expires = "1h"})
```

<tip>
MinIO나 DigitalOcean Spaces 같은 S3 호환 서비스에 연결하려면 <code>endpoint</code>를 사용하세요.
</tip>

## 파일 시스템

| Kind | 설명 |
|------|-------------|
| `fs.directory` | 디렉토리 접근 |

```yaml
- name: data_dir
  kind: fs.directory
  directory: "./data"
  auto_init: true   # 없으면 생성
  mode: "0755"      # 권한
```

**Lua API:** [파일시스템 모듈](lua-fs.md) 참조

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
| `env.storage.router` | 환경 라우터 (다중 스토리지) |
| `env.variable` | 환경 변수 |

```yaml
- name: os_env
  kind: env.storage.os

- name: file_env
  kind: env.storage.file
  file_path: ".env"
  auto_create: true

- name: app_env
  kind: env.storage.router
  storages:
    - app:os_env
    - app:file_env
```

**Lua API:** [Env 모듈](lua-env.md) 참조

```lua
local env = require("env")

local api_key = env.get("API_KEY")
env.set("CACHE_TTL", "3600")
```

<note>
라우터는 순서대로 스토리지를 시도합니다. 읽기 시 첫 번째 일치가 우선이고, 쓰기는 첫 번째 쓰기 가능한 스토리지로 갑니다.
</note>

## 템플릿

| Kind | 설명 |
|------|-------------|
| `template.jet` | 개별 Jet 템플릿 |
| `template.set` | 템플릿 세트 설정 |

```yaml
# 엔진 설정이 있는 템플릿 세트
- name: templates
  kind: template.set
  engine:
    development_mode: false
    extensions:
      - ".jet"
      - ".html.jet"

# 개별 템플릿
- name: email_template
  kind: template.jet
  source: file://templates/email.jet
  set: app:templates
```

**Lua API:** [템플릿 모듈](lua-template.md) 참조

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
# 조건 기반 정책
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

# 표현식 기반 정책
- name: owner_policy
  kind: security.policy.expr
  policy:
    actions: "*"
    resources: "*"
    effect: allow
    expression: 'actor.id == meta.owner_id || actor.meta.role == "admin"'
```

**Lua API:** [보안 모듈](lua-security.md) 참조

```lua
local security = require("security")

-- 액션 전 권한 확인
if security.can("delete", "users", {user_id = id}) then
    delete_user(id)
end

-- 현재 액터 가져오기
local actor = security.actor()
```

<warning>
정책은 순서대로 평가됩니다. 첫 번째 일치하는 정책이 접근을 결정합니다. 더 구체적인 정책을 일반적인 정책보다 먼저 배치하세요.
</warning>

## 계약 (의존성 주입)

| Kind | 설명 |
|------|-------------|
| `contract.definition` | 메서드 명세가 있는 인터페이스 |
| `contract.binding` | 계약 메서드를 함수 구현에 매핑 |

```yaml
# 계약 인터페이스 정의
- name: greeter
  kind: contract.definition
  methods:
    - name: greet
      description: 인사 메시지 반환
    - name: greet_with_name
      description: 개인화된 인사 반환
      input_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}
      output_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}

# 구현 함수
- name: greeter_greet
  kind: function.lua
  source: file://greeter_greet.lua
  method: main

- name: greeter_greet_name
  kind: function.lua
  source: file://greeter_greet_name.lua
  method: main

# 계약 메서드를 구현에 바인딩
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

-- ID로 바인딩 열기
local greeter, err = contract.open("app:greeter_impl")

-- 메서드 호출
local result = greeter:greet()
local personalized = greeter:greet_with_name("Alice")

-- 인스턴스가 계약을 구현하는지 확인
local is_greeter = contract.is(greeter, "app:greeter")
```

**Lua API:** [계약 모듈](lua-contract.md) 참조

<tip>
바인딩 ID를 지정하지 않고 계약을 열 때 사용하려면 하나의 바인딩을 <code>default: true</code>로 표시하세요 (<code>context_required</code> 필드가 설정되지 않은 경우에만 작동).
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

## 라이프사이클 설정

대부분의 엔트리는 라이프사이클 설정을 지원합니다:

```yaml
- name: service
  kind: some.kind
  lifecycle:
    auto_start: true          # 자동 시작
    start_timeout: 10s        # 최대 시작 시간
    stop_timeout: 10s         # 최대 종료 시간
    stable_threshold: 5s      # 안정으로 간주되는 시간
    depends_on:
      - app:database
    restart:                  # 재시도 정책
      initial_delay: 1s
      max_delay: 90s
      backoff_factor: 2.0
      max_attempts: 0         # 0 = 무한 재시도
```

<note>
<code>depends_on</code>을 사용하여 엔트리가 올바른 순서로 시작되도록 하세요. 슈퍼바이저는 의존 엔트리를 시작하기 전에 의존성이 안정 상태가 될 때까지 기다립니다.
</note>

## 엔트리 참조 형식

엔트리는 `namespace:name` 형식을 사용하여 참조됩니다:

```yaml
# 정의
namespace: app.users
entries:
  - name: handler
    kind: function.lua

# 다른 엔트리에서 참조
func: app.users:handler
```
