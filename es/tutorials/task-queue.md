---
title: "Cola de Tareas"
description: "Crea una API REST que pone tareas en cola para procesarlas en segundo plano con persistencia en base de datos."
---

# Cola de Tareas

Crea una API REST que publica tareas en una cola en memoria, las procesa en workers en segundo plano y almacena los resultados completados en SQLite.

**Clasificación:** tutorial ejecutable. La página proporciona el registro completo, las fuentes Lua, los comandos de inicio y las comprobaciones HTTP para una demostración local de un solo nodo.

## Resumen

Este tutorial crea una API de gestión de tareas demostrando:

- **Endpoints REST** - POST tareas, GET resultados
- **Publicación en cola** - Despacho asíncrono de trabajos
- **Consumidores de cola** - Workers en background
- **Persistencia en base de datos** - Almacenamiento SQLite
- **Migraciones** - Proceso one-shot que termina

```mermaid
flowchart LR
    subgraph api["HTTP Server"]
        POST["/tasks POST"]
        GET["/tasks GET"]
    end

    subgraph queue["Queue"]
        Q[("tasks queue")]
    end

    subgraph workers["Workers"]
        W1["Consumer 1"]
        W2["Consumer 2"]
    end

    subgraph storage["Storage"]
        DB[(SQLite)]
    end

    POST -->|publish| Q
    Q --> W1
    Q --> W2
    W1 -->|INSERT| DB
    W2 -->|INSERT| DB
    GET -->|SELECT| DB
```

## Requisitos previos

- Entorno de ejecución Wippy `v0.3.32a`.
- `curl` u otro cliente HTTP.
- Un directorio de trabajo vacío. Crea el proyecto y el directorio de fuentes antes de añadir los archivos siguientes:

  ```bash
  mkdir task-queue
  cd task-queue
  mkdir src
  ```

## Estructura del Proyecto

```
task-queue/
├── wippy.lock
├── data/                    # created before startup
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
  # Capabilities used by the tutorial's Lua entries in strict mode
  - name: runtime_policy
    kind: security.policy
    policy:
      actions:
        - db.get
        - queue.publish
        - queue.publish.queue
      resources: "*"
      effect: allow

  # SQLite database
  - name: db
    kind: db.sql.sqlite
    file: "./data/tasks.db"
    lifecycle:
      auto_start: true

  # Memory queue driver
  - name: queue_driver
    kind: queue.driver.memory
    lifecycle:
      auto_start: true

  # Tasks queue
  - name: tasks_queue
    kind: queue.queue
    driver: app:queue_driver

  # HTTP server
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

  # Migration process (runs once, exits)
  - name: migrate
    kind: process.lua
    source: file://migrate.lua
    method: main
    modules:
      - sql
      - logger
    security:
      actor:
        id: app:migrate
      policies:
        - app:runtime_policy

  # Migration service (auto-starts, exits on success)
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

  # API handlers
  - name: create_task
    kind: function.lua
    source: file://create_task.lua
    method: handler
    modules:
      - http
      - queue
      - uuid
    security:
      actor:
        id: app:create_task
      policies:
        - app:runtime_policy

  - name: list_tasks
    kind: function.lua
    source: file://list_tasks.lua
    method: handler
    modules:
      - http
      - sql
    security:
      actor:
        id: app:list_tasks
      policies:
        - app:runtime_policy

  # Queue worker
  - name: process_task
    kind: function.lua
    source: file://process_task.lua
    method: main
    modules:
      - sql
      - logger
      - json
    security:
      actor:
        id: app:process_task
      policies:
        - app:runtime_policy

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

  # Queue consumer
  - name: task_consumer
    kind: queue.consumer
    queue: app:tasks_queue
    func: app:process_task
    concurrency: 2
    prefetch: 5
    lifecycle:
      auto_start: true
```

## Proceso de Migración

Cree `src/migrate.lua`:

```lua
local sql = require("sql")
local logger = require("logger")

local function main()
    local db, err = sql.get("app:db")
    if err then
        logger:error("failed to connect", {error = tostring(err)})
        error("failed to connect: " .. tostring(err))
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
        error("migration failed: " .. tostring(exec_err))
    end

    logger:info("migration complete")
    return 0
end

return { main = main }
```

<tip>
Un retorno normal termina el hijo de un `process.service` sin reiniciarlo; el supervisor solo reintenta cuando el proceso genera un error. Devolver `0` también se traduce en un estado de salida correcto si el mismo proceso se inicia como comando CLI.
</tip>

## Endpoint Crear Tarea

Cree `src/create_task.lua`:

```lua
local http = require("http")
local queue = require("queue")
local uuid = require("uuid")

local function handler()
    local req = http.request()
    local res = http.response()

    local body, parse_err = req:body_json()
    if parse_err then
        res:set_status(http.STATUS.BAD_REQUEST)
        res:write_json({error = "invalid JSON"})
        return
    end

    if not body.action then
        res:set_status(http.STATUS.BAD_REQUEST)
        res:write_json({error = "action required"})
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
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({error = "failed to queue task"})
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
    local req = http.request()
    local res = http.response()

    local db, db_err = sql.get("app:db")
    if db_err then
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({error = "database unavailable"})
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
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({error = "query failed"})
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
local sql = require("sql")
local logger = require("logger")
local json = require("json")

local function main(task)
    logger:info("processing task", {
        id = task.id,
        action = task.action
    })

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

    local db, db_err = sql.get("app:db")
    if db_err then
        error("database unavailable: " .. tostring(db_err))
    end

    local _, exec_err = db:execute(
        "INSERT OR REPLACE INTO tasks (id, payload, status, result, created_at, processed_at) VALUES (?, ?, ?, ?, ?, ?)",
        { task.id, json.encode(task), "completed", json.encode(result), task.created_at, os.time() }
    )
    db:release()

    if exec_err then
        error("failed to store result: " .. tostring(exec_err))
    end

    logger:info("task completed", {id = task.id})
end

return { main = main }
```

<note>
El consumidor hace auto-ack cuando el handler retorna normalmente y auto-nack cuando lanza un error. Llama a `msg:ack()` o `msg:nack()` vía `queue.message()` solo cuando necesitas control explícito antes de que el handler termine.
</note>

## Ejecutando el Servicio

Crea el directorio de datos, inicializa el proyecto e inicia el entorno de ejecución:

```bash
mkdir data
wippy init
wippy run
```

Mantén el entorno de ejecución activo mientras utilizas un segundo terminal para las comprobaciones HTTP. Espera hasta que los logs indiquen que el servicio HTTP escucha y que terminó la migración; la migración de una sola ejecución y el servicio HTTP se inician de forma independiente durante el arranque.

Envía una tarea y consulta su resultado:

```bash
# Create a task
curl -X POST http://localhost:8080/tasks \
  -H "Content-Type: application/json" \
  -d '{"action": "uppercase", "data": {"text": "hello world"}}'

# Response: {"id":"<generated-uuid>","status":"queued"}

# Wait a moment for processing, then list tasks
curl http://localhost:8080/tasks

# Response includes one completed task and "count":1

# Filter by status
curl "http://localhost:8080/tasks?status=completed"
```

La fila devuelta debe tener `status: "completed"`; su campo `result` es una cadena JSON que contiene `{"output":"HELLO WORLD"}`. La cola en memoria no es duradera de forma intencionada, pero las filas completadas sobreviven a los reinicios en `data/tasks.db`.

## Solución de problemas y limpieza

- `no such table: tasks` significa que la solicitud llegó a SQLite antes de que terminara la migración. Espera a `migration complete` y vuelve a intentarlo. Un error de migración detiene el servicio de migración y aparece en los logs del entorno de ejecución.
- `failed to queue task` suele significar que `app:queue_driver` o `app:task_consumer` no se inició. Busca el primer error de recurso en los logs de inicio en lugar de volver a intentar la solicitud.
- `address already in use` significa que otro proceso utiliza el puerto 8080. Deténlo o cambia `app:gateway.addr` y utiliza el mismo puerto en los comandos `curl`.
- Detén el entorno de ejecución con Ctrl+C. Elimina `data/tasks.db` para restablecer los datos del tutorial; el siguiente inicio vuelve a crear el esquema.

## Flujo de Mensajes

1. **POST /tasks** recibe solicitud, genera UUID, publica a cola
2. **Consumidor de cola** toma mensaje (2 workers concurrentes)
3. **Worker** procesa tarea, escribe resultado a SQLite
4. **GET /tasks** lee tareas completadas desde base de datos

## Siguientes Pasos

- [Módulo HTTP](lua/http/http.md) — Gestión de solicitudes y respuestas
- [Módulo Queue](lua/storage/queue.md) — Operaciones de cola de mensajes
- [Módulo SQL](lua/storage/sql.md) — Acceso a bases de datos
- [Consumidores de cola](guides/queue-consumers.md) — Configuración de colas
