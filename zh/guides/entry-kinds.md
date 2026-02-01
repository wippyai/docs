# 入口类型参考

Wippy 中所有可用入口类型的完整参考。

> 入口之间使用 `namespace:name` 格式相互引用。注册表根据这些引用自动连接依赖关系，确保资源按正确顺序初始化。

## 参见

- [注册表](concepts/registry.md) - 入口的存储和解析方式
- [配置](guides/configuration.md) - YAML 配置格式

## Lua 运行时

| 类型 | 说明 |
|------|------|
| `function.lua` | Lua 函数入口点 |
| `process.lua` | 长期运行的 Lua 进程 |
| `workflow.lua` | Temporal 工作流（确定性） |
| `library.lua` | 共享 Lua 库 |

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
  imports:
    utils: app.lib:helpers  # 将另一个入口作为模块导入
```

<tip>
使用 <code>imports</code> 引用其他 Lua 入口。它们在代码中可通过 <code>require("alias_name")</code> 使用。
</tip>

## HTTP 服务

| 类型 | 说明 |
|------|------|
| `http.service` | HTTP 服务器（绑定端口） |
| `http.router` | 路由前缀和中间件 |
| `http.endpoint` | HTTP 端点（方法 + 路径） |
| `http.static` | 静态文件服务 |

```yaml
# HTTP 服务器
- name: gateway
  kind: http.service
  addr: ":8080"
  lifecycle:
    auto_start: true

# 带中间件的路由
- name: api
  kind: http.router
  meta:
    server: gateway
  prefix: /api
  middleware:
    - cors
    - rate_limit

# 端点
- name: users_list
  kind: http.endpoint
  meta:
    router: app:api
  method: GET
  path: /users
  func: list_handler
```

**Lua API：** 参见 [HTTP 模块](lua/http/http.md)

```lua
local http = require("http")
local req = http.request()
local resp = http.response()

resp:status(200):json({users = get_users()})
```

## 数据库

| 类型 | 说明 |
|------|------|
| `db.sql.sqlite` | SQLite 数据库 |
| `db.sql.postgres` | PostgreSQL 数据库 |
| `db.sql.mysql` | MySQL 数据库 |
| `db.sql.mssql` | Microsoft SQL Server |
| `db.sql.oracle` | Oracle 数据库 |

### SQLite

```yaml
- name: database
  kind: db.sql.sqlite
  file: "./data/app.db"
  lifecycle:
    auto_start: true

# 用于测试的内存数据库
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

**Lua API：** 参见 [SQL 模块](lua/storage/sql.md)

```lua
local sql = require("sql")
local db, err = sql.get("app:database")

local rows, err = db:query("SELECT * FROM users WHERE id = ?", user_id)
db:execute("INSERT INTO logs (msg) VALUES (?)", message)
```


## 键值存储

| 类型 | 说明 |
|------|------|
| `store.memory` | 内存键值存储 |
| `store.sql` | SQL 后端键值存储 |

```yaml
# 内存存储
- name: cache
  kind: store.memory
  lifecycle:
    auto_start: true

# SQL 后端存储
- name: persistent_store
  kind: store.sql
  database: app:database
  table: kv_store
  lifecycle:
    auto_start: true
```

**Lua API：** 参见 [Store 模块](lua/storage/store.md)

```lua
local store = require("store")
local s, err = store.get("app:cache")

s:set("user:123", user_data, 3600)  -- TTL 单位为秒
local data = s:get("user:123")
```

## 队列

| 类型 | 说明 |
|------|------|
| `queue.driver.memory` | 内存队列驱动 |
| `queue.queue` | 队列声明 |
| `queue.consumer` | 队列消费者 |

```yaml
# 驱动
- name: queue_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true

# 队列
- name: jobs
  kind: queue.queue
  driver: queue_driver

# 消费者
- name: job_consumer
  kind: queue.consumer
  queue: app:jobs
  func: job_handler
  concurrency: 4
  prefetch: 10
  lifecycle:
    auto_start: true
```

**Lua API：** 参见 [Queue 模块](lua/storage/queue.md)

```lua
local queue = require("queue")

-- 发布消息
queue.publish("app:jobs", {task = "process", id = 123})

-- 在消费者处理函数中访问当前消息
local msg = queue.message()
local data = msg:body_json()
```

<note>
消费者的 <code>func</code> 会为每条消息调用。在处理函数中使用 <code>queue.message()</code> 访问当前消息。
</note>

## 进程管理

| 类型 | 说明 |
|------|------|
| `process.host` | 进程执行宿主 |
| `process.service` | 受监督的进程（包装 process.lua） |
| `terminal.host` | 终端/CLI 宿主 |

```yaml
# 进程宿主（进程运行的地方）
- name: processes
  kind: process.host
  host:
    workers: 32             # 工作 goroutine 数（默认：NumCPU）
    queue_size: 1024        # 全局队列容量
    local_queue_size: 256   # 每个工作线程的队列
  lifecycle:
    auto_start: true

# 进程定义
- name: worker_process
  kind: process.lua
  source: file://worker.lua
  method: main

# 受监督的进程服务
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
当需要将进程作为具有自动重启功能的受监督服务运行时，使用 <code>process.service</code>。<code>process</code> 字段引用一个 <code>process.lua</code> 入口。
</tip>

## Temporal（工作流）

| 类型 | 说明 |
|------|------|
| `temporal.client` | Temporal 客户端连接 |
| `temporal.worker` | Temporal 工作线程 |

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

## 云存储

| 类型 | 说明 |
|------|------|
| `config.aws` | AWS 配置 |
| `cloudstorage.s3` | S3 存储桶访问 |

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
  endpoint: ""  # 可选，用于 S3 兼容服务
```

**Lua API：** 参见 [Cloud Storage 模块](lua/storage/cloud.md)

```lua
local cloudstorage = require("cloudstorage")
local storage, err = cloudstorage.get("app:uploads")

storage:upload_object("files/doc.pdf", file_content)
local url = storage:presigned_get_url("files/doc.pdf", {expires = "1h"})
```

<tip>
使用 <code>endpoint</code> 连接 S3 兼容服务，如 MinIO 或 DigitalOcean Spaces。
</tip>

## 文件系统

| 类型 | 说明 |
|------|------|
| `fs.directory` | 目录访问 |

```yaml
- name: data_dir
  kind: fs.directory
  directory: "./data"
  auto_init: true   # 不存在时创建
  mode: "0755"      # 权限
```

**Lua API：** 参见 [Filesystem 模块](lua/storage/filesystem.md)

```lua
local fs = require("fs")
local filesystem, err = fs.get("app:data_dir")

local file = filesystem:open("output.txt", "w")
file:write("Hello, World!")
file:close()
```

## 环境

| 类型 | 说明 |
|------|------|
| `env.storage.memory` | 内存环境存储 |
| `env.storage.file` | 文件环境存储 |
| `env.storage.os` | 操作系统环境 |
| `env.storage.router` | 环境路由（多存储） |
| `env.variable` | 环境变量 |

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

**Lua API：** 参见 [Env 模块](lua/system/env.md)

```lua
local env = require("env")

local api_key = env.get("API_KEY")
env.set("CACHE_TTL", "3600")
```

<note>
路由器按顺序尝试存储。读取时返回第一个匹配的结果；写入时使用第一个可写存储。
</note>

## 模板

| 类型 | 说明 |
|------|------|
| `template.jet` | 单个 Jet 模板 |
| `template.set` | 模板集配置 |

```yaml
# 带引擎配置的模板集
- name: templates
  kind: template.set
  engine:
    development_mode: false
    extensions:
      - ".jet"
      - ".html.jet"

# 单个模板
- name: email_template
  kind: template.jet
  source: file://templates/email.jet
  set: app:templates
```

**Lua API：** 参见 [Template 模块](lua/text/template.md)

```lua
local templates = require("templates")
local set, err = templates.get("app:templates")

local html = set:render("email", {
    user = "Alice",
    message = "Welcome!"
})
```

## 安全

| 类型 | 说明 |
|------|------|
| `security.policy` | 带条件的安全策略 |
| `security.policy.expr` | 基于表达式的策略 |
| `security.token_store` | 令牌存储 |

```yaml
# 基于条件的策略
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

# 基于表达式的策略
- name: owner_policy
  kind: security.policy.expr
  policy:
    actions: "*"
    resources: "*"
    effect: allow
    expression: 'actor.id == meta.owner_id || actor.meta.role == "admin"'
```

**Lua API：** 参见 [Security 模块](lua/security/security.md)

```lua
local security = require("security")

-- 操作前检查权限
if security.can("delete", "users", {user_id = id}) then
    delete_user(id)
end

-- 获取当前角色
local actor = security.actor()
```

<warning>
策略按顺序评估。第一个匹配的策略决定访问权限。将更具体的策略放在通用策略之前。
</warning>

## 契约（依赖注入）

| 类型 | 说明 |
|------|------|
| `contract.definition` | 带方法规范的接口 |
| `contract.binding` | 将契约方法映射到函数实现 |

```yaml
# 定义契约接口
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

# 实现函数
- name: greeter_greet
  kind: function.lua
  source: file://greeter_greet.lua
  method: main

- name: greeter_greet_name
  kind: function.lua
  source: file://greeter_greet_name.lua
  method: main

# 将契约方法绑定到实现
- name: greeter_impl
  kind: contract.binding
  contracts:
    - contract: app:greeter
      default: true
      methods:
        greet: app:greeter_greet
        greet_with_name: app:greeter_greet_name
```

在 Lua 中使用：

```lua
local contract = require("contract")

-- 通过 ID 打开绑定
local greeter, err = contract.open("app:greeter_impl")

-- 调用方法
local result = greeter:greet()
local personalized = greeter:greet_with_name("Alice")

-- 检查实例是否实现了契约
local is_greeter = contract.is(greeter, "app:greeter")
```

**Lua API：** 参见 [Contract 模块](lua/core/contract.md)

<tip>
将一个绑定标记为 <code>default: true</code>，可在不指定绑定 ID 的情况下打开契约（仅在未设置 <code>context_required</code> 字段时有效）。
</tip>

## 执行

| 类型 | 说明 |
|------|------|
| `exec.native` | 原生命令执行 |
| `exec.docker` | Docker 容器执行 |

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

## 生命周期配置

大多数入口支持生命周期配置：

```yaml
- name: service
  kind: some.kind
  lifecycle:
    auto_start: true          # 自动启动
    start_timeout: 10s        # 最大启动时间
    stop_timeout: 10s         # 最大关闭时间
    stable_threshold: 5s      # 视为稳定的运行时间
    depends_on:
      - app:database
    restart:                  # 重试策略
      initial_delay: 1s
      max_delay: 90s
      backoff_factor: 2.0
      max_attempts: 0         # 0 = 无限
```

<note>
使用 <code>depends_on</code> 确保入口按正确顺序启动。监督器会等待依赖项达到稳定状态后再启动依赖它们的入口。
</note>

## 入口引用格式

入口使用 `namespace:name` 格式引用：

```yaml
# 定义
namespace: app.users
entries:
  - name: handler
    kind: function.lua

# 从另一个入口引用
func: app.users:handler
```
