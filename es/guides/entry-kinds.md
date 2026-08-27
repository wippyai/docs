---
title: "Referencia de Tipos de Entrada"
description: "Referencia completa de todos los tipos de entrada disponibles en Wippy."
---

# Referencia de Tipos de Entrada

Esta página resume los tipos de entrada disponibles y enlaza sus referencias detalladas de módulos y sistema.

Los bloques YAML y Lua son fragmentos de referencia, no una sola aplicación. Los ID del registro, credenciales, objetos de datos y helpers como `get_users` o `delete_user` son ilustrativos; consulta las páginas de módulos enlazadas para conocer los contratos completos de retorno y error.

> Las entradas se referencian entre sí usando el formato `namespace:name`. El registro usa estas referencias para resolver las dependencias y el orden de inicialización.

## Ver También

- [Registro](../concepts/registry.md) - Cómo se almacenan y resuelven las entradas
- [Configuración](./configuration.md) - Formato de configuración YAML

## Runtime de Lua

| Tipo | Descripción |
|------|-------------|
| `function.lua` | Punto de entrada de función Lua |
| `process.lua` | Proceso Lua de larga duración |
| `workflow.lua` | Flujo de trabajo Temporal (determinístico) |
| `library.lua` | Biblioteca Lua compartida |
| `module.lua` | Interfaz de módulo Lua |
| `function.lua.bc` | Bytecode de función precompilado |
| `library.lua.bc` | Bytecode de biblioteca precompilado |
| `process.lua.bc` | Bytecode de proceso precompilado |
| `workflow.lua.bc` | Bytecode de workflow precompilado |

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
Use <code>imports</code> para referenciar otras entradas Lua. Se vuelven disponibles vía <code>require("alias_name")</code> en su código.
</tip>

## Servicios HTTP

| Tipo | Descripción |
|------|-------------|
| `http.service` | Servidor HTTP (enlaza puerto) |
| `http.router` | Prefijo de ruta y middleware |
| `http.endpoint` | Endpoint HTTP (método + ruta) |
| `http.static` | Servicio de archivos estáticos |

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

**API Lua:** Ver [Módulo HTTP](../lua/http/http.md)

```lua
local http = require("http")
local req = http.request()
local resp = http.response()

resp:set_status(200)
resp:write_json({users = get_users()})
```

## Bases de Datos

| Tipo | Descripción |
|------|-------------|
| `db.sql.sqlite` | Base de datos SQLite |
| `db.sql.postgres` | Base de datos PostgreSQL |
| `db.sql.mysql` | Base de datos MySQL |
| `db.cdc.postgres` | Fuente Postgres Change Data Capture (consulta [CDC](../system/cdc.md)) |

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

Consulta [Database](../system/database.md) para referencias secretas `${env:NAME}`, opciones TLS y ajuste del pool de conexiones. Cuando cambia un valor respaldado por el entorno detrás de una entrada de base de datos, el pool se intercambia en vivo: los préstamos activos terminan con la configuración de conexión anterior.

**API Lua:** Ver [Módulo SQL](../lua/storage/sql.md)

```lua
local sql = require("sql")
local db, err = sql.get("app:database")

local rows, err = db:query("SELECT * FROM users WHERE id = ?", {user_id})
db:execute("INSERT INTO logs (msg) VALUES (?)", {message})
```


## Almacenes Clave-Valor

| Tipo | Descripción |
|------|-------------|
| `store.memory` | Almacén clave-valor en memoria |
| `store.sql` | Almacén clave-valor respaldado por SQL |
| `store.kv.raft` | KV replicado en cluster, fuertemente consistente (Raft compartido) |
| `store.kv.crdt` | KV replicado en cluster, eventualmente consistente (gossip/CRDT) |

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

Los tipos `store.kv.*` requieren que el [clustering](./cluster.md) esté habilitado. Ver [Store](../system/store.md#cluster-kv-stores) para los compromisos de consistencia.

**API Lua:** Ver [Módulo Store](../lua/storage/store.md)

```lua
local store = require("store")
local s, err = store.get("app:cache")

s:set("user:123", user_data, 3600)  -- TTL in seconds
local data = s:get("user:123")
```

## Colas

| Tipo | Descripción |
|------|-------------|
| `queue.driver.memory` | Driver de cola en memoria |
| `queue.driver.amqp` | Driver AMQP (RabbitMQ) |
| `queue.driver.sqs` | Driver AWS SQS |
| `queue.queue` | Declaración de cola |
| `queue.consumer` | Consumidor de cola |

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

**API Lua:** Ver [Módulo Queue](../lua/storage/queue.md)

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
El <code>func</code> del consumidor se invoca una vez por mensaje con el cuerpo del mensaje como argumento. Usa <code>queue.message()</code> dentro del handler para acceder a <code>id()</code>, <code>header()</code>/<code>headers()</code> y <code>ack()</code>/<code>nack()</code> de la entrega.
</note>

## Gestión de Procesos

| Tipo | Descripción |
|------|-------------|
| `process.host` | Host de ejecución de procesos |
| `process.service` | Proceso supervisado (envuelve process.lua) |
| `terminal.host` | Host de terminal/CLI |
| `pg.scope` | Ámbito de grupo de procesos (consulta [Grupos de procesos](../system/process-groups.md)) |

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
Use <code>process.service</code> cuando necesite que un proceso se ejecute como servicio supervisado con reinicio automático. El campo <code>process</code> referencia una entrada <code>process.lua</code>.
</tip>

Actualizar una entrada `process.host` en vivo reescala `host.workers` en su lugar — los procesos en ejecución, los PIDs y las colas se preservan. `host.queue_size`, `host.local_queue_size` y `lifecycle` quedan fijados en la construcción: una actualización en vivo que los cambie se rechaza, igual que redimensionar los workers de un host cuyos workers se gestionan por afinidad.

## Temporal (Flujos de Trabajo)

| Tipo | Descripción |
|------|-------------|
| `temporal.client` | Conexión de cliente Temporal |
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

## Almacenamiento en la Nube

| Tipo | Descripción |
|------|-------------|
| `config.aws` | Configuración AWS |
| `cloudstorage.s3` | Acceso a bucket S3 |

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

**API Lua:** Ver [Módulo Cloud Storage](../lua/storage/cloud.md)

```lua
local cloudstorage = require("cloudstorage")
local storage, err = cloudstorage.get("app:uploads")

storage:upload_object("files/doc.pdf", file_content)
local url = storage:presigned_get_url("files/doc.pdf", {expiration = 3600})  -- seconds, default 3600
```

<tip>
Use <code>endpoint</code> para conectarse a servicios compatibles con S3 como MinIO o DigitalOcean Spaces.
</tip>

## Sistemas de Archivos

| Tipo | Descripción |
|------|-------------|
| `fs.directory` | Acceso a directorio |
| `fs.embed` | Sistema de archivos embebido de solo lectura |

```yaml
- name: data_dir
  kind: fs.directory
  directory: "./data"
  auto_init: true   # Create if not exists
  mode: "0755"      # Permissions
```

**API Lua:** Ver [Módulo Filesystem](../lua/storage/filesystem.md)

```lua
local fs = require("fs")
local filesystem, err = fs.get("app:data_dir")

local file = filesystem:open("output.txt", "w")
file:write("Hello, World!")
file:close()
```

## Entorno

| Tipo | Descripción |
|------|-------------|
| `env.storage.memory` | Almacén de env en memoria |
| `env.storage.file` | Almacén de env basado en archivo |
| `env.storage.os` | Entorno del SO |
| `env.storage.static` | Almacenamiento estático de solo lectura clave-valor |
| `env.storage.router` | Router de env (múltiples almacenes) |
| `env.variable` | Variable de entorno |

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

**API Lua:** Ver [Módulo Env](../lua/system/env.md)

```lua
local env = require("env")

local api_key = env.get("API_KEY")
env.set("CACHE_TTL", "3600")
```

<note>
El router intenta los almacenes en orden. La primera coincidencia gana para lecturas; las escrituras van al primer almacén con escritura.
</note>

## Plantillas

| Tipo | Descripción |
|------|-------------|
| `template.jet` | Plantilla Jet individual |
| `template.set` | Configuración de conjunto de plantillas |

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

**API Lua:** Ver [Módulo Template](../lua/text/template.md)

```lua
local templates = require("templates")
local set, err = templates.get("app:templates")

local html = set:render("email", {
    user = "Alice",
    message = "Welcome!"
})
```

## Seguridad

| Tipo | Descripción |
|------|-------------|
| `security.policy` | Política de seguridad con condiciones |
| `security.policy.expr` | Política basada en expresiones |
| `security.token_store` | Almacén de tokens |

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

**API Lua:** Ver [Módulo Security](../lua/security/security.md)

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
El orden de las políticas no determina el acceso. El ámbito combina las decisiones de políticas; cualquier <code>deny</code> coincidente prevalece sobre las políticas <code>allow</code> coincidentes y puede detener la evaluación inmediatamente. Si ninguna política coincide, el resultado es indefinido, no permitido.
</warning>

## Contratos (Inyección de Dependencias)

| Tipo | Descripción |
|------|-------------|
| `contract.definition` | Interfaz con especificaciones de métodos |
| `contract.binding` | Mapea métodos de contrato a implementaciones de funciones |

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

Uso desde Lua:

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

**API Lua:** Ver [Módulo Contract](../lua/core/contract.md)

<tip>
Marque un binding como <code>default: true</code> para usarlo cuando se abra un contrato sin especificar un ID de binding (solo funciona cuando no hay campos <code>context_required</code> establecidos).
</tip>

## Ejecución

| Tipo | Descripción |
|------|-------------|
| `exec.native` | Ejecución de comandos nativos |
| `exec.docker` | Ejecución de contenedores Docker |

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

| Tipo | Descripción |
|------|-------------|
| `function.wat` | Función WebAssembly (formato de texto WAT) |
| `function.wasm` | Función WebAssembly (binario) |
| `process.wasm` | Proceso WebAssembly |

```yaml
- name: sum
  kind: function.wasm
  source: file://sum.wasm
  transport: payload   # or wasi-http
```

Ver [Resumen de WASM](../wasm/overview.md).

## Redes

| Tipo | Descripción |
|------|-------------|
| `network` | Overlay de red base |
| `network.socks5` | Overlay de proxy SOCKS5 |
| `network.i2p` | Overlay de red I2P |
| `network.tailscale` | Overlay de Tailscale |

Referenciado por `http.service` mediante `network:`, por `funcs`/`process` mediante la opción `network` y por `http_client` mediante la opción `overlay_network`. Ver [Red](../system/network.md).

## Primitivas del Registro

| Tipo | Descripción |
|------|-------------|
| `registry.entry` | Descriptor de entrada (interno) |
| `ns.definition` | Definición de namespace |
| `ns.requirement` | Declaración de requisito de namespace |
| `ns.dependency` | Dependencia de namespace |

`registry.entry` es un descriptor interno. Los autores definen directamente entradas `ns.definition`, `ns.requirement` y `ns.dependency` en `_index.yaml`; los campos `version` y `namespace` del archivo no las generan.

## Configuración de Ciclo de Vida

Las entradas de servicio gestionadas por el supervisor exponen configuración de ciclo de vida. El bloque siguiente pertenece dentro de una entrada de servicio que la admita:

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
Usa <code>requires</code> para declarar dependencias de servicios. El supervisor inicia los servicios requeridos antes que sus dependientes y considera una dependencia lista cuando está en ejecución. <code>depends_on</code> sigue aceptándose como escritura heredada, pero los manifiestos nuevos deben usar <code>requires</code>.
</note>

## Formato de Referencia de Entrada

Las entradas se referencian usando el formato `namespace:name`:

```yaml
# Definition
namespace: app.users
entries:
  - name: handler
    kind: function.lua

# Reference from another entry
func: app.users:handler
```

## Sobrescribir entradas {id="overriding-entries"}

Cualquier campo de una entrada — incluido su `kind` — puede sobrescribirse en el arranque sin editar el YAML de origen, usando la sección de configuración `override:` o el flag de CLI `-o`. Las claves usan el formato `namespace:entry:path`:

```yaml
override:
  app:gateway:addr: ":9090"        # data field (a bare path targets data.*)
  app:worker:meta.priority: high    # meta field
  app:db:kind: db.sql.postgres      # the entry's typed kind
  app:db:data.kind: custom          # a payload field literally named "kind"
```

| Ruta | Apunta a |
|------|----------|
| `kind` | El kind tipado de la entrada (debe ser un string no vacío) |
| `data.<field>` o `<field>` simple | Un campo en el payload de datos de la entrada |
| `meta.<field>` | Un campo en los metadatos de la entrada |

Las mismas sobrescrituras se aplican desde la CLI:

```bash
wippy run -o app:db:kind=db.sql.postgres -o app:gateway:addr=:9090
```

Los valores de CLI (`-o`) se convierten según su forma (`true`/`false` a bool, números a números, en otro caso string); los valores de la sección `override:` mantienen su tipo YAML. Para sobrescribir secciones globales de [configuración](./configuration.md) en lugar de entradas, usa `--set`.
