# Task Queue

Construya una API REST que encola tareas para procesamiento en background con persistencia en base de datos.

## Resumen

Este tutorial crea una API de gestion de tareas demostrando:

- **Endpoints REST** - POST tareas, GET resultados
- **Publicacion en cola** - Despacho asincrono de trabajos
- **Consumidores de cola** - Workers en background
- **Persistencia en base de datos** - Almacenamiento SQLite
- **Migraciones** - Proceso one-shot que termina

```mermaid
flowchart LR
    subgraph api["Servidor HTTP"]
        POST["/tasks POST"]
        GET["/tasks GET"]
    end

    subgraph queue["Cola"]
        Q[("cola de tareas")]
    end

    subgraph workers["Workers"]
        W1["Consumidor 1"]
        W2["Consumidor 2"]
    end

    subgraph storage["Almacenamiento"]
        DB[(SQLite)]
    end

    POST -->|publish| Q
    Q --> W1
    Q --> W2
    W1 -->|INSERT| DB
    W2 -->|INSERT| DB
    GET -->|SELECT| DB
```

## Estructura del Proyecto

```
task-queue/
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── migrate.lua
    ├── create_task.lua
    ├── list_tasks.lua
    └── process_task.lua
```

## Definiciones de Entradas

Cree `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # Base de datos SQLite
  - name: db
    kind: db.sql.sqlite
    file: "./data/tasks.db"
    lifecycle:
      auto_start: true

  # Driver de cola en memoria
  - name: queue_driver
    kind: queue.driver.memory
    lifecycle:
      auto_start: true

  # Cola de tareas
  - name: tasks_queue
    kind: queue.queue
    driver: app:queue_driver

  # Servidor HTTP
  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Router
  - name: router
    kind: http.router
    meta:
      server: app:gateway

  # Proceso de migracion (ejecuta una vez, termina)
  - name: migrate
    kind: process.lua
    source: file://migrate.lua
    method: main
    modules:
      - sql
      - logger

  # Servicio de migracion (auto-inicia, termina al exito)
  - name: migrate-service
    kind: process.service
    process: app:migrate
    host: app:processes
    lifecycle:
      auto_start: true

  # Process host
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  # Manejadores de API
  - name: create_task
    kind: function.lua
    source: file://create_task.lua
    method: handler
    modules:
      - http
      - queue
      - uuid

  - name: list_tasks
    kind: function.lua
    source: file://list_tasks.lua
    method: handler
    modules:
      - http
      - sql

  # Worker de cola
  - name: process_task
    kind: function.lua
    source: file://process_task.lua
    method: main
    modules:
      - queue
      - sql
      - logger
      - time
      - json

  # Endpoints
  - name: create_task.endpoint
    kind: http.endpoint
    meta:
      router: app:router
    method: POST
    path: /tasks
    func: app:create_task

  - name: list_tasks.endpoint
    kind: http.endpoint
    meta:
      router: app:router
    method: GET
    path: /tasks
    func: app:list_tasks

  # Consumidor de cola
  - name: task_consumer
    kind: queue.consumer
    queue: app:tasks_queue
    func: app:process_task
    concurrency: 2
    prefetch: 5
    lifecycle:
      auto_start: true
```

## Proceso de Migracion

Cree `src/migrate.lua`:

```lua
local sql = require("sql")
local logger = require("logger")

local function main()
    local db, err = sql.get("app:db")
    if err then
        logger:error("failed to connect", {error = tostring(err)})
        return 1
    end

    local _, exec_err = db:execute([[
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            result TEXT,
            created_at INTEGER NOT NULL,
            processed_at INTEGER
        )
    ]])

    db:release()

    if exec_err then
        logger:error("migration failed", {error = tostring(exec_err)})
        return 1
    end

    logger:info("migration complete")
    return 0
end

return { main = main }
```

<tip>
Retornar 0 senala exito. El supervisor no reiniciara un proceso que termina normalmente con codigo 0.
</tip>

## Endpoint Crear Tarea

Cree `src/create_task.lua`:

```lua
local http = require("http")
local queue = require("queue")
local uuid = require("uuid")

local function handler()
    local req, req_err = http.request()
    local res, res_err = http.response()

    if not req or not res then
        return nil, "failed to get HTTP context"
    end

    local body, parse_err = req:body_json()
    if parse_err then
        res:set_status(http.STATUS.BAD_REQUEST)
        res:write_json({error = "JSON invalido"})
        return
    end

    if not body.action then
        res:set_status(http.STATUS.BAD_REQUEST)
        res:write_json({error = "action requerido"})
        return
    end

    local task_id = uuid.v4()
    local task = {
        id = task_id,
        action = body.action,
        data = body.data or {},
        created_at = os.time()
    }

    local ok, err = queue.publish("app:tasks_queue", task)
    if err then
        res:set_status(http.STATUS.INTERNAL_SERVER_ERROR)
        res:write_json({error = "fallo al encolar tarea"})
        return
    end

    res:set_status(http.STATUS.ACCEPTED)
    res:write_json({
        id = task_id,
        status = "queued"
    })
end

return { handler = handler }
```

## Endpoint Listar Tareas

Cree `src/list_tasks.lua`:

```lua
local http = require("http")
local sql = require("sql")

local function handler()
    local req, req_err = http.request()
    local res, res_err = http.response()

    if not req or not res then
        return nil, "failed to get HTTP context"
    end

    local db, db_err = sql.get("app:db")
    if db_err then
        res:set_status(http.STATUS.INTERNAL_SERVER_ERROR)
        res:write_json({error = "base de datos no disponible"})
        return
    end

    local status_filter = req:query("status")

    local query = sql.builder.select("id", "payload", "status", "result", "created_at", "processed_at")
        :from("tasks")
        :order_by("created_at DESC")
        :limit(100)

    if status_filter then
        query = query:where({status = status_filter})
    end

    local rows, query_err = query:run_with(db):query()
    db:release()

    if query_err then
        res:set_status(http.STATUS.INTERNAL_SERVER_ERROR)
        res:write_json({error = "query fallo"})
        return
    end

    res:set_status(http.STATUS.OK)
    res:write_json({
        tasks = rows,
        count = #rows
    })
end

return { handler = handler }
```

## Worker de Cola

Cree `src/process_task.lua`:

```lua
local queue = require("queue")
local sql = require("sql")
local logger = require("logger")
local time = require("time")
local json = require("json")

local function main(task)
    local msg, msg_err = queue.message()
    if msg_err then
        logger:error("failed to get message", {error = tostring(msg_err)})
        return false
    end

    logger:info("processing task", {
        id = task.id,
        action = task.action
    })

    -- Simular trabajo
    time.sleep("100ms")

    -- Procesar basado en accion
    local result
    if task.action == "uppercase" then
        result = {output = string.upper(task.data.text or "")}
    elseif task.action == "sum" then
        local nums = task.data.numbers or {}
        local total = 0
        for _, n in ipairs(nums) do
            total = total + n
        end
        result = {output = total}
    else
        result = {output = "processed"}
    end

    -- Almacenar en base de datos
    local db, db_err = sql.get("app:db")
    if db_err then
        logger:error("database unavailable", {error = tostring(db_err)})
        return false
    end

    local insert = sql.builder.insert("tasks")
        :columns("id", "payload", "status", "result", "created_at", "processed_at")
        :values(
            task.id,
            json.encode(task),
            "completed",
            json.encode(result),
            task.created_at,
            os.time()
        )

    local _, exec_err = insert:run_with(db):exec()
    db:release()

    if exec_err then
        logger:error("failed to store result", {error = tostring(exec_err)})
        return false
    end

    logger:info("task completed", {id = task.id})
    return true
end

return { main = main }
```

<note>
Retornar `true` reconoce el mensaje. Retornar `false` causa que el mensaje sea reencolado o enviado a una cola de mensajes muertos.
</note>

## Ejecutando el Servicio

Inicializar y ejecutar:

```bash
mkdir -p data
wippy init
wippy run
```

Probar la API:

```bash
# Crear una tarea
curl -X POST http://localhost:8080/tasks \
  -H "Content-Type: application/json" \
  -d '{"action": "uppercase", "data": {"text": "hello world"}}'

# Respuesta: {"id": "550e8400-...", "status": "queued"}

# Esperar un momento para procesamiento, luego listar tareas
curl http://localhost:8080/tasks

# Respuesta: {"tasks": [...], "count": 1}

# Filtrar por status
curl "http://localhost:8080/tasks?status=completed"
```

## Flujo de Mensajes

1. **POST /tasks** recibe solicitud, genera UUID, publica a cola
2. **Consumidor de cola** toma mensaje (2 workers concurrentes)
3. **Worker** procesa tarea, escribe resultado a SQLite
4. **GET /tasks** lee tareas completadas desde base de datos

## Conceptos Demostrados

| Concepto | API | Descripcion |
|----------|-----|-------------|
| Endpoints REST | `http.request()`, `http.response()` | Manejar solicitudes HTTP |
| Publicacion en cola | `queue.publish(id, data)` | Enviar trabajos asincronos |
| Consumo de cola | `queue.message()` | Acceder mensaje en handler |
| Consultas de base de datos | `sql.get()`, `db:query()` | Leer datos |
| Query builder | `sql.builder.insert()` | Construir SQL de forma segura |
| Migraciones | Proceso retornando 0 | Tareas de configuracion one-shot |
| Concurrencia | `concurrency: 2` | Workers paralelos |

## Siguientes Pasos

- [Modulo HTTP](lua-http.md) - Manejo de request/response
- [Modulo Queue](lua-queue.md) - Operaciones de cola de mensajes
- [Modulo SQL](lua-sql.md) - Acceso a base de datos
- [Consumidores de Cola](guide-queue-consumers.md) - Configuracion de colas
