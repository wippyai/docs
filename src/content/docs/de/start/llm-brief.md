---
title: "LLM-Kurzinfo"
description: "Diese Seite ist fuer KI-Agenten und LLMs gedacht. Wenn du auf Wippy aufbaust oder Code fuer ein Wippy-Projekt generierst, lies dies zuerst."
---

# LLM-Kurzinfo

Diese Seite ist fuer KI-Agenten und LLMs gedacht. Wenn du auf Wippy aufbaust oder Code fuer ein Wippy-Projekt generierst, lies dies zuerst.

## Was Wippy ist

Wippy ist eine Single-Binary-Anwendungs-Runtime, die auf dem Aktor-Modell basiert. Sie fuehrt Lua-Code in isolierten Prozessen mit Nachrichtenuebermittlung aus — kein gemeinsamer Speicher, keine Locks. Es gibt drei Rechenmodelle: Funktionen (zustandslos, Request-gebunden), Prozesse (langlebige Aktoren mit Zustand) und Workflows (dauerhafte Aktoren, die von Temporal gestuetzt werden und Abstuerze ueberstehen). Das System ist so konzipiert, dass Agenten Code generieren, registrieren und Anwendungen ohne erneute Bereitstellung verbessern koennen.

## Mentales Modell

Alles in Wippy ist ein **Registry-Eintrag**. Eintraege haben eine ID (`namespace:name`), eine Art (die das Verhalten bestimmt), Metadaten und Daten. YAML-Dateien sind eine Moeglichkeit, Eintraege zu deklarieren, aber die Registry ist zur Laufzeit die Quelle der Wahrheit, und Eintraege koennen waehrend des Systembetriebs erstellt, aktualisiert oder geloescht werden.

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
- `process.host` — Prozessausfuehrungs-Host
- `process.service` — ueberwachter Prozess
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
    modules: [sql, json]

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      router: app:api_router
    method: GET
    path: /users/{id}
    func: app.api:get_user
```

## Funktionen schreiben

Funktionen sind zustandslos. Sie erhalten Argumente, fuehren Arbeit aus und geben Ergebnisse zurueck. Sie erben den Kontext des Aufrufers und werden abgebrochen, wenn der Aufrufer abbricht.

```lua
local sql = require("sql")
local json = require("json")
local http = require("http")

local function get_user(id)
    local db, err = sql.get("app:main_db")
    if err then return nil, err end

    local rows, err = db:query("SELECT * FROM users WHERE id = $1", id)
    if err then return nil, err end
    if #rows == 0 then return nil, errors.new(errors.NOT_FOUND, "user not found") end

    return rows[1]
end

return get_user
```

Verwende fuer HTTP-Handler das `http`-Modul:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    local id = req:param("id")
    local user, err = funcs.call("app.api:get_user", id)
    if err then
        res:set_status(404)
        res:write_json({error = err:message()})
        return
    end

    res:write_json(user)
end

return handler
```

## Prozesse schreiben

Prozesse sind Aktoren. Sie haben ihre eigene PID, empfangen Nachrichten ueber einen Posteingang und behalten ihren Zustand ueber Nachrichten hinweg. Sie yield'en bei blockierendem I/O, wodurch Tausende gleichzeitig laufen koennen.

```lua
local function worker(initial_config)
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local r = channel.select {
            inbox:case_receive(),
            events:case_receive()
        }

        if r.channel == events then
            local ev = r.value
            if ev.type == process.event.CANCEL then
                break
            end
        elseif r.channel == inbox then
            local msg = r.value
            local topic = msg:topic()
            local data = msg:payload():data()
            handle_message(topic, data)
        end
    end
end

return worker
```

Prozesse aus anderem Code spawnen:

```lua
local pid = process.spawn("app.workers:task", "app:process_host", config)
process.send(pid, "work", {item_id = 123})
```

## Workflows schreiben

Workflows sind dauerhaft — sie ueberstehen Abstuerze und Neustarts. Der Code sieht wie normales Lua aus. Die Runtime zeichnet automatisch Ergebnisse von Funktionsaufrufen, Sleeps und Zufallswerte auf, damit der Replay deterministisch ist.

```lua
local function order_flow(order)
    local inventory = funcs.call("app:reserve_inventory", order.items)
    if not inventory then
        return nil, errors.new("out of stock")
    end

    local payment = funcs.call("app:charge_payment", order.total)
    if not payment then
        funcs.call("app:release_inventory", inventory.id)
        return nil, errors.new("payment failed")
    end

    -- Wait for approval signal (can block for days)
    local msg = process.inbox():receive()
    if not msg:payload():data().approved then
        funcs.call("app:refund_payment", payment.id)
        funcs.call("app:release_inventory", inventory.id)
        return nil, errors.new("rejected")
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

-- Asynchronous (returns Future)
local future = funcs.async("namespace:function_name", arg1)
local result, err = future:result()

-- With context
local exec = funcs.new():with_context({user_id = "123"})
exec:call("namespace:function_name")
```

### Prozesskommunikation

```lua
-- Send message (fire-and-forget)
process.send(pid, "topic", data)

-- Receive messages
local inbox = process.inbox()
local msg, ok = inbox:receive()
local topic = msg:topic()
local data = msg:payload():data()

-- Monitor another process (receive EXIT on death)
process.monitor(pid)

-- Link processes (bidirectional failure notification)
process.spawn_linked("namespace:name", "host")
```

### Kanaele

Kanaele im Go-Stil fuer die Koroutinen-Kommunikation:

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

Funktionen geben `result, error`-Paare zurueck. Fehler sind typisierte Objekte:

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
local db = sql.get("app:main_db")
local rows, err = db:query("SELECT * FROM users WHERE active = $1", true)
db:execute("INSERT INTO users (name) VALUES ($1)", name)

-- Key-value store
local store = require("store")
local cache = store.get("app:cache")
cache:set("key", value, 3600)  -- TTL in seconds
local val = cache:get("key")

-- Queue
local queue = require("queue")
queue.publish("app:tasks", {task = "process", id = 123})

-- Filesystem
local fs = require("fs")
local vol = fs.get("app:storage")
local data = vol:readfile("path/to/file.txt")
vol:writefile("output.txt", content)
```

### HTTP-Client

```lua
local http_client = require("http_client")

local resp, err = http_client.get("https://api.example.com/data", {
    headers = {Authorization = "Bearer token"},
    timeout = "10s"
})
local body = resp.body
```

### Sicherheit

```lua
local security = require("security")

local actor = security.actor()       -- who is calling
local scope = security.scope()       -- what permissions apply
local allowed = security.can("read", "resource:users")

-- Token management
local ts = security.token_store("app:tokens")
local token = ts:create(actor, scope, {expiration = "24h"})
local validated_actor, validated_scope = ts:validate(token)
```

### Zeit

```lua
local time = require("time")

time.sleep("5s")
local now = time.now()
local timeout = time.after("30s")  -- channel that fires once
local ticker = time.ticker("10s")  -- repeating channel
```

### Registry

```lua
local registry = require("registry")

local entry = registry.get("app.api:get_user")
local tests = registry.find({["meta.type"] = "test"})

-- Create entries at runtime
local snap = registry.snapshot()
local changes = snap:changes()
changes:create({id = "app:new_func", kind = "function.lua", data = {...}})
changes:apply()
```

### Events

```lua
local events = require("events")

-- Publish
events.send("orders", "order.created", "/orders/123", {order_id = "123"})

-- Subscribe (wildcards supported)
local sub = events.subscribe("orders.*")
local ch = sub:channel()
local evt = ch:receive()
```

## Zugriffskontrolle auf Module

Jeder Eintrag deklariert, welche Module er `require()` darf. Nicht aufgefuehrte Module sind schlicht nicht verfuegbar — es gibt kein `os.execute`, `io.open`, `debug.*` oder `package.*`, sofern du sie nicht ausdruecklich gewaehrst. Die Runtime scannt oder validiert keinen Quellcode; sie steuert den Zugriff auf Modulebene. Wenn ein Modul nicht in der Liste steht, existiert es fuer diesen Eintrag nicht.

```yaml
modules: [sql, json, http, time, funcs, store]
```

So funktioniert auch der Determinismus von Workflows — Workflow-Eintraege erhalten nur deterministische Module. Die Runtime faengt `time.now()`, `uuid.v4()` und andere nicht-deterministische Aufrufe auf Modulebene ab und zeichnet die Ergebnisse fuer den Replay auf.

## Framework-Module

Wippy verfuegt ueber Framework-Module, die als Abhaengigkeiten installiert werden:

- **wippy/llm** — LLM-Integration (OpenAI, Anthropic, Google). `llm.generate()`, strukturierte Ausgabe, Embeddings, Streaming.
- **wippy/agent** — Agenten-Framework mit Tool-Nutzung, Delegation, Traits, Speicher. Agenten werden als Registry-Eintraege definiert.
- **wippy/test** — BDD-Tests. `describe/it`-Bloecke, Assertions, Mocking.
- **wippy/dataflow** — DAG-basierte Workflow-Orchestrierung. Function-, Agent-, Cycle-, Parallel-Nodes.
- **wippy/relay** — WebSocket-Relay mit zentralem Hub, Per-User-Hubs, Plugin-Routing.
- **wippy/views** — Seiten- und Komponentensystem mit Template-Rendering.
- **wippy/facade** — Frontend-Iframe-Fassade mit Authentifizierungs-Bridging.

## Konventionen

- Eintrags-IDs verwenden das Format `namespace:name`
- Namen verwenden Punkte zur semantischen Trennung, Unterstriche fuer Woerter: `get_user.endpoint`
- Funktionen geben `result, error` zurueck — pruefe den Fehler immer
- Prozesse kommunizieren ueber Nachrichtenuebermittlung, niemals ueber gemeinsamen Zustand
- Verwende `channel.select`, um mehrere Ereignisquellen zu multiplexen
- Supervisions-Baeume behandeln Fehler — design fuer "let it crash"
- Kontext (Trace-IDs, Benutzerinfo, Sicherheit) propagiert automatisch durch Funktionsaufrufe
- Workflows duerfen nicht-deterministische Operationen nicht direkt verwenden — die Runtime uebernimmt dies fuer `funcs.call`, `time.sleep`, `uuid.v4`, `time.now`

## Dokumentation

Die vollstaendige Dokumentation ist unter [wippy.ai/docs](https://wippy.ai/docs) verfuegbar. LLM-freundliche Endpunkte:

- Struktur durchsuchen: `https://wippy.ai/llm/toc`
- Suche: `https://wippy.ai/llm/search?q=query`
- Seite abrufen: `https://wippy.ai/llm/path/en/<path>`
- Batch-Abruf: `https://wippy.ai/llm/context?paths=path1,path2`
