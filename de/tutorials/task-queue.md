---
title: "Task-Queue"
description: "Bauen Sie eine REST-API, die Tasks zur Hintergrundverarbeitung mit Datenbankpersistenz in eine Queue stellt."
---

# Task-Queue

Bauen Sie eine REST-API, die Tasks in eine In-Memory-Queue stellt, sie in Hintergrund-Workern verarbeitet und abgeschlossene Ergebnisse in SQLite speichert.

**Klassifizierung:** Ausführbares Tutorial. Die Seite enthält die vollständige Registry,
alle Lua-Quelldateien, Startbefehle und HTTP-Prüfungen für eine lokale Demo auf einem
einzelnen Knoten.

## Überblick

Dieses Tutorial erstellt eine Task-Management-API, die demonstriert:

- **REST-Endpunkte** — Tasks übermitteln und Ergebnisse auflisten
- **Queue-Publishing** — Jobs asynchron verteilen
- **Queue-Consumer** — Jobs in Hintergrund-Workern verarbeiten
- **Datenbankpersistenz** — Abgeschlossene Ergebnisse in SQLite speichern
- **Schema-Einrichtung** — Die Datenbanktabelle in einem einmaligen Prozess erstellen

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

## Voraussetzungen

- Wippy-Runtime `v0.3.32a`.
- `curl` oder ein anderer HTTP-Client.
- Ein leeres Arbeitsverzeichnis. Erstellen Sie das Projekt und das Quellverzeichnis,
  bevor Sie die folgenden Dateien hinzufügen:

  ```bash
  mkdir task-queue
  cd task-queue
  mkdir src
  ```

## Projektstruktur

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

## Entry-Definitionen

Erstellen Sie `src/_index.yaml`:

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

## Migrations-Prozess

Erstellen Sie `src/migrate.lua`:

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
Eine normale Rückgabe beendet einen Kindprozess von `process.service` ohne Neustart;
der Supervisor versucht einen Neustart nur, wenn der Prozess einen Fehler auslöst.
Die Rückgabe von `0` wird außerdem als erfolgreicher Exit-Status verwendet, wenn
derselbe Prozess als CLI-Befehl gestartet wird.
</tip>

## Create-Task-Endpunkt

Erstellen Sie `src/create_task.lua`:

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

## List-Tasks-Endpunkt

Erstellen Sie `src/list_tasks.lua`:

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

## Queue-Worker

Erstellen Sie `src/process_task.lua`:

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
Der Consumer bestätigt automatisch, wenn der Handler normal zurückkehrt, und verneint automatisch, wenn er einen Fehler auslöst. `msg:ack()` oder `msg:nack()` via `queue.message()` nur aufrufen, wenn explizite Kontrolle vor dem Handler-Ende benötigt wird.
</note>

## Service ausführen

Erstellen Sie das Datenverzeichnis, initialisieren Sie das Projekt und starten Sie die Runtime:

```bash
mkdir data
wippy init
wippy run
```

Lassen Sie die Runtime laufen und führen Sie die HTTP-Prüfungen in einem zweiten
Terminal aus. Warten Sie, bis die Logs melden, dass der HTTP-Service lauscht und die
Migration abgeschlossen ist; die einmalige Migration und der HTTP-Service starten
beim Booten unabhängig voneinander.

Übermitteln Sie einen Task und fragen Sie sein Ergebnis ab:

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

Die zurückgegebene Zeile sollte `status: "completed"` enthalten; ihr Feld `result`
ist ein JSON-String mit `{"output":"HELLO WORLD"}`. Die In-Memory-Queue ist bewusst
nicht dauerhaft, abgeschlossene Zeilen überstehen jedoch Neustarts in `data/tasks.db`.

## Fehlerbehebung und Bereinigung

- `no such table: tasks` bedeutet, dass die Anfrage SQLite vor Abschluss der Migration
  erreicht hat. Warten Sie auf `migration complete` und versuchen Sie es erneut. Ein
  Migrationsfehler beendet den Migrations-Service und erscheint in den Runtime-Logs.
- `failed to queue task` bedeutet meist, dass `app:queue_driver` oder
  `app:task_consumer` nicht gestartet wurde. Prüfen Sie die Start-Logs auf den ersten
  Ressourcenfehler, statt die Anfrage lediglich zu wiederholen.
- `address already in use` bedeutet, dass ein anderer Prozess Port 8080 verwendet.
  Beenden Sie ihn oder ändern Sie `app:gateway.addr` und verwenden Sie denselben Port
  in den `curl`-Befehlen.
- Beenden Sie die Runtime mit Strg+C. Entfernen Sie `data/tasks.db`, um die Tutorial-Daten
  zurückzusetzen; beim nächsten Start wird das Schema neu erstellt.

## Nachrichtenfluss

1. **POST /tasks** empfängt die Anfrage, erzeugt eine UUID und veröffentlicht den Task.
2. Ein **Queue-Consumer** empfängt die Nachricht; bis zu zwei Handler laufen parallel.
3. Der **Worker** verarbeitet den Task und schreibt das Ergebnis in SQLite.
4. **GET /tasks** liest abgeschlossene Tasks aus der Datenbank.

## Nächste Schritte

- [HTTP-Modul](../lua/http/http.md) — Verarbeitung von Requests und Responses
- [Queue-Modul](../lua/storage/queue.md) — Message-Queue-Operationen
- [SQL-Modul](../lua/storage/sql.md) — Datenbankzugriff
- [Queue-Consumer](../guides/queue-consumers.md) — Queue-Konfiguration
