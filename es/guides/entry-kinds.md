# Referencia de Tipos de Entrada

Referencia completa de todos los tipos de entrada disponibles en Wippy.

> Las entradas se referencian entre si usando el formato `namespace:nombre`. El registro conecta automaticamente las dependencias basandose en estas referencias, asegurando que los recursos se inicialicen en el orden correcto.

## Ver Tambien

- [Registro](concept-registry.md) - Como se almacenan y resuelven las entradas
- [Configuracion](guide-configuration.md) - Formato de configuracion YAML

## Runtime de Lua

| Tipo | Descripcion |
|------|-------------|
| `function.lua` | Punto de entrada de funcion Lua |
| `process.lua` | Proceso Lua de larga duracion |
| `workflow.lua` | Flujo de trabajo Temporal (deterministico) |
| `library.lua` | Biblioteca Lua compartida |

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
  imports:
    utils: app.lib:helpers  # Importar otra entrada como modulo
```

<tip>
Use <code>imports</code> para referenciar otras entradas Lua. Se vuelven disponibles via <code>require("alias_name")</code> en su codigo.
</tip>

## Servicios HTTP

| Tipo | Descripcion |
|------|-------------|
| `http.service` | Servidor HTTP (enlaza puerto) |
| `http.router` | Prefijo de ruta y middleware |
| `http.endpoint` | Endpoint HTTP (metodo + ruta) |
| `http.static` | Servicio de archivos estaticos |

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

**API Lua:** Ver [Modulo HTTP](lua-http.md)

```lua
local http = require("http")
local req = http.request()
local resp = http.response()

resp:status(200):json({users = get_users()})
```

## Bases de Datos

| Tipo | Descripcion |
|------|-------------|
| `db.sql.sqlite` | Base de datos SQLite |
| `db.sql.postgres` | Base de datos PostgreSQL |
| `db.sql.mysql` | Base de datos MySQL |
| `db.sql.mssql` | Microsoft SQL Server |
| `db.sql.oracle` | Base de datos Oracle |

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

**API Lua:** Ver [Modulo SQL](lua-sql.md)

```lua
local sql = require("sql")
local db, err = sql.get("app:database")

local rows, err = db:query("SELECT * FROM users WHERE id = ?", user_id)
db:execute("INSERT INTO logs (msg) VALUES (?)", message)
```

## Almacenes Clave-Valor

| Tipo | Descripcion |
|------|-------------|
| `store.memory` | Almacen clave-valor en memoria |
| `store.sql` | Almacen clave-valor respaldado por SQL |

```yaml
# Almacen en memoria
- name: cache
  kind: store.memory
  lifecycle:
    auto_start: true

# Almacen respaldado por SQL
- name: persistent_store
  kind: store.sql
  database: app:database
  table: kv_store
  lifecycle:
    auto_start: true
```

**API Lua:** Ver [Modulo Store](lua-store.md)

```lua
local store = require("store")
local s, err = store.get("app:cache")

s:set("user:123", user_data, 3600)  -- TTL en segundos
local data = s:get("user:123")
```

## Colas

| Tipo | Descripcion |
|------|-------------|
| `queue.driver.memory` | Driver de cola en memoria |
| `queue.queue` | Declaracion de cola |
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

**API Lua:** Ver [Modulo Queue](lua-queue.md)

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

## Gestion de Procesos

| Tipo | Descripcion |
|------|-------------|
| `process.host` | Host de ejecucion de procesos |
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

# Definicion de proceso
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
Use <code>process.service</code> cuando necesite que un proceso se ejecute como servicio supervisado con reinicio automatico. El campo <code>process</code> referencia una entrada <code>process.lua</code>.
</tip>

## Temporal (Flujos de Trabajo)

| Tipo | Descripcion |
|------|-------------|
| `temporal.client` | Conexion de cliente Temporal |
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

| Tipo | Descripcion |
|------|-------------|
| `config.aws` | Configuracion AWS |
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

**API Lua:** Ver [Modulo Cloud Storage](lua-cloudstorage.md)

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

| Tipo | Descripcion |
|------|-------------|
| `fs.directory` | Acceso a directorio |

```yaml
- name: data_dir
  kind: fs.directory
  directory: "./data"
  auto_init: true   # Crear si no existe
  mode: "0755"      # Permisos
```

**API Lua:** Ver [Modulo Filesystem](lua-fs.md)

```lua
local fs = require("fs")
local filesystem, err = fs.get("app:data_dir")

local file = filesystem:open("output.txt", "w")
file:write("Hola, Mundo!")
file:close()
```

## Entorno

| Tipo | Descripcion |
|------|-------------|
| `env.storage.memory` | Almacen de env en memoria |
| `env.storage.file` | Almacen de env basado en archivo |
| `env.storage.os` | Entorno del SO |
| `env.storage.router` | Router de env (multiples almacenes) |
| `env.variable` | Variable de entorno |

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

**API Lua:** Ver [Modulo Env](lua-env.md)

```lua
local env = require("env")

local api_key = env.get("API_KEY")
env.set("CACHE_TTL", "3600")
```

<note>
El router intenta los almacenes en orden. La primera coincidencia gana para lecturas; las escrituras van al primer almacen con escritura.
</note>

## Plantillas

| Tipo | Descripcion |
|------|-------------|
| `template.jet` | Plantilla Jet individual |
| `template.set` | Configuracion de conjunto de plantillas |

```yaml
# Conjunto de plantillas con configuracion del motor
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

**API Lua:** Ver [Modulo Template](lua-template.md)

```lua
local templates = require("templates")
local set, err = templates.get("app:templates")

local html = set:render("email", {
    user = "Alice",
    message = "Bienvenido!"
})
```

## Seguridad

| Tipo | Descripcion |
|------|-------------|
| `security.policy` | Politica de seguridad con condiciones |
| `security.policy.expr` | Politica basada en expresiones |
| `security.token_store` | Almacen de tokens |

```yaml
# Politica basada en condiciones
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

# Politica basada en expresiones
- name: owner_policy
  kind: security.policy.expr
  policy:
    actions: "*"
    resources: "*"
    effect: allow
    expression: 'actor.id == meta.owner_id || actor.meta.role == "admin"'
```

**API Lua:** Ver [Modulo Security](lua-security.md)

```lua
local security = require("security")

-- Verificar permiso antes de accion
if security.can("delete", "users", {user_id = id}) then
    delete_user(id)
end

-- Obtener actor actual
local actor = security.actor()
```

<warning>
Las politicas se evaluan en orden. La primera politica que coincide determina el acceso. Coloque politicas mas especificas antes que las generales.
</warning>

## Contratos (Inyeccion de Dependencias)

| Tipo | Descripcion |
|------|-------------|
| `contract.definition` | Interfaz con especificaciones de metodos |
| `contract.binding` | Mapea metodos de contrato a implementaciones de funciones |

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

# Funciones de implementacion
- name: greeter_greet
  kind: function.lua
  source: file://greeter_greet.lua
  method: main

- name: greeter_greet_name
  kind: function.lua
  source: file://greeter_greet_name.lua
  method: main

# Enlazar metodos del contrato a implementaciones
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

-- Llamar metodos
local result = greeter:greet()
local personalized = greeter:greet_with_name("Alice")

-- Verificar si instancia implementa contrato
local is_greeter = contract.is(greeter, "app:greeter")
```

**API Lua:** Ver [Modulo Contract](lua-contract.md)

<tip>
Marque un binding como <code>default: true</code> para usarlo cuando se abra un contrato sin especificar un ID de binding (solo funciona cuando no hay campos <code>context_required</code> establecidos).
</tip>

## Ejecucion

| Tipo | Descripcion |
|------|-------------|
| `exec.native` | Ejecucion de comandos nativos |
| `exec.docker` | Ejecucion de contenedores Docker |

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

## Configuracion de Ciclo de Vida

La mayoria de las entradas soportan configuracion de ciclo de vida:

```yaml
- name: service
  kind: some.kind
  lifecycle:
    auto_start: true          # Iniciar automaticamente
    start_timeout: 10s        # Tiempo maximo de inicio
    stop_timeout: 10s         # Tiempo maximo de apagado
    stable_threshold: 5s      # Tiempo para considerar estable
    depends_on:
      - app:database
    restart:                  # Politica de reintento
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
# Definicion
namespace: app.users
entries:
  - name: handler
    kind: function.lua

# Referencia desde otra entrada
func: app.users:handler
```
