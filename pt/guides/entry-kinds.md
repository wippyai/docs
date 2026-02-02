# Referência de Tipos de Entradas

Referência completa de todos os tipos de entradas disponíveis no Wippy.

> Entradas referenciam umas às outras usando o formato `namespace:name`. O registro automaticamente conecta dependências baseado nessas referências, garantindo que recursos sejam inicializados na ordem correta.

## Veja Também

- [Registro](concepts/registry.md) - Como entradas são armazenadas e resolvidas
- [Configuração](guides/configuration.md) - Formato de configuração YAML

## Runtime Lua

| Tipo | Descrição |
|------|-----------|
| `function.lua` | Ponto de entrada de função Lua |
| `process.lua` | Processo Lua de longa duração |
| `workflow.lua` | Workflow Temporal (determinístico) |
| `library.lua` | Biblioteca Lua compartilhada |

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
  imports:
    utils: app.lib:helpers  # Importa outra entrada como módulo
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
# Servidor HTTP
- name: gateway
  kind: http.service
  addr: ":8080"
  lifecycle:
    auto_start: true

# Roteador com middleware
- name: api
  kind: http.router
  meta:
    server: gateway
  prefix: /api
  middleware:
    - cors
    - rate_limit

# Endpoint
- name: users_list
  kind: http.endpoint
  meta:
    router: app:api
  method: GET
  path: /users
  func: list_handler
```

**API Lua:** Veja [Módulo HTTP](lua/http/http.md)

```lua
local http = require("http")
local req = http.request()
local resp = http.response()

resp:status(200):json({users = get_users()})
```

## Bancos de Dados

| Tipo | Descrição |
|------|-----------|
| `db.sql.sqlite` | Banco de dados SQLite |
| `db.sql.postgres` | Banco de dados PostgreSQL |
| `db.sql.mysql` | Banco de dados MySQL |
| `db.sql.mssql` | Microsoft SQL Server |
| `db.sql.oracle` | Banco de dados Oracle |

### SQLite

```yaml
- name: database
  kind: db.sql.sqlite
  file: "./data/app.db"
  lifecycle:
    auto_start: true

# Em memória para testes
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

**API Lua:** Veja [Módulo SQL](lua/storage/sql.md)

```lua
local sql = require("sql")
local db, err = sql.get("app:database")

local rows, err = db:query("SELECT * FROM users WHERE id = ?", user_id)
db:execute("INSERT INTO logs (msg) VALUES (?)", message)
```


## Armazenamentos Chave-Valor

| Tipo | Descrição |
|------|-----------|
| `store.memory` | Armazenamento chave-valor em memória |
| `store.sql` | Armazenamento chave-valor com backend SQL |

```yaml
# Armazenamento em memória
- name: cache
  kind: store.memory
  lifecycle:
    auto_start: true

# Armazenamento com backend SQL
- name: persistent_store
  kind: store.sql
  database: app:database
  table: kv_store
  lifecycle:
    auto_start: true
```

**API Lua:** Veja [Módulo Store](lua/storage/store.md)

```lua
local store = require("store")
local s, err = store.get("app:cache")

s:set("user:123", user_data, 3600)  -- TTL em segundos
local data = s:get("user:123")
```

## Filas

| Tipo | Descrição |
|------|-----------|
| `queue.driver.memory` | Driver de fila em memória |
| `queue.queue` | Declaração de fila |
| `queue.consumer` | Consumidor de fila |

```yaml
# Driver
- name: queue_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true

# Fila
- name: jobs
  kind: queue.queue
  driver: queue_driver

# Consumidor
- name: job_consumer
  kind: queue.consumer
  queue: app:jobs
  func: job_handler
  concurrency: 4
  prefetch: 10
  lifecycle:
    auto_start: true
```

**API Lua:** Veja [Módulo Queue](lua/storage/queue.md)

```lua
local queue = require("queue")

-- Publica uma mensagem
queue.publish("app:jobs", {task = "process", id = 123})

-- No handler do consumidor, acessa mensagem atual
local msg = queue.message()
local data = msg:body_json()
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

```yaml
# Host de processos (onde processos executam)
- name: processes
  kind: process.host
  host:
    workers: 32             # Goroutines workers (padrão: NumCPU)
    queue_size: 1024        # Capacidade da fila global
    local_queue_size: 256   # Fila por worker
  lifecycle:
    auto_start: true

# Definição de processo
- name: worker_process
  kind: process.lua
  source: file://worker.lua
  method: main

# Serviço de processo supervisionado
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
  access_key_id_env: "AWS_ACCESS_KEY_ID"
  secret_access_key_env: "AWS_SECRET_ACCESS_KEY"

- name: uploads
  kind: cloudstorage.s3
  config: app:aws
  bucket: "my-uploads"
  endpoint: ""  # Opcional, para serviços compatíveis com S3
```

**API Lua:** Veja [Módulo Cloud Storage](lua/storage/cloud.md)

```lua
local cloudstorage = require("cloudstorage")
local storage, err = cloudstorage.get("app:uploads")

storage:upload_object("files/doc.pdf", file_content)
local url = storage:presigned_get_url("files/doc.pdf", {expires = "1h"})
```

<tip>
Use <code>endpoint</code> para conectar a serviços compatíveis com S3 como MinIO ou DigitalOcean Spaces.
</tip>

## Sistemas de Arquivos

| Tipo | Descrição |
|------|-----------|
| `fs.directory` | Acesso a diretório |

```yaml
- name: data_dir
  kind: fs.directory
  directory: "./data"
  auto_init: true   # Cria se não existir
  mode: "0755"      # Permissões
```

**API Lua:** Veja [Módulo Filesystem](lua/storage/filesystem.md)

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
| `env.storage.router` | Roteador de env (múltiplos armazenamentos) |
| `env.variable` | Variável de ambiente |

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

**API Lua:** Veja [Módulo Env](lua/system/env.md)

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
# Conjunto de templates com configuração do motor
- name: templates
  kind: template.set
  engine:
    development_mode: false
    extensions:
      - ".jet"
      - ".html.jet"

# Template individual
- name: email_template
  kind: template.jet
  source: file://templates/email.jet
  set: app:templates
```

**API Lua:** Veja [Módulo Template](lua/text/template.md)

```lua
local templates = require("templates")
local set, err = templates.get("app:templates")

local html = set:render("email", {
    user = "Alice",
    message = "Bem-vindo!"
})
```

## Segurança

| Tipo | Descrição |
|------|-----------|
| `security.policy` | Política de segurança com condições |
| `security.policy.expr` | Política baseada em expressão |
| `security.token_store` | Armazenamento de tokens |

```yaml
# Política baseada em condições
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

# Política baseada em expressão
- name: owner_policy
  kind: security.policy.expr
  policy:
    actions: "*"
    resources: "*"
    effect: allow
    expression: 'actor.id == meta.owner_id || actor.meta.role == "admin"'
```

**API Lua:** Veja [Módulo Security](lua/security/security.md)

```lua
local security = require("security")

-- Verifica permissão antes da ação
if security.can("delete", "users", {user_id = id}) then
    delete_user(id)
end

-- Obtém ator atual
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
# Define a interface do contrato
- name: greeter
  kind: contract.definition
  methods:
    - name: greet
      description: Retorna uma mensagem de saudação
    - name: greet_with_name
      description: Retorna uma saudação personalizada
      input_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}
      output_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}

# Funções de implementação
- name: greeter_greet
  kind: function.lua
  source: file://greeter_greet.lua
  method: main

- name: greeter_greet_name
  kind: function.lua
  source: file://greeter_greet_name.lua
  method: main

# Vincula métodos do contrato a implementações
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

-- Abre binding pelo ID
local greeter, err = contract.open("app:greeter_impl")

-- Chama métodos
local result = greeter:greet()
local personalized = greeter:greet_with_name("Alice")

-- Verifica se instância implementa contrato
local is_greeter = contract.is(greeter, "app:greeter")
```

**API Lua:** Veja [Módulo Contract](lua/core/contract.md)

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

## Configuração de Ciclo de Vida

A maioria das entradas suporta configuração de ciclo de vida:

```yaml
- name: service
  kind: some.kind
  lifecycle:
    auto_start: true          # Inicia automaticamente
    start_timeout: 10s        # Tempo máximo de inicialização
    stop_timeout: 10s         # Tempo máximo de encerramento
    stable_threshold: 5s      # Tempo para considerar estável
    depends_on:
      - app:database
    restart:                  # Política de retry
      initial_delay: 1s
      max_delay: 90s
      backoff_factor: 2.0
      max_attempts: 0         # 0 = infinito
```

<note>
Use <code>depends_on</code> para garantir que entradas iniciem na ordem correta. O supervisor aguarda dependências se tornarem estáveis antes de iniciar entradas dependentes.
</note>

## Formato de Referência de Entradas

Entradas são referenciadas usando o formato `namespace:name`:

```yaml
# Definição
namespace: app.users
entries:
  - name: handler
    kind: function.lua

# Referência de outra entrada
func: app.users:handler
```
