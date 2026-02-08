# Workflows

Workflows sind dauerhafte Funktionen, die Activities orchestrieren und Zustand über Fehler und Neustarts hinweg beibehalten. Sie werden mit dem `workflow.lua`-Entry-Typ definiert.

## Definition

```yaml
- name: order_workflow
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - funcs
    - time
    - workflow
  meta:
    temporal:
      workflow:
        worker: app:worker
```

### Metadaten-Felder

| Feld | Erforderlich | Beschreibung |
|------|--------------|--------------|
| `worker` | Ja | Referenz auf `temporal.worker`-Eintrag |
| `name` | Nein | Benutzerdefinierter Workflow-Typname (Standard ist Entry-ID) |

## Grundlegende Implementierung

```lua
local funcs = require("funcs")
local time = require("time")

local function main(order)
    local payment, err = funcs.call("app:charge_payment", {
        amount = order.total,
        customer = order.customer_id
    })
    if err then
        return {status = "failed", error = tostring(err)}
    end

    time.sleep("1h")

    local shipment, err = funcs.call("app:ship_order", {
        order_id = order.id,
        address = order.shipping_address
    })
    if err then
        funcs.call("app:refund_payment", payment.id)
        return {status = "failed", error = tostring(err)}
    end

    return {
        status = "completed",
        payment_id = payment.id,
        tracking = shipment.tracking_number
    }
end

return { main = main }
```

## Workflow-Modul

Das `workflow`-Modul bietet workflow-spezifische Operationen.

### workflow.info()

Workflow-Ausführungsinformationen abrufen:

```lua
local workflow = require("workflow")

local info = workflow.info()
print(info.workflow_id)    -- workflow execution ID
print(info.run_id)         -- current run ID
print(info.workflow_type)  -- workflow type name
print(info.task_queue)     -- task queue name
print(info.namespace)      -- Temporal namespace
print(info.attempt)        -- current attempt number
print(info.history_length) -- number of history events
print(info.history_size)   -- history size in bytes
```

### workflow.exec()

Einen Kind-Workflow synchron ausführen und auf sein Ergebnis warten:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

Dies ist der einfachste Weg, Kind-Workflows auszuführen, wenn das Ergebnis inline benötigt wird.

### workflow.version()

Code-Änderungen mit deterministischer Versionierung behandeln:

```lua
local version = workflow.version("payment-v2", 1, 2)

if version == 1 then
    result = funcs.call("app:old_payment", input)
else
    result = funcs.call("app:new_payment", input)
end
```

Parameter:
- `change_id` - Eindeutiger Bezeichner für diese Änderung
- `min_supported` - Minimal unterstützte Version
- `max_supported` - Maximale (aktuelle) Version

Die Versionsnummer ist deterministisch pro Workflow-Ausführung. Bestehende laufende Workflows verwenden weiterhin ihre aufgezeichnete Version, während neue Workflows `max_supported` verwenden.

### workflow.attrs()

Such-Attribute und Memo aktualisieren:

```lua
workflow.attrs({
    search = {
        status = "processing",
        customer_id = order.customer_id,
        order_total = order.total
    },
    memo = {
        notes = "Priority customer",
        source = "web"
    }
})
```

Such-Attribute sind indiziert und über Temporal-Visibility-APIs abfragbar. Memo sind beliebige nicht-indizierte Daten, die dem Workflow angehängt werden.

### workflow.history_length() / workflow.history_size()

Wachstum der Workflow-History überwachen:

```lua
local length = workflow.history_length()
local size = workflow.history_size()

if length > 10000 then
    -- consider continue-as-new to reset history
end
```

## Workflows starten

### Einfacher Spawn

Einen Workflow aus beliebigem Code mit `process.spawn()` starten:

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- workflow entry
    "app:worker",            -- temporal worker
    {order_id = "123"}       -- input
)
```

Der Host-Parameter ist der Temporal-Worker (kein Prozess-Host). Der Workflow läuft dauerhaft auf der Temporal-Infrastruktur.

### Spawn mit Überwachung

Workflows überwachen, um EXIT-Events bei Abschluss zu erhalten:

```lua
local pid, err = process.spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = "123"}
)

local events = process.events()
local event = events:receive()

if event.kind == process.event.EXIT then
    local result = event.result.value
    local error = event.result.error
end
```

### Spawn mit Name

Einem Workflow einen Namen für idempotente Starts zuweisen:

```lua
local spawner = process
    .with_options({})
    :with_name("order-" .. order.id)

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = order.id}
)
```

Wenn ein Name angegeben wird, verwendet Temporal diesen zur Deduplizierung von Workflow-Starts. Ein Spawn mit demselben Namen während ein Workflow läuft gibt standardmäßig die PID des bestehenden Workflows zurück.

### Spawn mit expliziter Workflow-ID

Eine spezifische Temporal-Workflow-ID setzen:

```lua
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-" .. order.id,
    })

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
```

### ID-Konflikt-Richtlinien

Verhalten steuern, wenn ein Workflow mit einer bereits existierenden ID gestartet wird:

```lua
-- fail if workflow already exists
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
        ["temporal.workflow.id_conflict_policy"] = "fail",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then
    -- workflow already running with this ID
end
```

```lua
-- error when already started (alternative approach)
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
        ["temporal.workflow.execution_error_when_already_started"] = true,
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
```

```lua
-- reuse existing (default behavior with explicit ID)
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
-- returns existing workflow PID if already running
```

| Richtlinie | Verhalten |
|------------|-----------|
| `"use_existing"` | Bestehende Workflow-PID zurückgeben (Standard bei expliziter ID) |
| `"fail"` | Fehler zurückgeben wenn Workflow existiert |
| `"terminate_existing"` | Bestehenden terminieren und neuen starten |

### Workflow-Start-Optionen

Temporal-Workflow-Optionen über `with_options()` übergeben:

```lua
local spawner = process.with_options({
    ["temporal.workflow.id"] = "order-123",
    ["temporal.workflow.execution_timeout"] = "24h",
    ["temporal.workflow.run_timeout"] = "1h",
    ["temporal.workflow.task_timeout"] = "30s",
    ["temporal.workflow.id_conflict_policy"] = "fail",
    ["temporal.workflow.retry_policy"] = {
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 300000,
        maximum_attempts = 3,
    },
    ["temporal.workflow.cron_schedule"] = "0 */6 * * *",
    ["temporal.workflow.search_attributes"] = {
        customer_id = "cust-123"
    },
    ["temporal.workflow.memo"] = {
        source = "api"
    },
    ["temporal.workflow.start_delay"] = "5m",
    ["temporal.workflow.parent_close_policy"] = "terminate",
})
```

#### Vollständige Optionsreferenz

| Option | Typ | Beschreibung |
|--------|-----|--------------|
| `temporal.workflow.id` | string | Explizite Workflow-Ausführungs-ID |
| `temporal.workflow.task_queue` | string | Task-Queue überschreiben |
| `temporal.workflow.execution_timeout` | duration | Gesamtes Workflow-Ausführungstimeout |
| `temporal.workflow.run_timeout` | duration | Timeout für einzelnen Lauf |
| `temporal.workflow.task_timeout` | duration | Workflow-Task-Verarbeitungstimeout |
| `temporal.workflow.id_conflict_policy` | string | `use_existing`, `fail`, `terminate_existing` |
| `temporal.workflow.id_reuse_policy` | string | `allow_duplicate`, `allow_duplicate_failed_only`, `reject_duplicate` |
| `temporal.workflow.execution_error_when_already_started` | boolean | Fehler wenn Workflow bereits läuft |
| `temporal.workflow.retry_policy` | table | Retry-Richtlinie (siehe unten) |
| `temporal.workflow.cron_schedule` | string | Cron-Ausdruck für wiederkehrende Workflows |
| `temporal.workflow.memo` | table | Nicht-indizierte Workflow-Metadaten |
| `temporal.workflow.search_attributes` | table | Indizierte abfragbare Attribute |
| `temporal.workflow.enable_eager_start` | boolean | Ausführung sofort starten |
| `temporal.workflow.start_delay` | duration | Verzögerung vor Workflow-Start |
| `temporal.workflow.parent_close_policy` | string | Kind-Verhalten bei Eltern-Schließung |
| `temporal.workflow.wait_for_cancellation` | boolean | Auf Abschluss der Stornierung warten |
| `temporal.workflow.namespace` | string | Temporal-Namespace-Überschreibung |

Duration-Werte akzeptieren Strings (`"5s"`, `"10m"`, `"1h"`) oder Millisekunden als Zahlen.

#### Parent-Close-Richtlinie

Steuert, was mit Kind-Workflows passiert, wenn der Eltern-Workflow geschlossen wird:

| Richtlinie | Verhalten |
|------------|-----------|
| `"terminate"` | Kind-Workflow terminieren |
| `"abandon"` | Kind unabhängig weiterlaufen lassen |
| `"request_cancel"` | Stornierungsanfrage an Kind senden |

### Start-Nachrichten

Signale in eine Warteschlange einreihen, die unmittelbar nach dem Start an einen Workflow gesendet werden. Nachrichten werden vor allen externen Signalen zugestellt:

```lua
local spawner = process
    .with_options({})
    :with_name("counter-workflow")
    :with_message("increment", {amount = 2})
    :with_message("increment", {amount = 1})
    :with_message("increment", {amount = 4})

local pid, err = spawner:spawn_monitored(
    "app:counter_workflow",
    "app:worker",
    {initial = 0}
)
```

Start-Nachrichten sind besonders nützlich mit der `use_existing`-Konfliktrichtlinie. Wenn ein zweiter Spawn auf einen bestehenden Workflow aufgelöst wird, werden die Start-Nachrichten trotzdem zugestellt:

```lua
-- first spawn starts the workflow with initial messages
local first = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 3})

local pid, err = first:spawn("app:counter_workflow", "app:worker", {initial = 0})

-- second spawn reuses existing workflow and delivers new messages
local second = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 2})

local pid2, err = second:spawn("app:counter_workflow", "app:worker", {initial = 999})
-- pid2 == pid (same workflow), input {initial = 999} is ignored
-- but the increment message with amount=2 is delivered
```

### Kontextpropagierung

Kontextwerte übergeben, die innerhalb des Workflows und seiner Activities zugänglich sind:

```lua
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
    request_id = "req-abc",
})

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
```

Innerhalb des Workflows (oder jeder Activity, die er aufruft) kann der Kontext über das `ctx`-Modul gelesen werden:

```lua
local ctx = require("ctx")

local user_id = ctx.get("user_id")       -- "user-1"
local tenant = ctx.get("tenant")         -- "tenant-1"
local all = ctx.all()                    -- {user_id="user-1", tenant="tenant-1", request_id="req-abc"}
```

### Von HTTP-Handlern

```lua
local function handler()
    local req = http.request()
    local order = json.decode(req:body())

    local spawner = process
        .with_context({request_id = req:header("X-Request-ID")})
        :with_options({
            ["temporal.workflow.id"] = "order-" .. order.id,
            ["temporal.workflow.id_conflict_policy"] = "fail",
        })

    local pid, err = spawner:spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    if err then
        return http.response():status(409):json({error = tostring(err)})
    end

    return http.response():status(202):json({
        workflow_id = tostring(pid),
        status = "started"
    })
end
```

## Signale

Workflows empfangen Signale über das Prozess-Nachrichtensystem. Signale sind dauerhaft -- sie überleben Workflow-Replays.

### Inbox-Muster

Alle Nachrichten über die Prozess-Inbox empfangen:

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg = inbox:receive()
        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "approve" then
            break
        elseif topic == "cancel" then
            return {status = "cancelled", reason = data.reason}
        end
    end

    return process_order(order)
end
```

### Themenbasiertes Abonnement

Bestimmte Themen mit `process.listen()` abonnieren:

```lua
local function main(input)
    local results = {}
    local job_ch = process.listen("add_job")
    local exit_ch = process.listen("exit")

    while true do
        local result = channel.select{
            job_ch:case_receive(),
            exit_ch:case_receive()
        }

        if result.channel == exit_ch then
            break
        elseif result.channel == job_ch then
            local job_data = result.value
            local activity_result, err = funcs.call(
                "app:echo_activity",
                {job_id = job_data.id, data = job_data}
            )
            table.insert(results, {
                job_id = job_data.id,
                result = activity_result
            })
        end
    end

    return {total_jobs = #results, results = results}
end
```

Standardmäßig gibt `process.listen()` rohe Payload-Daten zurück. Verwenden Sie `{message = true}`, um Message-Objekte mit Absenderinformationen zu erhalten:

```lua
local ch = process.listen("request", {message = true})
local msg = ch:receive()
local sender = msg:from()
local data = msg:payload():data()
```

### Mehrere Signal-Handler

Verwenden Sie `coroutine.spawn()`, um verschiedene Signaltypen gleichzeitig zu verarbeiten:

```lua
local function main(input)
    local counter = input.initial or 0
    local done = false

    coroutine.spawn(function()
        local ch = process.listen("increment", {message = true})
        while not done do
            local msg, ok = ch:receive()
            if not ok then break end

            local data = msg:payload():data()
            local reply_to = msg:from()

            if type(data) ~= "table" or type(data.amount) ~= "number" then
                process.send(reply_to, "nak", "amount must be a number")
            else
                process.send(reply_to, "ack")
                counter = counter + data.amount
                process.send(reply_to, "ok", {value = counter})
            end
        end
    end)

    coroutine.spawn(function()
        local ch = process.listen("decrement", {message = true})
        while not done do
            local msg, ok = ch:receive()
            if not ok then break end

            local data = msg:payload():data()
            local reply_to = msg:from()

            if counter - data.amount < 0 then
                process.send(reply_to, "nak", "would result in negative value")
            else
                process.send(reply_to, "ack")
                counter = counter - data.amount
                process.send(reply_to, "ok", {value = counter})
            end
        end
    end)

    -- Main coroutine waits for finish signal
    local finish_ch = process.listen("finish", {message = true})
    local msg = finish_ch:receive()
    process.send(msg:from(), "ack")
    process.send(msg:from(), "ok", {message = "finishing"})
    done = true

    return {final_counter = counter}
end
```

### Signal-Bestätigung

Anfrage-Antwort-Muster implementieren, indem Antworten an den Absender zurückgesendet werden:

```lua
-- workflow side
local ch = process.listen("get_status", {message = true})
local msg = ch:receive()
process.send(msg:from(), "status_response", {status = "processing", progress = 75})
```

```lua
-- caller side
local response_ch = process.listen("status_response")
process.send(workflow_pid, "get_status", {})

local timeout = time.after("5s")
local result = channel.select{
    response_ch:case_receive(),
    timeout:case_receive()
}

if result.channel == response_ch then
    local status = result.value
end
```

### Workflow-übergreifende Signale

Workflows können Signale über ihre PID an andere Workflows senden:

```lua
-- sender workflow
local function main(input)
    local target_pid = input.target
    local ok, err = process.send(target_pid, "cross_host_ping", {data = "hello"})
    if err then
        return {ok = false, error = tostring(err)}
    end

    local response_ch = process.listen("cross_host_pong")
    local response = response_ch:receive()
    return {ok = true, received = response}
end
```

## Kind-Workflows

### Synchroner Kind-Workflow (workflow.exec)

Einen Kind-Workflow ausführen und auf das Ergebnis warten:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

### Asynchroner Kind-Workflow (process.spawn)

Einen Kind-Workflow ohne Blockierung starten und dann über Events auf seinen Abschluss warten:

```lua
local events_ch = process.events()

local child_pid, err = process.spawn(
    "app:child_workflow",
    "app:worker",
    {message = "hello from parent"}
)
if err then
    return {status = "spawn_failed", error = tostring(err)}
end

-- wait for child EXIT event
local event = events_ch:receive()

if event.kind == process.event.EXIT then
    local child_result = event.result.value
    local child_error = event.result.error
end
```

### Fehlerweitergabe von Kind-Workflows

Wenn ein Kind-Workflow einen Fehler zurückgibt, erscheint dieser im EXIT-Event:

```lua
local events_ch = process.events()
local child_pid, err = process.spawn(
    "app:error_child_workflow",
    "app:worker"
)

local event = events_ch:receive()
if event.result.error then
    local child_err = event.result.error
    -- error objects have kind(), retryable(), message() methods
    print(child_err:kind())       -- e.g. "NOT_FOUND"
    print(child_err:retryable())  -- false
    print(child_err:message())    -- error message text
end
```

### Workflows synchron ausführen (process.exec)

Einen Workflow ausführen und in einem Aufruf auf sein Ergebnis warten:

```lua
local result, err = process.exec(
    "app:hello_workflow",
    "app:worker",
    {name = "world"}
)
if err then
    return nil, err
end
-- result contains workflow return value
```

## Überwachung und Verknüpfung

### Nachträgliche Überwachung

Einen Workflow überwachen, nachdem er bereits gestartet wurde:

```lua
local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)

-- monitor later
local ok, err = process.monitor(pid)

local events_ch = process.events()
local event = events_ch:receive()  -- EXIT when workflow completes
```

### Nachträgliche Verknüpfung

Mit einem laufenden Workflow verknüpfen, um bei abnormaler Beendigung LINK_DOWN zu erhalten:

```lua
local ok, err = process.set_options({trap_links = true})

local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)

-- link after workflow has started
time.sleep("200ms")
local ok, err = process.link(pid)

-- if workflow is terminated, receive LINK_DOWN
process.terminate(pid)

local events_ch = process.events()
local event = events_ch:receive()
-- event.kind == process.event.LINK_DOWN
```

LINK_DOWN-Events erfordern `trap_links = true` in den Prozess-Optionen. Ohne diese Einstellung wird bei Terminierung eines verknüpften Prozesses der Fehler weitergegeben.

### Überwachung/Verknüpfung aufheben

Überwachung oder Verknüpfung entfernen:

```lua
process.unmonitor(pid)  -- stop receiving EXIT events
process.unlink(pid)     -- remove bidirectional link
```

Nach dem Aufheben der Überwachung oder Verknüpfung werden Events für diesen Prozess nicht mehr zugestellt.

## Terminierung und Stornierung

### Terminieren

Einen laufenden Workflow erzwungen beenden:

```lua
local ok, err = process.terminate(workflow_pid)
```

Überwachende Aufrufer erhalten ein EXIT-Event mit einem Fehler.

### Stornieren

Eine ordnungsgemäße Stornierung mit optionaler Frist anfordern:

```lua
local ok, err = process.cancel(workflow_pid, "5s")
```

## Nebenläufige Arbeit

Verwenden Sie `coroutine.spawn()` und Channels für parallele Arbeit innerhalb von Workflows:

```lua
local function main(input)
    local worker_count = input.workers or 3
    local job_count = input.jobs or 6

    local work_queue = channel.new(10)
    local results = channel.new(10)

    for w = 1, worker_count do
        coroutine.spawn(function()
            while true do
                local job, ok = work_queue:receive()
                if not ok then break end
                time.sleep(10 * time.MILLISECOND)
                results:send({worker = w, job = job, result = job * 2})
            end
        end)
    end

    for j = 1, job_count do
        work_queue:send(j)
    end
    work_queue:close()

    local total = 0
    local processed = {}
    for _ = 1, job_count do
        local r = results:receive()
        total = total + r.result
        table.insert(processed, r)
    end

    return {total = total, processed = processed}
end
```

Alle Channel-Operationen und Sleeps innerhalb von Coroutinen sind replay-sicher.

## Timer

Dauerhafte Timer überleben Neustarts:

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
time.sleep(100 * time.MILLISECOND)
```

Verstrichene Zeit messen:

```lua
local start = time.now()
time.sleep("1s")
local elapsed = time.now():sub(start):milliseconds()
```

## Determinismus

Workflow-Code muss deterministisch sein. Dieselben Eingaben müssen dieselbe Sequenz von Befehlen erzeugen.

### Replay-sichere Operationen

Diese Operationen werden automatisch abgefangen und ihre Ergebnisse aufgezeichnet. Bei einem Replay werden die aufgezeichneten Werte zurückgegeben:

```lua
-- Activity calls
local data = funcs.call("app:fetch_data", id)

-- Durable sleep
time.sleep("1h")

-- Current time
local now = time.now()

-- UUID generation
local id = uuid.v4()

-- Crypto operations
local bytes = crypto.random_bytes(32)

-- Child workflows
local result = workflow.exec("app:child", input)

-- Versioning
local v = workflow.version("change-1", 1, 2)
```

### Nicht-deterministisch (vermeiden)

```lua
-- Don't use wall clock time
local now = os.time()              -- non-deterministic

-- Don't use random directly
local r = math.random()            -- non-deterministic

-- Don't do I/O in workflow code
local file = io.open("data.txt")   -- non-deterministic

-- Don't use global mutable state
counter = counter + 1               -- non-deterministic across replays
```

## Fehlerbehandlung

### Activity-Fehler

Activity-Fehler enthalten strukturierte Metadaten:

```lua
local result, err = funcs.call("app:risky_activity", order)
if err then
    print(err:kind())       -- error classification (e.g. "NOT_FOUND", "INTERNAL")
    print(err:retryable())  -- whether the error is retryable
    print(err:message())    -- human-readable error message
end
```

### Activity-Fehlermodi

Retry-Verhalten für Activity-Aufrufe konfigurieren:

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {
        maximum_attempts = 1,
    }
})

local result, err = executor:call("app:unreliable_activity", input)
if err then
    local kind = err:kind()         -- "INTERNAL" for runtime errors
    local retryable = err:retryable()
end
```

### Kind-Workflow-Fehler

Fehler von Kind-Workflows (über `process.exec` oder EXIT-Events) enthalten dieselben Metadaten:

```lua
local result, err = process.exec("app:error_workflow", "app:worker")
if err then
    print(err:kind())       -- e.g. "NOT_FOUND"
    print(err:retryable())  -- false
    print(err:message())    -- error details
end
```

## Kompensationsmuster (Saga)

```lua
local function main(order)
    local compensations = {}

    local reservation, err = funcs.call("app:reserve_inventory", order.items)
    if err then
        return {status = "failed", step = "inventory", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:release_inventory",
        args = reservation.id
    })

    local payment, err = funcs.call("app:charge_payment", order.payment)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    local shipment, err = funcs.call("app:ship_order", order.shipping)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "shipping", error = tostring(err)}
    end

    return {status = "completed", tracking = shipment.tracking}
end

local function run_compensations(compensations)
    for _, comp in ipairs(compensations) do
        funcs.call(comp.action, comp.args)
    end
end
```

## Siehe auch

- [Übersicht](temporal/overview.md) - Client- und Worker-Konfiguration
- [Activities](temporal/activities.md) - Activity-Definitionen und Optionen
- [Prozess](lua/core/process.md) - Prozessverwaltungs-API
- [Funktionen](lua/core/funcs.md) - Funktionsaufruf
- [Channels](lua/core/channel.md) - Channel-Operationen
