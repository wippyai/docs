---
title: "LLM-Kurzreferenz"
description: "Zentrale Wippy-Konzepte, Projektstruktur, APIs und Konventionen für Agenten, die Wippy-Code erzeugen."
---

# LLM-Kurzreferenz

Verwenden Sie diese Kurzreferenz als Ausgangskontext, wenn Sie Code für ein Wippy-Projekt erzeugen.

**Klassifizierung: Generierungsreferenz.** Die folgenden Blöcke zeigen gezielte Vertragsmuster und bilden kein eigenständig ausführbares Projekt. Registry-IDs, Schemas, Richtlinien und anwendungsspezifische Werte wie `user_id`, `config` und `content` müssen im verwendenden Projekt definiert werden.

## Was Wippy ist

Wippy ist eine Single-Binary-Anwendungs-Runtime auf Grundlage des Aktormodells. Sie führt Lua-Code in isolierten Prozessen aus, die durch Nachrichten statt gemeinsamen Speicher kommunizieren. Die drei Compute-Modelle sind Funktionen (zustandslos und an eine Anfrage gebunden), Prozesse (lang laufende Aktoren mit Zustand) und Workflows (dauerhafte, von Temporal gestützte Aktoren). Registry-gestütztes Verhalten lässt sich hinzufügen oder aktualisieren, ohne die Runtime neu bereitzustellen.

## Mentales Modell

Alles in Wippy ist ein **Registry-Eintrag**. Ein Eintrag hat eine ID (`namespace:name`), ein Feld `kind`, das sein Verhalten bestimmt, Metadaten und Daten. YAML-Dateien sind eine Möglichkeit, Einträge zu deklarieren; die Registry ist jedoch die maßgebliche Runtime-Quelle. Einträge können außerdem während des Betriebs erstellt, aktualisiert oder gelöscht werden.

Arten bestimmen, was ein Eintrag tut:

- `function.lua` — zustandslose aufrufbare Funktion
- `process.lua` — langlaufender Aktor
- `workflow.lua` — dauerhafter Workflow (Temporal)
- `http.service` — HTTP-Server
- `http.router` — Routengruppe mit Middleware
- `http.endpoint` — HTTP-Handler
- `db.sql.postgres` / `mysql` / `sqlite` — Datenbankverbindung
- `store.memory` / `store.sql` — Key-Value-Speicher
- `queue.queue` — Nachrichtenwarteschlange
- `process.host` — Host für die Prozessausführung
- `process.service` — überwachter Prozess
- `contract.definition` / `contract.binding` — typisierte Dienstschnittstellen
- `registry.entry` — Konfigurationsdaten

## Projektstruktur

```
myapp/
├── .wippy.yaml              # Runtime configuration
├── wippy.lock               # Source directories
└── src/
    ├── _index.yaml          # Entry definitions (namespace: app)
    ├── api/
    │   ├── _index.yaml      # namespace: app.api
    │   └── handler.lua
    └── workers/
        ├── _index.yaml      # namespace: app.workers
        └── task.lua
```

Eintragsdefinitionen befinden sich in `_index.yaml`-Dateien:

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    source: file://handler.lua
    method: get_user
    modules: [sql]

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      router: app:api_router
    method: GET
    path: /users/{id}
    func: app.api:get_user
```

## Funktionen schreiben

Funktionen sind zustandslos: Sie erhalten Argumente, führen Arbeit aus und geben Ergebnisse zurück. Sie erben den Kontext des Aufrufers und werden abgebrochen, wenn der Aufrufer abgebrochen wird.

```lua
local sql = require("sql")

local function get_user(id)
    local db, err = sql.get("app:main_db")
    if err then return nil, err end

    local rows, err = db:query("SELECT * FROM users WHERE id = $1", {id})
    if err then
        local _, release_err = db:release()
        return nil, release_err or err
    end

    local _, release_err = db:release()
    if release_err then return nil, release_err end
    if #rows == 0 then
        return nil, errors.new({kind = errors.NOT_FOUND, message = "user not found"})
    end

    return rows[1]
end

return get_user
```

Verwenden Sie für HTTP-Handler das `http`-Modul:

```lua
local http = require("http")
local funcs = require("funcs")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local id, param_err = req:param("id")
    if param_err then return nil, param_err end
    local user, err = funcs.call("app.api:get_user", id)
    if err then
        local status_err
        if errors.is(err, errors.NOT_FOUND) then
            status_err = res:set_status(404)
        else
            status_err = res:set_status(500)
        end
        if status_err then return nil, status_err end
        local write_err = res:write_json({error = err:message()})
        if write_err then return nil, write_err end
        return true
    end

    local write_err = res:write_json(user)
    if write_err then return nil, write_err end
    return true
end

return handler
```

## Prozesse schreiben

Prozesse sind Aktoren. Jeder Prozess hat eine PID, empfängt Nachrichten über eine Inbox und kann Zustand über mehrere Nachrichten hinweg behalten. Während er auf E/A wartet, gibt er die Ausführung frei, damit andere Prozesse laufen können.

```lua
local function worker(initial_config)
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local r = channel.select {
            inbox:case_receive(),
            events:case_receive()
        }

        if not r.ok then break end

        if r.channel == events then
            local ev = r.value
            if ev.kind == process.event.CANCEL then
                break
            end
        elseif r.channel == inbox then
            local msg = r.value
            local topic = msg:topic()
            local data, err = msg:payload():data()
            if err then return nil, err end

            if topic == "work" then
                -- Perform the application-specific work here.
                print(data.item_id)
            end
        end
    end
end

return worker
```

Prozesse aus anderem Code spawnen:

```lua
local pid, err = process.spawn("app.workers:task", "app:process_host", config)
if err then return nil, err end

local ok, send_err = process.send(pid, "work", {item_id = 123})
if send_err then return nil, send_err end
return ok
```

## Workflows schreiben

Workflows speichern Ausführungshistorie dauerhaft, damit sie nach Abstürzen oder Neustarts fortgesetzt werden können. Workflow-Code verwendet normale Lua-Syntax; die Runtime zeichnet Funktionsergebnisse, Wartezeiten und Zufallswerte für ein deterministisches Replay auf.

Jedes Ziel von `funcs.call()` im folgenden Beispiel muss über `meta.temporal.activity.worker` als Activity beim selben Temporal-Worker registriert sein. Die erforderlichen Funktionsmetadaten beschreibt [Activities](../temporal/activities.md).

```lua
local funcs = require("funcs")

local function compensate(inventory, payment)
    local _, refund_err = funcs.call("app:refund_payment", payment.id)
    local _, release_err = funcs.call("app:release_inventory", inventory.id)
    return refund_err or release_err
end

local function order_flow(order)
    local inventory, err = funcs.call("app:reserve_inventory", order.items)
    if err then return nil, err end

    local payment, payment_err = funcs.call("app:charge_payment", order.total)
    if payment_err then
        local _, release_err = funcs.call("app:release_inventory", inventory.id)
        return nil, release_err or payment_err
    end

    -- Wait for approval signal (can block for days)
    local msg, open = process.inbox():receive()
    if not open then
        local compensation_err = compensate(inventory, payment)
        return nil, compensation_err or errors.new("workflow inbox closed")
    end

    local decision, payload_err = msg:payload():data()
    if payload_err then
        local compensation_err = compensate(inventory, payment)
        return nil, compensation_err or payload_err
    end
    if not decision.approved then
        local compensation_err = compensate(inventory, payment)
        return nil, compensation_err or errors.new("rejected")
    end

    return funcs.call("app:fulfill_order", order.id)
end

return order_flow
```

## Wichtige APIs

### Funktionen aufrufen

```lua
local funcs = require("funcs")

-- Synchronous
local result, err = funcs.call("namespace:function_name", arg1, arg2)
if err then return nil, err end

-- Asynchronous (returns Future)
local future, future_err = funcs.async("namespace:function_name", arg1)
if future_err then return nil, future_err end
local response_ch = future:response()
local _, response_open = response_ch:receive()
if not response_open then
    return nil, errors.new("future response channel closed")
end
local async_payload, async_err = future:result()
if async_err then return nil, async_err end
local async_result, decode_err = async_payload:data()
if decode_err then return nil, decode_err end

-- With context
local contextual_exec, contextual_err = funcs.new():with_context({user_id = "123"})
if contextual_err then return nil, contextual_err end
local contextual_result, contextual_err = contextual_exec:call("namespace:function_name")
if contextual_err then return nil, contextual_err end
```

### Prozesskommunikation

```lua
-- Send message (fire-and-forget)
local ok, err = process.send(pid, "topic", data)
if err then return nil, err end

-- Receive messages
local inbox = process.inbox()
local msg, ok = inbox:receive()
if not ok then return nil, errors.new("process inbox closed") end
local topic = msg:topic()
local data, payload_err = msg:payload():data()
if payload_err then return nil, payload_err end

-- Monitor another process (receive EXIT on death)
local monitored, monitor_err = process.monitor(pid)
if monitor_err then return nil, monitor_err end

-- Link processes (bidirectional failure notification)
local linked_pid, spawn_err = process.spawn_linked("namespace:name", "host")
if spawn_err then return nil, spawn_err end
```

### Kanäle

Kanäle im Go-Stil für die Kommunikation zwischen Koroutinen:

```lua
local ch = channel.new(10)  -- buffered
ch:send(value)
local val, ok = ch:receive()

-- Select on multiple channels
local r = channel.select {
    ch1:case_receive(),
    ch2:case_receive(),
    timeout:case_receive()
}
```

### Fehlerbehandlung

Funktionen geben `result, error`-Paare zurück. Fehler sind typisierte Objekte:

```lua
local result, err = some_operation()
if err then
    if errors.is(err, errors.NOT_FOUND) then
        -- handle not found
    end
    return nil, errors.wrap(err, "context message")
end
```

Fehlerarten: `UNKNOWN`, `INVALID`, `NOT_FOUND`, `ALREADY_EXISTS`, `PERMISSION_DENIED`, `TIMEOUT`, `CANCELED`, `UNAVAILABLE`, `INTERNAL`, `CONFLICT`, `RATE_LIMITED`.

### Datenzugriff

```lua
-- SQL
local sql = require("sql")
local db, db_err = sql.get("app:main_db")
if db_err then return nil, db_err end
local rows, err = db:query("SELECT * FROM users WHERE active = $1", {true})
if err then
    local _, release_err = db:release()
    return nil, release_err or err
end
local _, release_err = db:release()
if release_err then return nil, release_err end

-- Key-value store
local store = require("store")
local cache, cache_err = store.get("app:cache")
if cache_err then return nil, cache_err end
local stored, set_err = cache:set("key", value, 3600)  -- TTL in seconds
if set_err then
    cache:release()
    return nil, set_err
end
local val, get_err = cache:get("key")
cache:release()
if get_err then return nil, get_err end

-- Queue
local queue = require("queue")
local published, publish_err = queue.publish("app:tasks", {task = "process", id = 123})
if publish_err then return nil, publish_err end

-- Filesystem
local fs = require("fs")
local vol, volume_err = fs.get("app:storage")
if volume_err then return nil, volume_err end
local data, read_err = vol:readfile("path/to/file.txt")
if read_err then return nil, read_err end
local written, write_err = vol:writefile("output.txt", content)
if write_err then return nil, write_err end
```

### HTTP-Client

```lua
local http_client = require("http_client")

local resp, err = http_client.get("https://api.example.com/data", {
    headers = {Authorization = "Bearer token"},
    timeout = "10s"
})
if err then return nil, err end
local body = resp.body
```

### Sicherheit

```lua
local security = require("security")

local actor = security.actor()       -- who is calling
local scope = security.scope()       -- what permissions apply
if not actor then return nil, errors.new("security actor unavailable") end
if not scope then return nil, errors.new("security scope unavailable") end
local allowed = security.can("read", "resource:users")

-- Token management
local ts, store_err = security.token_store("app:tokens")
if store_err then return nil, store_err end
local token, create_err = ts:create(actor, scope, {expiration = "24h"})
if create_err then
    ts:close()
    return nil, create_err
end
local validated_actor, validated_scope, validate_err = ts:validate(token)
ts:close()
if validate_err then return nil, validate_err end
```

### Zeit

```lua
local time = require("time")

time.sleep("5s")
local now = time.now()
local timeout, timeout_err = time.after("30s")  -- channel that fires once
if timeout_err then return nil, timeout_err end
local ticker, ticker_err = time.ticker("10s")  -- repeating channel
if ticker_err then return nil, ticker_err end
-- Stop the ticker when its consumer finishes.
ticker:stop()
```

### Registry

```lua
local registry = require("registry")

local entry, entry_err = registry.get("app.api:get_user")
if entry_err then return nil, entry_err end
local tests, find_err = registry.find({["meta.type"] = "test"})
if find_err then return nil, find_err end

-- Create entries at runtime
local snap, snapshot_err = registry.snapshot()
if snapshot_err then return nil, snapshot_err end
local changes, changes_err = snap:changes()
if changes_err then return nil, changes_err end
local _, create_err = changes:create({id = "app:new_func", kind = "function.lua", data = {...}})
if create_err then return nil, create_err end
local version, apply_err = changes:apply()
if apply_err then return nil, apply_err end
```

### Events

```lua
local events = require("events")

-- Publish
local sent, send_err = events.send("orders", "order.created", "/orders/123", {order_id = "123"})
if send_err then return nil, send_err end

-- Subscribe (wildcards supported)
local sub, subscribe_err = events.subscribe("orders.*")
if subscribe_err then return nil, subscribe_err end
local ch = sub:channel()
local evt, open = ch:receive()
sub:close()
if not open then return nil, errors.new("event subscription closed") end
```

## Zugriffskontrolle auf Module

Jeder Eintrag erhält die eingeschränkte Basisumgebung und Standardbibliotheken; ausführbare Einträge erhalten außerdem das ambient verfügbare Modul `process`. Fügen Sie nicht-ambient verfügbare Runtime-Module unter `modules:` und Registry-gestützte Bibliotheken unter `imports:` hinzu. Nicht deklarierte, nicht-ambient verfügbare Module stehen nicht zur Verfügung. Host-Lua-Funktionen wie `os.execute`, `io.open`, `debug.*`, das Laden nativer Module und beliebige Auflösung über `package.path` werden nicht als optionale Runtime-Module angeboten. Die Runtime steuert die Verfügbarkeit über ihren Modul-Loader, nicht durch Quellcode-Scanning.

```yaml
modules: [sql, json, http, time, funcs, store]
```

Workflow-Einträge erhalten nur deterministische Module. Die Runtime fängt `time.now()`, `uuid.v4()` und andere nichtdeterministische Aufrufe auf Modulebene ab und zeichnet ihre Ergebnisse für das Replay auf.

## Framework-Module

Framework-Funktionen werden als Abhängigkeiten verteilt:

- **wippy/llm** — LLM-Integration (OpenAI, Anthropic, Google). `llm.generate()`, strukturierte Ausgabe, Embeddings, Streaming.
- **wippy/agent** — Agenten-Framework mit Tool-Nutzung, Delegation, Traits und Speicher. Agenten werden als Registry-Einträge definiert.
- **wippy/test** — BDD-Tests mit `describe`-/`it`-Blöcken, Assertions und Mocking.
- **wippy/dataflow** — DAG-basierte Workflow-Orchestrierung. Function-, Agent-, Cycle-, Parallel-Nodes.
- **wippy/relay** — WebSocket-Relay mit zentralem Hub, Per-User-Hubs, Plugin-Routing.
- **wippy/views** — Seiten- und Komponentensystem mit Template-Rendering.
- **wippy/facade** — Frontend-Fassade und Authentifizierungs-Bridge für Iframe- und Web-Fragment-Seiten.

## Konventionen

- Eintrags-IDs verwenden das Format `namespace:name`
- Namen verwenden Punkte zur semantischen Trennung und Unterstriche für Wörter: `get_user.endpoint`
- Fehleranfällige APIs geben `result, error` zurück — prüfen Sie den Fehler immer
- Prozesse kommunizieren durch Nachrichten statt über gemeinsamen Zustand
- Verwende `channel.select`, um mehrere Ereignisquellen zu multiplexen
- Lassen Sie Supervision-Trees Prozessfehler behandeln, statt jede Operation lokal abzusichern
- Kontext (Trace-IDs, Benutzerinfo, Sicherheit) propagiert automatisch durch Funktionsaufrufe
- Workflows dürfen nichtdeterministische Operationen nicht direkt verwenden — die Runtime übernimmt dies für `funcs.call`, `time.sleep`, `uuid.v4` und `time.now`

## Dokumentation

Die vollständige Dokumentation finden Sie unter [docs.wippy.ai](https://docs.wippy.ai). LLM-freundliche Endpoints:

- Struktur durchsuchen: `https://wippy.ai/llm/toc`
- Suche: `https://wippy.ai/llm/search?q=query`
- Seite abrufen: `https://wippy.ai/llm/path/en/<path>`
- Batch-Abruf: `https://wippy.ai/llm/context?paths=path1,path2`
