# Referencia de Tipos de Entradas

Referencia completa de todos os tipos de entradas disponiveis no Wippy.

> Entradas referenciam umas as outras usando o formato `namespace:name`. O registro automaticamente conecta dependencias baseado nessas referencias, garantindo que recursos sejam inicializados na ordem correta.

## Veja Tambem

- [Registro](concept-registry.md) - Como entradas sao armazenadas e resolvidas
- [Configuracao](guide-configuration.md) - Formato de configuracao YAML

## Runtime Lua

| Tipo | Descricao |
|------|-----------|
| `function.lua` | Ponto de entrada de funcao Lua |
| `process.lua` | Processo Lua de longa duracao |
| `workflow.lua` | Workflow Temporal (deterministico) |
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
    utils: app.lib:helpers  # Importa outra entrada como modulo
```

<tip>
Use <code>imports</code> para referenciar outras entradas Lua. Elas se tornam disponiveis via <code>require("nome_alias")</code> no seu codigo.
</tip>

## Servicos HTTP

| Tipo | Descricao |
|------|-----------|
| `http.service` | Servidor HTTP (vincula porta) |
| `http.router` | Prefixo de rota e middleware |
| `http.endpoint` | Endpoint HTTP (metodo + caminho) |
| `http.static` | Servico de arquivos estaticos |

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

**API Lua:** Veja [Modulo HTTP](lua-http.md)

```lua
local http = require("http")
local req = http.request()
local resp = http.response()

resp:status(200):json({users = get_users()})
```

## Bancos de Dados

| Tipo | Descricao |
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

# Em memoria para testes
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

**API Lua:** Veja [Modulo SQL](lua-sql.md)

```lua
local sql = require("sql")
local db, err = sql.get("app:database")

local rows, err = db:query("SELECT * FROM users WHERE id = ?", user_id)
db:execute("INSERT INTO logs (msg) VALUES (?)", message)
```


## Armazenamentos Chave-Valor

| Tipo | Descricao |
|------|-----------|
| `store.memory` | Armazenamento chave-valor em memoria |
| `store.sql` | Armazenamento chave-valor com backend SQL |

```yaml
# Armazenamento em memoria
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

**API Lua:** Veja [Modulo Store](lua-store.md)

```lua
local store = require("store")
local s, err = store.get("app:cache")

s:set("user:123", user_data, 3600)  -- TTL em segundos
local data = s:get("user:123")
```

## Filas

| Tipo | Descricao |
|------|-----------|
| `queue.driver.memory` | Driver de fila em memoria |
| `queue.queue` | Declaracao de fila |
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

**API Lua:** Veja [Modulo Queue](lua-queue.md)

```lua
local queue = require("queue")

-- Publica uma mensagem
queue.publish("app:jobs", {task = "process", id = 123})

-- No handler do consumidor, acessa mensagem atual
local msg = queue.message()
local data = msg:body_json()
```

<note>
O <code>func</code> do consumidor e invocado para cada mensagem. Use <code>queue.message()</code> dentro do handler para acessar a mensagem atual.
</note>

## Gerenciamento de Processos

| Tipo | Descricao |
|------|-----------|
| `process.host` | Host de execucao de processos |
| `process.service` | Processo supervisionado (encapsula process.lua) |
| `terminal.host` | Host de terminal/CLI |

```yaml
# Host de processos (onde processos executam)
- name: processes
  kind: process.host
  host:
    workers: 32             # Goroutines workers (padrao: NumCPU)
    queue_size: 1024        # Capacidade da fila global
    local_queue_size: 256   # Fila por worker
  lifecycle:
    auto_start: true

# Definicao de processo
- name: worker_process
  kind: process.lua
  source: file://worker.lua
  method: main

# Servico de processo supervisionado
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
Use <code>process.service</code> quando precisar que um processo execute como servico supervisionado com reinicializacao automatica. O campo <code>process</code> referencia uma entrada <code>process.lua</code>.
</tip>

## Temporal (Workflows)

| Tipo | Descricao |
|------|-----------|
| `temporal.client` | Conexao com cliente Temporal |
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

| Tipo | Descricao |
|------|-----------|
| `config.aws` | Configuracao AWS |
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
  endpoint: ""  # Opcional, para servicos compativeis com S3
```

**API Lua:** Veja [Modulo Cloud Storage](lua-cloudstorage.md)

```lua
local cloudstorage = require("cloudstorage")
local storage, err = cloudstorage.get("app:uploads")

storage:upload_object("files/doc.pdf", file_content)
local url = storage:presigned_get_url("files/doc.pdf", {expires = "1h"})
```

<tip>
Use <code>endpoint</code> para conectar a servicos compativeis com S3 como MinIO ou DigitalOcean Spaces.
</tip>

## Sistemas de Arquivos

| Tipo | Descricao |
|------|-----------|
| `fs.directory` | Acesso a diretorio |

```yaml
- name: data_dir
  kind: fs.directory
  directory: "./data"
  auto_init: true   # Cria se nao existir
  mode: "0755"      # Permissoes
```

**API Lua:** Veja [Modulo Filesystem](lua-fs.md)

```lua
local fs = require("fs")
local filesystem, err = fs.get("app:data_dir")

local file = filesystem:open("output.txt", "w")
file:write("Hello, World!")
file:close()
```

## Ambiente

| Tipo | Descricao |
|------|-----------|
| `env.storage.memory` | Armazenamento de env em memoria |
| `env.storage.file` | Armazenamento de env baseado em arquivo |
| `env.storage.os` | Ambiente do SO |
| `env.storage.router` | Roteador de env (multiplos armazenamentos) |
| `env.variable` | Variavel de ambiente |

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

**API Lua:** Veja [Modulo Env](lua-env.md)

```lua
local env = require("env")

local api_key = env.get("API_KEY")
env.set("CACHE_TTL", "3600")
```

<note>
O roteador tenta armazenamentos em ordem. Primeiro match ganha para leituras; escritas vao para o primeiro armazenamento gravavel.
</note>

## Templates

| Tipo | Descricao |
|------|-----------|
| `template.jet` | Template Jet individual |
| `template.set` | Configuracao de conjunto de templates |

```yaml
# Conjunto de templates com configuracao do motor
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

**API Lua:** Veja [Modulo Template](lua-template.md)

```lua
local templates = require("templates")
local set, err = templates.get("app:templates")

local html = set:render("email", {
    user = "Alice",
    message = "Bem-vindo!"
})
```

## Seguranca

| Tipo | Descricao |
|------|-----------|
| `security.policy` | Politica de seguranca com condicoes |
| `security.policy.expr` | Politica baseada em expressao |
| `security.token_store` | Armazenamento de tokens |

```yaml
# Politica baseada em condicoes
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

# Politica baseada em expressao
- name: owner_policy
  kind: security.policy.expr
  policy:
    actions: "*"
    resources: "*"
    effect: allow
    expression: 'actor.id == meta.owner_id || actor.meta.role == "admin"'
```

**API Lua:** Veja [Modulo Security](lua-security.md)

```lua
local security = require("security")

-- Verifica permissao antes da acao
if security.can("delete", "users", {user_id = id}) then
    delete_user(id)
end

-- Obtem ator atual
local actor = security.actor()
```

<warning>
Politicas sao avaliadas em ordem. A primeira politica correspondente determina o acesso. Coloque politicas mais especificas antes das gerais.
</warning>

## Contratos (Injecao de Dependencia)

| Tipo | Descricao |
|------|-----------|
| `contract.definition` | Interface com especificacoes de metodos |
| `contract.binding` | Mapeia metodos de contrato para implementacoes de funcoes |

```yaml
# Define a interface do contrato
- name: greeter
  kind: contract.definition
  methods:
    - name: greet
      description: Retorna uma mensagem de saudacao
    - name: greet_with_name
      description: Retorna uma saudacao personalizada
      input_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}
      output_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}

# Funcoes de implementacao
- name: greeter_greet
  kind: function.lua
  source: file://greeter_greet.lua
  method: main

- name: greeter_greet_name
  kind: function.lua
  source: file://greeter_greet_name.lua
  method: main

# Vincula metodos do contrato a implementacoes
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

-- Chama metodos
local result = greeter:greet()
local personalized = greeter:greet_with_name("Alice")

-- Verifica se instancia implementa contrato
local is_greeter = contract.is(greeter, "app:greeter")
```

**API Lua:** Veja [Modulo Contract](lua-contract.md)

<tip>
Marque um binding como <code>default: true</code> para usa-lo ao abrir um contrato sem especificar um ID de binding (funciona apenas quando nenhum campo <code>context_required</code> esta definido).
</tip>

## Execucao

| Tipo | Descricao |
|------|-----------|
| `exec.native` | Execucao de comando nativo |
| `exec.docker` | Execucao em container Docker |

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

## Configuracao de Ciclo de Vida

A maioria das entradas suporta configuracao de ciclo de vida:

```yaml
- name: service
  kind: some.kind
  lifecycle:
    auto_start: true          # Inicia automaticamente
    start_timeout: 10s        # Tempo maximo de inicializacao
    stop_timeout: 10s         # Tempo maximo de encerramento
    stable_threshold: 5s      # Tempo para considerar estavel
    depends_on:
      - app:database
    restart:                  # Politica de retry
      initial_delay: 1s
      max_delay: 90s
      backoff_factor: 2.0
      max_attempts: 0         # 0 = infinito
```

<note>
Use <code>depends_on</code> para garantir que entradas iniciem na ordem correta. O supervisor aguarda dependencias se tornarem estaveis antes de iniciar entradas dependentes.
</note>

## Formato de Referencia de Entradas

Entradas sao referenciadas usando o formato `namespace:name`:

```yaml
# Definicao
namespace: app.users
entries:
  - name: handler
    kind: function.lua

# Referencia de outra entrada
func: app.users:handler
```
