---
title: "Referência de Tipos de Entradas"
description: "Referência dos kinds de entrada Wippy nos sistemas de runtime, armazenamento, rede, segurança, execução e ciclo de vida."
---

# Referência de Tipos de Entradas

Esta página resume os kinds de entrada disponíveis e aponta para suas referências detalhadas de módulos e sistemas.

Os blocos YAML e Lua são fragmentos de referência, não uma única aplicação. IDs do registro, credenciais, objetos de dados e helpers como `get_users` ou `delete_user` são ilustrativos; consulte as páginas de módulos vinculadas para ver os contratos completos de retorno e erro.

> Entradas referenciam umas às outras usando o formato `namespace:name`. O registro automaticamente conecta dependências baseado nessas referências, garantindo que recursos sejam inicializados na ordem correta.

## Veja Também

- [Registro](../concepts/registry.md) - Como entradas são armazenadas e resolvidas
- [Configuração](./configuration.md) - Formato de configuração YAML

## Runtime Lua

| Tipo | Descrição |
|------|-----------|
| `function.lua` | Ponto de entrada de função Lua |
| `process.lua` | Processo Lua de longa duração |
| `workflow.lua` | Workflow Temporal (determinístico) |
| `library.lua` | Biblioteca Lua compartilhada |
| `module.lua` | Interface de módulo Lua |
| `function.lua.bc` | Bytecode de função pré-compilado |
| `library.lua.bc` | Bytecode de biblioteca pré-compilado |
| `process.lua.bc` | Bytecode de processo pré-compilado |
| `workflow.lua.bc` | Bytecode de workflow pré-compilado |

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
Use <code>imports</code> para referenciar outras entradas Lua. Elas se tornam disponíveis via <code>require("nome_alias")</code> no seu código.
</tip>

## Serviços HTTP

| Tipo | Descrição |
|------|-----------|
| `http.service` | Servidor HTTP (vincula porta) |
| `http.router` | Prefixo de rota e middleware |
| `http.endpoint` | Endpoint HTTP (método + caminho) |
| `http.static` | Serviço de arquivos estáticos |

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

**API Lua:** Veja [Módulo HTTP](../lua/http/http.md)

```lua
local http = require("http")
local req = http.request()
local resp = http.response()

resp:set_status(200)
resp:write_json({users = get_users()})
```

## Bancos de Dados

| Tipo | Descrição |
|------|-----------|
| `db.sql.sqlite` | Banco de dados SQLite |
| `db.sql.postgres` | Banco de dados PostgreSQL |
| `db.sql.mysql` | Banco de dados MySQL |
| `db.cdc.postgres` | Fonte de Change Data Capture do Postgres (consulte [CDC](../system/cdc.md)) |

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

Veja [Database](../system/database.md) para referências de segredos `${env:NAME}`, opções TLS e ajuste do pool de conexões. Quando um valor vindo de env por trás de uma entrada de banco de dados muda, o pool é trocado ao vivo — empréstimos ativos terminam com as configurações de conexão antigas.

**API Lua:** Veja [Módulo SQL](../lua/storage/sql.md)

```lua
local sql = require("sql")
local db, err = sql.get("app:database")

local rows, err = db:query("SELECT * FROM users WHERE id = ?", {user_id})
db:execute("INSERT INTO logs (msg) VALUES (?)", {message})
```


## Armazenamentos Chave-Valor

| Tipo | Descrição |
|------|-----------|
| `store.memory` | Armazenamento chave-valor em memória |
| `store.sql` | Armazenamento chave-valor com backend SQL |
| `store.kv.raft` | KV replicado em cluster, fortemente consistente (Raft compartilhado) |
| `store.kv.crdt` | KV replicado em cluster, eventualmente consistente (gossip/CRDT) |

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

Os tipos `store.kv.*` precisam do [clustering](./cluster.md) habilitado. Veja [Store](../system/store.md#cluster-kv-stores) para os tradeoffs de consistência.

**API Lua:** Veja [Módulo Store](../lua/storage/store.md)

```lua
local store = require("store")
local s, err = store.get("app:cache")

s:set("user:123", user_data, 3600)  -- TTL in seconds
local data = s:get("user:123")
```

## Filas

| Tipo | Descrição |
|------|-----------|
| `queue.driver.memory` | Driver de fila em memória |
| `queue.driver.amqp` | Driver AMQP (RabbitMQ) |
| `queue.driver.sqs` | Driver AWS SQS |
| `queue.queue` | Declaração de fila |
| `queue.consumer` | Consumidor de fila |

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

**API Lua:** Veja [Módulo Queue](../lua/storage/queue.md)

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
O <code>func</code> do consumidor é invocado para cada mensagem. Use <code>queue.message()</code> dentro do handler para acessar a mensagem atual.
</note>

## Gerenciamento de Processos

| Tipo | Descrição |
|------|-----------|
| `process.host` | Host de execução de processos |
| `process.service` | Processo supervisionado (encapsula process.lua) |
| `terminal.host` | Host de terminal/CLI |
| `pg.scope` | Escopo de grupo de processos (consulte [Grupos de Processos](../system/process-groups.md)) |

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
Use <code>process.service</code> quando precisar que um processo execute como serviço supervisionado com reinicialização automática. O campo <code>process</code> referencia uma entrada <code>process.lua</code>.
</tip>

Atualizar uma entrada `process.host` ao vivo redimensiona `host.workers` no lugar — processos em execução, PIDs e filas são preservados. `host.queue_size`, `host.local_queue_size` e `lifecycle` são fixados na construção: uma atualização ao vivo que os altere é rejeitada, assim como redimensionar workers em um host cujos workers são gerenciados por afinidade.

## Temporal (Workflows)

| Tipo | Descrição |
|------|-----------|
| `temporal.client` | Conexão com cliente Temporal |
| `temporal.worker` | Worker Temporal |

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

## Armazenamento em Nuvem

| Tipo | Descrição |
|------|-----------|
| `config.aws` | Configuração AWS |
| `cloudstorage.s3` | Acesso a bucket S3 |

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

**API Lua:** Veja [Módulo Cloud Storage](../lua/storage/cloud.md)

```lua
local cloudstorage = require("cloudstorage")
local storage, err = cloudstorage.get("app:uploads")

storage:upload_object("files/doc.pdf", file_content)
local url = storage:presigned_get_url("files/doc.pdf", {expiration = 3600})  -- seconds, default 3600
```

<tip>
Use <code>endpoint</code> para conectar a serviços compatíveis com S3 como MinIO ou DigitalOcean Spaces.
</tip>

## Sistemas de Arquivos

| Tipo | Descrição |
|------|-----------|
| `fs.directory` | Acesso a diretório |
| `fs.embed` | Sistema de arquivos embutido somente leitura |

```yaml
- name: data_dir
  kind: fs.directory
  directory: "./data"
  auto_init: true   # Create if not exists
  mode: "0755"      # Permissions
```

**API Lua:** Veja [Módulo Filesystem](../lua/storage/filesystem.md)

```lua
local fs = require("fs")
local filesystem, err = fs.get("app:data_dir")

local file = filesystem:open("output.txt", "w")
file:write("Hello, World!")
file:close()
```

## Ambiente

| Tipo | Descrição |
|------|-----------|
| `env.storage.memory` | Armazenamento de env em memória |
| `env.storage.file` | Armazenamento de env baseado em arquivo |
| `env.storage.os` | Ambiente do SO |
| `env.storage.static` | Armazenamento estático somente leitura de chave-valor |
| `env.storage.router` | Roteador de env (múltiplos armazenamentos) |
| `env.variable` | Variável de ambiente |

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

**API Lua:** Veja [Módulo Env](../lua/system/env.md)

```lua
local env = require("env")

local api_key = env.get("API_KEY")
env.set("CACHE_TTL", "3600")
```

<note>
O roteador tenta armazenamentos em ordem. Primeiro match ganha para leituras; escritas vão para o primeiro armazenamento gravável.
</note>

## Templates

| Tipo | Descrição |
|------|-----------|
| `template.jet` | Template Jet individual |
| `template.set` | Configuração de conjunto de templates |

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

**API Lua:** Veja [Módulo Template](../lua/text/template.md)

```lua
local templates = require("templates")
local set, err = templates.get("app:templates")

local html = set:render("email", {
    user = "Alice",
    message = "Welcome!"
})
```

## Segurança

| Tipo | Descrição |
|------|-----------|
| `security.policy` | Política de segurança com condições |
| `security.policy.expr` | Política baseada em expressão |
| `security.token_store` | Armazenamento de tokens |

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

**API Lua:** Veja [Módulo Security](../lua/security/security.md)

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
Políticas são avaliadas em ordem. A primeira política correspondente determina o acesso. Coloque políticas mais específicas antes das gerais.
</warning>

## Contratos (Injeção de Dependência)

| Tipo | Descrição |
|------|-----------|
| `contract.definition` | Interface com especificações de métodos |
| `contract.binding` | Mapeia métodos de contrato para implementações de funções |

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

Uso no Lua:

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

**API Lua:** Veja [Módulo Contract](../lua/core/contract.md)

<tip>
Marque um binding como <code>default: true</code> para usá-lo ao abrir um contrato sem especificar um ID de binding (funciona apenas quando nenhum campo <code>context_required</code> está definido).
</tip>

## Execução

| Tipo | Descrição |
|------|-----------|
| `exec.native` | Execução de comando nativo |
| `exec.docker` | Execução em container Docker |

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

## Runtime WASM

| Tipo | Descrição |
|------|-------------|
| `function.wat` | Função WebAssembly (formato de texto WAT) |
| `function.wasm` | Função WebAssembly (binário) |
| `process.wasm` | Processo WebAssembly |

```yaml
- name: sum
  kind: function.wasm
  source: file://sum.wasm
  transport: payload   # or wasi-http
```

Veja [Visão Geral do WASM](../wasm/overview.md).

## Redes

| Tipo | Descrição |
|------|-------------|
| `network` | Overlay de rede base |
| `network.socks5` | Overlay de proxy SOCKS5 |
| `network.i2p` | Overlay de rede I2P |
| `network.tailscale` | Overlay do Tailscale |

Referenciado por `http.service` via `network:`, por `funcs`/`process` via a opcao `network` e por `http_client` via a opcao `overlay_network`. Veja [Rede](../system/network.md).

## Primitivas do Registro

| Tipo | Descrição |
|------|-------------|
| `registry.entry` | Descritor de entrada (interno) |
| `ns.definition` | Definição de namespace |
| `ns.requirement` | Declaração de requisito de namespace |
| `ns.dependency` | Dependência de namespace |

`registry.entry` é um descritor interno. Os autores definem entradas `ns.definition`, `ns.requirement` e `ns.dependency` diretamente em `_index.yaml`; os campos `version` e `namespace` do arquivo não as geram.

## Configuração de Ciclo de Vida

A maioria das entradas suporta configuração de ciclo de vida:

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
Use <code>depends_on</code> para garantir que entradas iniciem na ordem correta. O supervisor aguarda dependências se tornarem estáveis antes de iniciar entradas dependentes.
</note>

## Formato de Referência de Entradas

Entradas são referenciadas usando o formato `namespace:name`:

```yaml
# Definition
namespace: app.users
entries:
  - name: handler
    kind: function.lua

# Reference from another entry
func: app.users:handler
```

## Sobrescrevendo entradas

Qualquer campo de uma entrada — incluindo seu `kind` — pode ser sobrescrito na inicialização sem editar o YAML de origem, usando a seção de configuração `override:` ou a flag `-o` do CLI. As chaves usam o formato `namespace:entry:path`:

```yaml
override:
  app:gateway:addr: ":9090"        # data field (a bare path targets data.*)
  app:worker:meta.priority: high    # meta field
  app:db:kind: db.sql.postgres      # the entry's typed kind
  app:db:data.kind: custom          # a payload field literally named "kind"
```

| Path | Mira |
|------|------|
| `kind` | O kind tipado da entrada (deve ser uma string não vazia) |
| `data.<field>` ou `<field>` simples | Um campo no payload de dados da entrada |
| `meta.<field>` | Um campo nos metadados da entrada |

Os mesmos overrides se aplicam a partir do CLI:

```bash
wippy run -o app:db:kind=db.sql.postgres -o app:gateway:addr=:9090
```

Valores do CLI (`-o`) são convertidos pela forma (`true`/`false` para bool, números para números, caso contrário string); valores da seção `override:` mantêm seu tipo YAML. Para sobrescrever seções globais de [configuração](./configuration.md) em vez de entradas, use `--set`.
