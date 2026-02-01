# Task-Queue

Bauen Sie eine REST-API, die Tasks zur Hintergrundverarbeitung mit Datenbankpersistenz in eine Queue stellt.

## Überblick

Dieses Tutorial erstellt eine Task-Management-API, die demonstriert:

- **REST-Endpunkte** - POST Tasks, GET Ergebnisse
- **Queue-Publishing** - Asynchrone Job-Dispatch
- **Queue-Consumers** - Hintergrund-Worker
- **Datenbank-Persistenz** - SQLite-Speicher
- **Migrationen** - Einmal-Prozess der beendet wird

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

## Projektstruktur

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

## Entry-Definitionen

Erstellen Sie `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # SQLite-Datenbank
  - name: db
    kind: db.sql.sqlite
    file: "./data/tasks.db"
    lifecycle:
      auto_start: true

  # Memory-Queue-Treiber
  - name: queue_driver
    kind: queue.driver.memory
    lifecycle:
      auto_start: true

  # Tasks-Queue
  - name: tasks_queue
    kind: queue.queue
    driver: app:queue_driver

  # HTTP-Server
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

  # Migrations-Prozess (läuft einmal, beendet sich)
  - name: migrate
    kind: process.lua
    source: file://migrate.lua
    method: main
    modules:
      - sql
      - logger

  # Migrations-Service (startet automatisch, beendet bei Erfolg)
  - name: migrate-service
    kind: process.service
    process: app:migrate
    host: app:processes
    lifecycle:
      auto_start: true

  # Prozess-Host
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  # API-Handler
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

  # Queue-Worker
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

  # Endpunkte
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

  # Queue-Consumer
  - name: task_consumer
    kind: queue.consumer
    queue: app:tasks_queue
    func: app:process_task
    concurrency: 2
    prefetch: 5
    lifecycle:
      auto_start: true
```

## Migrations-Prozess

Erstellen Sie `src/migrate.lua`:

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
Rückgabe von 0 signalisiert Erfolg. Der Supervisor startet einen Prozess nicht neu, der normal mit Code 0 beendet wird.
</tip>

## Create-Task-Endpunkt

Erstellen Sie `src/create_task.lua`:

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
        res:set_status(http.STATUS.INTERNAL_SERVER_ERROR)
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

## List-Tasks-Endpunkt

Erstellen Sie `src/list_tasks.lua`:

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
        res:set_status(http.STATUS.INTERNAL_SERVER_ERROR)
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

## Queue-Worker

Erstellen Sie `src/process_task.lua`:

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

    -- Arbeit simulieren
    time.sleep("100ms")

    -- Nach Aktion verarbeiten
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

    -- In Datenbank speichern
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
Rückgabe von <code>true</code> bestätigt die Nachricht. Rückgabe von <code>false</code> bewirkt, dass die Nachricht erneut eingereiht oder an eine Dead-Letter-Queue gesendet wird.
</note>

## Service ausführen

Initialisieren und ausführen:

```bash
mkdir -p data
wippy init
wippy run
```

API testen:

```bash
# Task erstellen
curl -X POST http://localhost:8080/tasks \
  -H "Content-Type: application/json" \
  -d '{"action": "uppercase", "data": {"text": "hello world"}}'

# Antwort: {"id": "550e8400-...", "status": "queued"}

# Kurz auf Verarbeitung warten, dann Tasks auflisten
curl http://localhost:8080/tasks

# Antwort: {"tasks": [...], "count": 1}

# Nach Status filtern
curl "http://localhost:8080/tasks?status=completed"
```

## Nachrichtenfluss

1. **POST /tasks** empfängt Anfrage, generiert UUID, publiziert in Queue
2. **Queue-Consumer** nimmt Nachricht auf (2 parallele Worker)
3. **Worker** verarbeitet Task, schreibt Ergebnis in SQLite
4. **GET /tasks** liest abgeschlossene Tasks aus Datenbank

## Demonstrierte Konzepte

| Konzept | API | Beschreibung |
|---------|-----|--------------|
| REST-Endpunkte | `http.request()`, `http.response()` | HTTP-Anfragen behandeln |
| Queue-Publishing | `queue.publish(id, data)` | Asynchrone Jobs senden |
| Queue-Consuming | `queue.message()` | Auf Nachricht im Handler zugreifen |
| Datenbank-Abfragen | `sql.get()`, `db:query()` | Daten lesen |
| Query-Builder | `sql.builder.insert()` | SQL sicher erstellen |
| Migrationen | Prozess gibt 0 zurück | Einmalige Setup-Tasks |
| Nebenläufigkeit | `concurrency: 2` | Parallele Worker |

## Nächste Schritte

- [HTTP-Modul](lua-http.md) - Request/Response-Behandlung
- [Queue-Modul](lua-queue.md) - Message-Queue-Operationen
- [SQL-Modul](lua-sql.md) - Datenbankzugriff
- [Queue-Consumers](guide-queue-consumers.md) - Queue-Konfiguration
