# Entry Kinds Reference

Complete reference of all entry kinds available in Wippy.

> Entries reference each other using `namespace:name` format. The registry automatically wires dependencies together based on these references, ensuring resources are initialized in the correct order.

## See Also

- [Registry](concepts/registry.md) - How entries are stored and resolved
- [Configuration](guides/configuration.md) - YAML configuration format

## Lua Runtime

| Kind | Description |
|------|-------------|
| `function.lua` | Lua function entry point |
| `process.lua` | Long-running Lua process |
| `workflow.lua` | Temporal workflow (deterministic) |
| `library.lua` | Shared Lua library |
| `module.lua` | Lua module surface |
| `function.lua.bc` | Precompiled function bytecode |
| `library.lua.bc` | Precompiled library bytecode |
| `process.lua.bc` | Precompiled process bytecode |
| `workflow.lua.bc` | Precompiled workflow bytecode |

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
Use <code>imports</code> to reference other Lua entries. They become available via <code>require("alias_name")</code> in your code.
</tip>

## HTTP Services

| Kind | Description |
|------|-------------|
| `http.service` | HTTP server (binds port) |
| `http.router` | Route prefix and middleware |
| `http.endpoint` | HTTP endpoint (method + path) |
| `http.static` | Static file serving |

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

**Lua API:** See [HTTP Module](lua/http/http.md)

```lua
local http = require("http")
local req = http.request()
local resp = http.response()

resp:set_status(200)
resp:write_json({users = get_users()})
```

## Databases

| Kind | Description |
|------|-------------|
| `db.sql.sqlite` | SQLite database |
| `db.sql.postgres` | PostgreSQL database |
| `db.sql.mysql` | MySQL database |

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

See [Database](system/database.md) for `*_env` suffix variants, TLS options, and connection pool tuning.

**Lua API:** See [SQL Module](lua/storage/sql.md)

```lua
local sql = require("sql")
local db, err = sql.get("app:database")

local rows, err = db:query("SELECT * FROM users WHERE id = ?", user_id)
db:execute("INSERT INTO logs (msg) VALUES (?)", message)
```


## Key-Value Stores

| Kind | Description |
|------|-------------|
| `store.memory` | In-memory key-value store |
| `store.sql` | SQL-backed key-value store |
| `store.kv.raft` | Cluster-replicated, strongly-consistent KV (shared Raft) |
| `store.kv.crdt` | Cluster-replicated, eventually-consistent KV (gossip/CRDT) |

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
  table: kv_store
  lifecycle:
    auto_start: true

# Cluster-replicated store (requires clustering)
- name: deployments
  kind: store.kv.raft
  namespace: deploy
```

The `store.kv.*` kinds need [clustering](guides/cluster.md) enabled. See [Store](system/store.md#cluster-kv-stores) for the consistency tradeoffs.

**Lua API:** See [Store Module](lua/storage/store.md)

```lua
local store = require("store")
local s, err = store.get("app:cache")

s:set("user:123", user_data, 3600)  -- TTL in seconds
local data = s:get("user:123")
```

## Queues

| Kind | Description |
|------|-------------|
| `queue.driver.memory` | In-memory queue driver |
| `queue.driver.amqp` | AMQP (RabbitMQ) driver |
| `queue.driver.sqs` | AWS SQS driver |
| `queue.queue` | Queue declaration |
| `queue.consumer` | Queue consumer |

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

**Lua API:** See [Queue Module](lua/storage/queue.md)

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
The consumer's <code>func</code> is invoked once per message with the message body as its argument. Use <code>queue.message()</code> inside the handler for the delivery's <code>id()</code>, <code>header()</code>/<code>headers()</code>, and <code>ack()</code>/<code>nack()</code>.
</note>

## Process Management

| Kind | Description |
|------|-------------|
| `process.host` | Process execution host |
| `process.service` | Supervised process (wraps process.lua) |
| `terminal.host` | Terminal/CLI host |

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
Use <code>process.service</code> when you need a process to run as a supervised service with automatic restart. The <code>process</code> field references a <code>process.lua</code> entry.
</tip>

## Temporal (Workflows)

| Kind | Description |
|------|-------------|
| `temporal.client` | Temporal client connection |
| `temporal.worker` | Temporal worker |

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

## Cloud Storage

| Kind | Description |
|------|-------------|
| `config.aws` | AWS configuration |
| `cloudstorage.s3` | S3 bucket access |

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
  endpoint: ""  # Optional, for S3-compatible services
```

**Lua API:** See [Cloud Storage Module](lua/storage/cloud.md)

```lua
local cloudstorage = require("cloudstorage")
local storage, err = cloudstorage.get("app:uploads")

storage:upload_object("files/doc.pdf", file_content)
local url = storage:presigned_get_url("files/doc.pdf", {expiration = 3600})  -- seconds, default 3600
```

<tip>
Use <code>endpoint</code> to connect to S3-compatible services like MinIO or DigitalOcean Spaces.
</tip>

## File Systems

| Kind | Description |
|------|-------------|
| `fs.directory` | Directory access |
| `fs.embed` | Read-only embedded filesystem |

```yaml
- name: data_dir
  kind: fs.directory
  directory: "./data"
  auto_init: true   # Create if not exists
  mode: "0755"      # Permissions
```

**Lua API:** See [Filesystem Module](lua/storage/filesystem.md)

```lua
local fs = require("fs")
local filesystem, err = fs.get("app:data_dir")

local file = filesystem:open("output.txt", "w")
file:write("Hello, World!")
file:close()
```

## Environment

| Kind | Description |
|------|-------------|
| `env.storage.memory` | In-memory env storage |
| `env.storage.file` | File-based env storage |
| `env.storage.os` | OS environment |
| `env.storage.static` | Read-only static key-value storage |
| `env.storage.router` | Env router (multiple storages) |
| `env.variable` | Environment variable |

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

**Lua API:** See [Env Module](lua/system/env.md)

```lua
local env = require("env")

local api_key = env.get("API_KEY")
env.set("CACHE_TTL", "3600")
```

<note>
The router tries storages in order. First match wins for reads; writes go to the first writable storage.
</note>

## Templates

| Kind | Description |
|------|-------------|
| `template.jet` | Individual Jet template |
| `template.set` | Template set configuration |

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

**Lua API:** See [Template Module](lua/text/template.md)

```lua
local templates = require("templates")
local set, err = templates.get("app:templates")

local html = set:render("email", {
    user = "Alice",
    message = "Welcome!"
})
```

## Security

| Kind | Description |
|------|-------------|
| `security.policy` | Security policy with conditions |
| `security.policy.expr` | Expression-based policy |
| `security.token_store` | Token storage |

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

**Lua API:** See [Security Module](lua/security/security.md)

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
Policies are evaluated in order. The first matching policy determines access. Place more specific policies before general ones.
</warning>

## Contracts (Dependency Injection)

| Kind | Description |
|------|-------------|
| `contract.definition` | Interface with method specifications |
| `contract.binding` | Maps contract methods to function implementations |

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

Usage from Lua:

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

**Lua API:** See [Contract Module](lua/core/contract.md)

<tip>
Mark one binding as <code>default: true</code> to use it when opening a contract without specifying a binding ID (only works when no <code>context_required</code> fields are set).
</tip>

## Execution

| Kind | Description |
|------|-------------|
| `exec.native` | Native command execution |
| `exec.docker` | Docker container execution |

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

## WASM Runtime

| Kind | Description |
|------|-------------|
| `function.wat` | WebAssembly function (WAT text format) |
| `function.wasm` | WebAssembly function (binary) |
| `process.wasm` | WebAssembly process |

```yaml
- name: sum
  kind: function.wasm
  source: file://sum.wasm
  transport: payload   # or wasi-http
```

See [WASM Overview](wasm/overview.md).

## Networks

| Kind | Description |
|------|-------------|
| `network` | Base network overlay |
| `network.socks5` | SOCKS5 proxy overlay |
| `network.i2p` | I2P network overlay |
| `network.tailscale` | Tailscale overlay |

Referenced by `http.service` via `network:`, by `funcs`/`process` via the `network` option, and by `http_client` via the `overlay_network` option. See [Network](system/network.md).

## Registry Primitives

| Kind | Description |
|------|-------------|
| `registry.entry` | Entry descriptor (internal) |
| `ns.definition` | Namespace definition |
| `ns.requirement` | Namespace requirement declaration |
| `ns.dependency` | Namespace dependency |

These are produced by the registry loader from `_index.yaml` frontmatter and dependency declarations. Authors generally don't define them directly — they appear as a result of `version:`, `namespace:`, and dependency blocks being resolved.

## Lifecycle Configuration

Most entries support lifecycle configuration:

```yaml
- name: service
  kind: some.kind
  lifecycle:
    auto_start: true          # Start automatically
    start_timeout: 10s        # Max startup time
    stop_timeout: 10s         # Max shutdown time
    stable_threshold: 5s      # Time to consider stable
    depends_on:
      - app:database
    restart:                  # Retry policy
      initial_delay: 1s
      max_delay: 90s
      backoff_factor: 2.0
      max_attempts: 0         # 0 = infinite
```

<note>
Use <code>depends_on</code> to ensure entries start in the correct order. The supervisor waits for dependencies to become stable before starting dependent entries.
</note>

## Entry Reference Format

Entries are referenced using `namespace:name` format:

```yaml
# Definition
namespace: app.users
entries:
  - name: handler
    kind: function.lua

# Reference from another entry
func: app.users:handler
```

## Overriding Entries

Any entry's fields — including its `kind` — can be overridden at launch without editing the source YAML, using the `override:` config section or the `-o` CLI flag. Keys use `namespace:entry:path` format:

```yaml
override:
  app:gateway:addr: ":9090"        # data field (a bare path targets data.*)
  app:worker:meta.priority: high    # meta field
  app:db:kind: db.sql.postgres      # the entry's typed kind
  app:db:data.kind: custom          # a payload field literally named "kind"
```

| Path | Targets |
|------|---------|
| `kind` | The entry's typed kind (must be a non-empty string) |
| `data.<field>` or bare `<field>` | A field in the entry's data payload |
| `meta.<field>` | A field in the entry's metadata |

The same overrides apply from the CLI:

```bash
wippy run -o app:db:kind=db.sql.postgres -o app:gateway:addr=:9090
```

CLI (`-o`) values coerce by shape (`true`/`false` to bool, numbers to numbers, otherwise string); `override:` section values keep their YAML type. To override global [configuration](guides/configuration.md) sections instead of entries, use `--set`.
