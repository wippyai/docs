---
title: "Referencia de Tipos de Entrada"
description: "Referencia completa de todos los tipos de entrada disponibles en Wippy."
---

# Referencia de Tipos de Entrada

Referencia completa de todos los tipos de entrada disponibles en Wippy.

> Las entradas se referencian entre sí usando el formato `namespace:nombre`. El registro conecta automáticamente las dependencias basándose en estas referencias, asegurando que los recursos se inicialicen en el orden correcto.

## Ver También

- [Registro](concepts/registry.md) - Cómo se almacenan y resuelven las entradas
- [Configuración](guides/configuration.md) - Formato de configuración YAML

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
    utils: app.lib:helpers  # Importar otra entrada como módulo
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
# Servidor HTTP
- name: gateway
  kind: http.service
  addr: ":8080"
  lifecycle:
    auto_start: true

# Router con middleware
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

**API Lua:** Ver [Módulo HTTP](lua/http/http.md)

```lua
local http = require("http")
local req = http.request()
local resp = http.response()

resp:status(200):json({users = get_users()})
```

## Bases de Datos

| Tipo | Descripción |
|------|-------------|
| `db.sql.sqlite` | Base de datos SQLite |
| `db.sql.postgres` | Base de datos PostgreSQL |
| `db.sql.mysql` | Base de datos MySQL |

### SQLite

```yaml
- name: database
  kind: db.sql.sqlite
  file: "./data/app.db"
  lifecycle:
    auto_start: true

# En memoria para pruebas
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

Consulta [Database](system/database.md) para variantes con sufijo `*_env`, opciones TLS y ajuste del pool de conexiones.

**API Lua:** Ver [Módulo SQL](lua/storage/sql.md)

```lua
local sql = require("sql")
local db, err = sql.get("app:database")

local rows, err = db:query("SELECT * FROM users WHERE id = ?", user_id)
db:execute("INSERT INTO logs (msg) VALUES (?)", message)
```


## Almacenes Clave-Valor

| Tipo | Descripción |
|------|-------------|
| `store.memory` | Almacén clave-valor en memoria |
| `store.sql` | Almacén clave-valor respaldado por SQL |
| `store.kv.raft` | KV replicado en cluster, fuertemente consistente (Raft compartido) |
| `store.kv.crdt` | KV replicado en cluster, eventualmente consistente (gossip/CRDT) |

```yaml
# Almacén en memoria
- name: cache
  kind: store.memory
  lifecycle:
    auto_start: true

# Almacén respaldado por SQL
- name: persistent_store
  kind: store.sql
  database: app:database
  table: kv_store
  lifecycle:
    auto_start: true

# Almacén replicado en cluster (requiere clustering)
- name: deployments
  kind: store.kv.raft
  namespace: deploy
```

Los tipos `store.kv.*` requieren que el [clustering](guides/cluster.md) esté habilitado. Ver [Store](system/store.md#cluster-kv-stores) para los compromisos de consistencia.

**API Lua:** Ver [Módulo Store](lua/storage/store.md)

```lua
local store = require("store")
local s, err = store.get("app:cache")

s:set("user:123", user_data, 3600)  -- TTL en segundos
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

# Cola
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

**API Lua:** Ver [Módulo Queue](lua/storage/queue.md)

```lua
local queue = require("queue")

-- Publicar un mensaje
queue.publish("app:jobs", {task = "process", id = 123})

-- En el handler del consumidor, acceder al mensaje actual
local msg = queue.message()
local data = msg:body_json()
```

<note>
El <code>func</code> del consumidor se invoca para cada mensaje. Use <code>queue.message()</code> dentro del handler para acceder al mensaje actual.
</note>

## Gestión de Procesos

| Tipo | Descripción |
|------|-------------|
| `process.host` | Host de ejecución de procesos |
| `process.service` | Proceso supervisado (envuelve process.lua) |
| `terminal.host` | Host de terminal/CLI |

```yaml
# Host de procesos (donde se ejecutan los procesos)
- name: processes
  kind: process.host
  host:
    workers: 32             # Goroutines worker (por defecto: NumCPU)
    queue_size: 1024        # Capacidad de cola global
    local_queue_size: 256   # Cola por worker
  lifecycle:
    auto_start: true

# Definición de proceso
- name: worker_process
  kind: process.lua
  source: file://worker.lua
  method: main

# Servicio de proceso supervisado
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
  access_key_id_env: "AWS_ACCESS_KEY_ID"
  secret_access_key_env: "AWS_SECRET_ACCESS_KEY"

- name: uploads
  kind: cloudstorage.s3
  config: app:aws
  bucket: "my-uploads"
  endpoint: ""  # Opcional, para servicios compatibles con S3
```

**API Lua:** Ver [Módulo Cloud Storage](lua/storage/cloud.md)

```lua
local cloudstorage = require("cloudstorage")
local storage, err = cloudstorage.get("app:uploads")

storage:upload_object("files/doc.pdf", file_content)
local url = storage:presigned_get_url("files/doc.pdf", {expires = "1h"})
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
  auto_init: true   # Crear si no existe
  mode: "0755"      # Permisos
```

**API Lua:** Ver [Módulo Filesystem](lua/storage/filesystem.md)

```lua
local fs = require("fs")
local filesystem, err = fs.get("app:data_dir")

local file = filesystem:open("output.txt", "w")
file:write("Hola, Mundo!")
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

**API Lua:** Ver [Módulo Env](lua/system/env.md)

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
# Conjunto de plantillas con configuración del motor
- name: templates
  kind: template.set
  engine:
    development_mode: false
    extensions:
      - ".jet"
      - ".html.jet"

# Plantilla individual
- name: email_template
  kind: template.jet
  source: file://templates/email.jet
  set: app:templates
```

**API Lua:** Ver [Módulo Template](lua/text/template.md)

```lua
local templates = require("templates")
local set, err = templates.get("app:templates")

local html = set:render("email", {
    user = "Alice",
    message = "Bienvenido!"
})
```

## Seguridad

| Tipo | Descripción |
|------|-------------|
| `security.policy` | Política de seguridad con condiciones |
| `security.policy.expr` | Política basada en expresiones |
| `security.token_store` | Almacén de tokens |

```yaml
# Política basada en condiciones
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

# Política basada en expresiones
- name: owner_policy
  kind: security.policy.expr
  policy:
    actions: "*"
    resources: "*"
    effect: allow
    expression: 'actor.id == meta.owner_id || actor.meta.role == "admin"'
```

**API Lua:** Ver [Módulo Security](lua/security/security.md)

```lua
local security = require("security")

-- Verificar permiso antes de acción
if security.can("delete", "users", {user_id = id}) then
    delete_user(id)
end

-- Obtener actor actual
local actor = security.actor()
```

<warning>
Las políticas se evalúan en orden. La primera política que coincide determina el acceso. Coloque políticas más específicas antes que las generales.
</warning>

## Contratos (Inyección de Dependencias)

| Tipo | Descripción |
|------|-------------|
| `contract.definition` | Interfaz con especificaciones de métodos |
| `contract.binding` | Mapea métodos de contrato a implementaciones de funciones |

```yaml
# Definir la interfaz del contrato
- name: greeter
  kind: contract.definition
  methods:
    - name: greet
      description: Retorna un mensaje de saludo
    - name: greet_with_name
      description: Retorna un saludo personalizado
      input_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}
      output_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}

# Funciones de implementación
- name: greeter_greet
  kind: function.lua
  source: file://greeter_greet.lua
  method: main

- name: greeter_greet_name
  kind: function.lua
  source: file://greeter_greet_name.lua
  method: main

# Enlazar métodos del contrato a implementaciones
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

-- Abrir binding por ID
local greeter, err = contract.open("app:greeter_impl")

-- Llamar métodos
local result = greeter:greet()
local personalized = greeter:greet_with_name("Alice")

-- Verificar si instancia implementa contrato
local is_greeter = contract.is(greeter, "app:greeter")
```

**API Lua:** Ver [Módulo Contract](lua/core/contract.md)

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
  transport: payload   # o wasi-http
```

Ver [Resumen de WASM](wasm/overview.md).

## Redes

| Tipo | Descripción |
|------|-------------|
| `network` | Overlay de red base |
| `network.socks5` | Overlay de proxy SOCKS5 |
| `network.i2p` | Overlay de red I2P |
| `network.tailscale` | Overlay de Tailscale |

Referenciado por `http.service` mediante `network:`, por `funcs`/`process` mediante la opcion `network` y por `http_client` mediante la opcion `overlay_network`. Ver [Red](system/network.md).

## Primitivas del Registro

| Tipo | Descripción |
|------|-------------|
| `registry.entry` | Descriptor de entrada (interno) |
| `ns.definition` | Definición de namespace |
| `ns.requirement` | Declaración de requisito de namespace |
| `ns.dependency` | Dependencia de namespace |

Son producidas por el cargador del registro a partir del frontmatter de `_index.yaml` y las declaraciones de dependencias. Los autores generalmente no las definen directamente — aparecen como resultado de la resolución de bloques `version:`, `namespace:` y de dependencias.

## Configuración de Ciclo de Vida

La mayoría de las entradas soportan configuración de ciclo de vida:

```yaml
- name: service
  kind: some.kind
  lifecycle:
    auto_start: true          # Iniciar automáticamente
    start_timeout: 10s        # Tiempo máximo de inicio
    stop_timeout: 10s         # Tiempo máximo de apagado
    stable_threshold: 5s      # Tiempo para considerar estable
    depends_on:
      - app:database
    restart:                  # Política de reintento
      initial_delay: 1s
      max_delay: 90s
      backoff_factor: 2.0
      max_attempts: 0         # 0 = infinito
```

<note>
Use <code>depends_on</code> para asegurar que las entradas inicien en el orden correcto. El supervisor espera a que las dependencias se estabilicen antes de iniciar entradas dependientes.
</note>

## Formato de Referencia de Entrada

Las entradas se referencian usando el formato `namespace:nombre`:

```yaml
# Definición
namespace: app.users
entries:
  - name: handler
    kind: function.lua

# Referencia desde otra entrada
func: app.users:handler
```

## Sobrescribir entradas {id="overriding-entries"}

Cualquier campo de una entrada — incluido su `kind` — puede sobrescribirse en el arranque sin editar el YAML de origen, usando la sección de configuración `override:` o el flag de CLI `-o`. Las claves usan el formato `namespace:entry:path`:

```yaml
override:
  app:gateway:addr: ":9090"        # campo de datos (una ruta simple apunta a data.*)
  app:worker:meta.priority: high    # campo meta
  app:db:kind: db.sql.postgres      # el kind tipado de la entrada
  app:db:data.kind: custom          # un campo de payload llamado literalmente "kind"
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

Los valores de CLI (`-o`) se convierten según su forma (`true`/`false` a bool, números a números, en otro caso string); los valores de la sección `override:` mantienen su tipo YAML. Para sobrescribir secciones globales de [configuración](guides/configuration.md) en lugar de entradas, usa `--set`.
