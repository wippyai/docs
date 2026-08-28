---
title: "Workflows"
description: "Definieren Sie dauerhafte Temporal-Workflows mit workflow.lua-Einträgen, Activities, Signalen, Kind-Workflows, Timern und replay-sicheren Operationen."
---

# Workflows

Ein `workflow.lua`-Eintrag definiert einen dauerhaften Temporal-Workflow, der Activities orchestriert und Zustand über Fehler und Neustarts hinweg beibehält.

Diese Seite ist eine API-Referenz mit Teilrezepten. Entry-Deklarationen, Worker-Registrierung, Activity-Implementierungen, Sicherheitsrichtlinien und umgebende Anwendungsdaten werden nur dort gezeigt, wo sie für einen bestimmten Vertrag relevant sind.

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
        local _, refund_err = funcs.call("app:refund_payment", payment.id)
        if refund_err then
            return {
                status = "failed",
                error = tostring(err),
                compensation_error = tostring(refund_err)
            }
        end
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

local info, info_err = workflow.info()
if info_err then return nil, info_err end
print(info.workflow_id)    -- Workflow execution ID
print(info.run_id)         -- Current run ID
print(info.workflow_type)  -- Workflow type name
print(info.task_queue)     -- Task queue name
print(info.namespace)      -- Temporal namespace
print(info.attempt)        -- Current attempt number
print(info.history_length) -- Number of history events
print(info.history_size)   -- History size in bytes
```

### workflow.exec()

Einen Kind-Workflow synchron ausführen und auf sein Ergebnis warten:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

Verwenden Sie diese Form, wenn der Eltern-Workflow inline auf das Ergebnis des Kind-Workflows warten muss.

### workflow.version()

Code-Änderungen mit deterministischer Versionierung behandeln:

```lua
local version, err = workflow.version("payment-v2", 1, 2)
if err then
    return nil, err
end

if version == 1 then
    return funcs.call("app:old_payment", input)
else
    return funcs.call("app:new_payment", input)
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
local updated, err = workflow.attrs({
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
if err then
    return nil, err
end
```

Such-Attribute sind indiziert und über Temporal-Visibility-APIs abfragbar. Memo sind beliebige nicht-indizierte Daten, die dem Workflow angehängt werden.

### workflow.history_length() / workflow.history_size()

Wachstum der Workflow-History überwachen:

```lua
local length, length_err = workflow.history_length()
if length_err then return nil, length_err end
local size, size_err = workflow.history_size()
if size_err then return nil, size_err end

if length > 10000 then
    -- Consider continue-as-new to reset history
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
if err then
    return nil, err
end
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
if err then
    return nil, err
end

local events = process.events()
local event, open = events:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end

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
if err then
    return nil, err
end
```

Wenn ein Name angegeben wird, verwendet Temporal diesen zur Deduplizierung von Workflow-Starts. Ein Spawn mit demselben Namen während ein Workflow läuft gibt standardmäßig die PID des bestehenden Workflows zurück.

### Spawn mit expliziter Workflow-ID

Eine spezifische Temporal-Workflow-ID setzen:

```lua
local spawner = process
    .with_options({
        ["workflow.id"] = "order-" .. order.id,
    })

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
if err then
    return nil, err
end
```

### ID-Konflikt-Richtlinien

Verhalten steuern, wenn ein Workflow mit einer bereits existierenden ID gestartet wird:

```lua
-- Fail if workflow already exists
local spawner = process
    .with_options({
        ["workflow.id"] = "order-123",
        ["workflow.id_conflict_policy"] = "fail",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then
    -- Workflow already running with this ID
end
```

```lua
-- Error when already started (alternative approach)
local spawner = process
    .with_options({
        ["workflow.id"] = "order-123",
        ["workflow.execution_error_when_already_started"] = true,
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then return nil, err end
```

```lua
-- Reuse existing (default behavior with explicit ID)
local spawner = process
    .with_options({
        ["workflow.id"] = "order-123",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then return nil, err end
-- Returns existing workflow PID if already running
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
    ["workflow.id"] = "order-123",
    ["workflow.execution_timeout"] = "24h",
    ["workflow.run_timeout"] = "1h",
    ["workflow.task_timeout"] = "30s",
    ["workflow.id_conflict_policy"] = "fail",
    ["workflow.retry_policy"] = {
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 300000,
        maximum_attempts = 3,
    },
    ["workflow.cron_schedule"] = "0 */6 * * *",
    ["workflow.search_attributes"] = {
        customer_id = "cust-123"
    },
    ["workflow.memo"] = {
        source = "api"
    },
    ["workflow.start_delay"] = "5m",
    ["workflow.parent_close_policy"] = "terminate",
})
```

#### Optionsreferenz

| Option | Typ | Beschreibung |
|--------|-----|--------------|
| `workflow.id` | string | Explizite Workflow-Ausführungs-ID |
| `workflow.task_queue` | string | Task-Queue überschreiben |
| `workflow.execution_timeout` | duration | Gesamtes Workflow-Ausführungstimeout |
| `workflow.run_timeout` | duration | Timeout für einen einzelnen Lauf |
| `workflow.task_timeout` | duration | Timeout für die Workflow-Task-Verarbeitung |
| `workflow.id_conflict_policy` | string | `use_existing`, `fail`, `terminate_existing` |
| `workflow.id_reuse_policy` | string | `allow_duplicate`, `allow_duplicate_failed_only`, `reject_duplicate` |
| `workflow.execution_error_when_already_started` | boolean | Fehler, wenn der Workflow bereits läuft |
| `workflow.retry_policy` | table | Retry-Richtlinie (siehe unten) |
| `workflow.cron_schedule` | string | Cron-Ausdruck für wiederkehrende Workflows |
| `workflow.memo` | table | Nicht indizierte Workflow-Metadaten |
| `workflow.search_attributes` | table | Indizierte, abfragbare Attribute |
| `workflow.enable_eager_start` | boolean | Ausführung sofort starten |
| `workflow.start_delay` | duration | Verzögerung vor dem Workflow-Start |
| `workflow.summary` | string | In den Temporal-Workflow-Metadaten angezeigte Zusammenfassung |
| `workflow.details` | string | In den Temporal-Workflow-Metadaten angezeigte Details |
| `workflow.versioning_override` | string oder table | Automatisches Upgrade oder festgelegte Deployment-/Build-Version |
| `workflow.priority` | table | Prioritätsschlüssel und optionale Fairness-Einstellungen |
| `workflow.parent_close_policy` | string | Verhalten des Kind-Workflows beim Schließen des Eltern-Workflows |
| `workflow.wait_for_cancellation` | boolean | Auf Abschluss der Stornierung warten |
| `workflow.namespace` | string | Temporal-Namespace überschreiben |
| `workflow.versioning_intent` | string oder number | Worker-Versionierungsabsicht für den Kind-Workflow |
| `workflow.name` | string | Typ des Kind-Workflows überschreiben |

Duration-Werte akzeptieren Strings (`"5s"`, `"10m"`, `"1h"`) oder Millisekunden als Zahlen.

Die veralteten Aliasse `temporal.workflow.*` werden aus Kompatibilitätsgründen weiterhin akzeptiert. Neuer Code sollte die oben gezeigten kanonischen Namen `workflow.*` verwenden.

Eine festgelegte Versionsüberschreibung erfordert sowohl den Modus als auch die Deployment-Version:

```lua
["workflow.versioning_override"] = {
    mode = "pinned",
    version = {
        deployment_name = "orders",
        build_id = "orders-v2",
    },
}
```

Verwenden Sie den String `"auto_upgrade"` für eine Überschreibung mit automatischem Upgrade.

#### Parent-Close-Richtlinie

Steuert, was mit Kind-Workflows passiert, wenn der Eltern-Workflow geschlossen wird:

| Richtlinie | Verhalten |
|------------|-----------|
| `"terminate"` | Kind-Workflow terminieren |
| `"abandon"` | Kind unabhängig weiterlaufen lassen |
| `"request_cancel"` | Stornierungsanfrage an Kind senden |

### Start-Nachrichten

Reihen Sie Signale zusammen mit einem Workflow-Start ein. Die erste nicht leere Startnachricht wird atomar mit dem Start gesendet. Weitere Startnachrichten werden nach dem Start sequenziell in Builder-Reihenfolge gesendet, können sich aber mit Signalen überschneiden, die andere Aufrufer gleichzeitig senden:

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
if err then return nil, err end
```

Mit der `use_existing`-Konfliktrichtlinie werden Startnachrichten auch dann zugestellt, wenn ein zweiter Spawn auf einen bestehenden Workflow aufgelöst wird:

```lua
-- First spawn starts the workflow with initial messages
local first = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 3})

local pid, first_err = first:spawn("app:counter_workflow", "app:worker", {initial = 0})
if first_err then return nil, first_err end

-- Second spawn reuses existing workflow and delivers new messages
local second = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 2})

local pid2, second_err = second:spawn("app:counter_workflow", "app:worker", {initial = 999})
if second_err then return nil, second_err end
-- pid2 == pid (same workflow), input {initial = 999} is ignored
-- But the increment message with amount=2 is delivered
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
if err then return nil, err end
```

Innerhalb des Workflows (oder jeder Activity, die er aufruft) kann der Kontext über das `ctx`-Modul gelesen werden:

```lua
local ctx = require("ctx")

local user_id, user_err = ctx.get("user_id")       -- "user-1"
if user_err then return nil, user_err end
local tenant, tenant_err = ctx.get("tenant")       -- "tenant-1"
if tenant_err then return nil, tenant_err end
local all, err = ctx.all()               -- {user_id="user-1", tenant="tenant-1", request_id="req-abc"}
if err then
    return nil, err
end
```

### Von HTTP-Handlern

```lua
local function handler()
    local req, req_err = http.request()
    if req_err then
        return nil, req_err
    end

    local body, body_err = req:body()
    if body_err then
        return nil, body_err
    end
    local order, decode_err = json.decode(body)
    if decode_err then
        return nil, decode_err
    end

    local request_id, header_err = req:header("X-Request-ID")
    if header_err then
        return nil, header_err
    end

    local spawner = process
        .with_context({request_id = request_id})
        :with_options({
            ["workflow.id"] = "order-" .. order.id,
            ["workflow.id_conflict_policy"] = "fail",
        })

    local pid, err = spawner:spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    local res, res_err = http.response()
    if res_err then
        return nil, res_err
    end
    if err then
        local status_err = res:set_status(409)
        if status_err then
            return nil, status_err
        end
        local write_err = res:write_json({error = tostring(err)})
        if write_err then return nil, write_err end
        return true
    end

    local status_err = res:set_status(202)
    if status_err then
        return nil, status_err
    end
    local write_err = res:write_json({
        workflow_id = tostring(pid),
        status = "started"
    })
    if write_err then return nil, write_err end
    return true
end
```

## Signale

Workflows empfangen Signale über das Prozess-Nachrichtensystem. Signale sind dauerhaft — sie überleben Workflow-Replays.

### Inbox-Muster

Alle Nachrichten über die Prozess-Inbox empfangen:

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg, open = inbox:receive()
        if not open then
            return nil, errors.new({kind = errors.INTERNAL, message = "workflow inbox closed"})
        end
        local topic = msg:topic()

        if topic == "approve" then
            break
        elseif topic == "cancel" then
            local payload = msg:payload()
            local data
            if payload then
                local payload_err
                data, payload_err = payload:data()
                if payload_err then return nil, payload_err end
            end
            local reason = type(data) == "table" and data.reason or nil
            return {status = "cancelled", reason = reason}
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
    local job_ch, job_err = process.listen("add_job")
    if job_err then return nil, job_err end
    local exit_ch, exit_err = process.listen("exit")
    if exit_err then return nil, exit_err end

    while true do
        local result = channel.select{
            job_ch:case_receive(),
            exit_ch:case_receive()
        }

        if result.channel == exit_ch then
            break
        elseif result.channel == job_ch then
            if not result.ok then
                break
            end
            local job_data = result.value
            local activity_result, err = funcs.call(
                "app:echo_activity",
                {job_id = job_data.id, data = job_data}
            )
            if err then
                return nil, err
            end
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
local ch, err = process.listen("request", {message = true})
if err then return nil, err end
local msg, open = ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "request channel closed"})
end
local sender = msg:from()
local payload = msg:payload()
local data
if payload then
    local payload_err
    data, payload_err = payload:data()
    if payload_err then return nil, payload_err end
end
```

### Serialisierte Signalverarbeitung

Verwenden Sie eine einzelne `channel.select()`-Schleife, wenn Signale gemeinsamen Workflow-Zustand verändern. Dadurch bleibt die deterministische Reihenfolge der Änderungen erhalten und der `finish`-Zweig kann zurückkehren, ohne blockierte Handler-Coroutinen zu hinterlassen:

```lua
local function main(input)
    local counter = input.initial or 0

    local function send_reply(pid, topic, payload)
        local sent, err = process.send(pid, topic, payload)
        if err then error(err) end
        return sent
    end

    local function message_data(msg)
        local payload = msg:payload()
        if not payload then return nil end
        return payload:data()
    end

    local increment_ch, increment_err = process.listen("increment", {message = true})
    if increment_err then return nil, increment_err end
    local decrement_ch, decrement_err = process.listen("decrement", {message = true})
    if decrement_err then return nil, decrement_err end
    local finish_ch, finish_err = process.listen("finish", {message = true})
    if finish_err then return nil, finish_err end

    while true do
        local result = channel.select{
            increment_ch:case_receive(),
            decrement_ch:case_receive(),
            finish_ch:case_receive()
        }
        if not result.ok then
            return nil, errors.new({kind = errors.INTERNAL, message = "signal channel closed"})
        end

        local msg = result.value
        local reply_to = msg:from()

        if result.channel == finish_ch then
            send_reply(reply_to, "ack")
            send_reply(reply_to, "ok", {message = "finishing", value = counter})
            return {final_counter = counter}
        end

        local data, payload_err = message_data(msg)
        if payload_err then return nil, payload_err end

        if type(data) ~= "table" or type(data.amount) ~= "number" then
            send_reply(reply_to, "nak", "amount must be a number")
        elseif result.channel == decrement_ch and counter - data.amount < 0 then
            send_reply(reply_to, "nak", "would result in negative value")
        else
            send_reply(reply_to, "ack")
            if result.channel == increment_ch then
                counter = counter + data.amount
            else
                counter = counter - data.amount
            end
            send_reply(reply_to, "ok", {value = counter})
        end
    end
end
```

### Signal-Bestätigung

Anfrage-Antwort-Muster implementieren, indem Antworten an den Absender zurückgesendet werden:

```lua
-- Workflow side
local ch, err = process.listen("get_status", {message = true})
if err then return nil, err end
local msg, open = ch:receive()
if not open then return nil, errors.new({kind = errors.INTERNAL, message = "status channel closed"}) end
local sent, send_err = process.send(msg:from(), "status_response", {status = "processing", progress = 75})
if send_err then return nil, send_err end
```

```lua
-- Caller side
local response_ch, listen_err = process.listen("status_response")
if listen_err then return nil, listen_err end
local sent, send_err = process.send(workflow_pid, "get_status", {})
if send_err then return nil, send_err end

local timeout, timeout_err = time.after("5s")
if timeout_err then return nil, timeout_err end
local result = channel.select{
    response_ch:case_receive(),
    timeout:case_receive()
}

if result.channel == response_ch then
    if not result.ok then
        return nil, errors.new({kind = errors.INTERNAL, message = "status response channel closed"})
    end
    return result.value
end

if not result.ok then
    return nil, errors.new({kind = errors.INTERNAL, message = "status timeout channel closed"})
end
return nil, errors.new({kind = errors.TIMEOUT, message = "status request timed out", retryable = true})
```

### Workflow-übergreifende Signale

Workflows können Signale über ihre PID an andere Workflows senden:

```lua
-- Sender workflow
local function main(input)
    local target_pid = input.target
    local response_ch, listen_err = process.listen("cross_host_pong")
    if listen_err then return nil, listen_err end

    local ok, err = process.send(target_pid, "cross_host_ping", {data = "hello"})
    if err then
        return {ok = false, error = tostring(err)}
    end

    local response, open = response_ch:receive()
    if not open then
        return {ok = false, error = "cross_host_pong channel closed"}
    end
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

-- Wait for child EXIT event
local event, open = events_ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end

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
if err then
    return nil, err
end

local event, open = events_ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end
if event.result.error then
    local child_err = event.result.error
    -- Error objects have kind(), retryable(), message() methods
    print(child_err:kind())       -- e.g. "NotFound"
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
-- result contains the workflow return value
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
if err then
    return nil, err
end

-- Monitor later
local ok, monitor_err = process.monitor(pid)
if monitor_err then
    return nil, monitor_err
end

local events_ch = process.events()
local event, open = events_ch:receive()  -- EXIT when workflow completes
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end
```

### Nachträgliche Verknüpfung

Mit einem laufenden Workflow verknüpfen, um bei abnormaler Beendigung LINK_DOWN zu erhalten:

```lua
local ok, err = process.set_options({trap_links = true})
if err then
    return nil, err
end

local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)
if err then
    return nil, err
end

-- Link after workflow has started
time.sleep("200ms")
local linked, link_err = process.link(pid)
if link_err then return nil, link_err end

-- If workflow is terminated, receive LINK_DOWN
local terminated, terminate_err = process.terminate(pid)
if terminate_err then return nil, terminate_err end

local events_ch = process.events()
local event, open = events_ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end
-- event.kind == process.event.LINK_DOWN
```

LINK_DOWN-Events erfordern `trap_links = true` in den Prozess-Optionen. Ohne diese Einstellung wird bei Terminierung eines verknüpften Prozesses der Fehler weitergegeben.

### Überwachung/Verknüpfung aufheben

Überwachung oder Verknüpfung entfernen:

```lua
local unmonitored, unmonitor_err = process.unmonitor(pid)
if unmonitor_err then return nil, unmonitor_err end
local unlinked, unlink_err = process.unlink(pid)
if unlink_err then return nil, unlink_err end
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

Eine ordnungsgemäße Stornierung mit optionalem Grund anfordern:

```lua
local ok, err = process.cancel(workflow_pid, "cancelled by operator")
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
        local r, open = results:receive()
        if not open then
            return nil, errors.new({kind = errors.INTERNAL, message = "results channel closed"})
        end
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
local bytes = crypto.random.bytes(32)

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
    print(err:kind())       -- error classification (e.g. "NotFound", "Internal")
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
    local kind = err:kind()         -- "Internal" for runtime errors
    local retryable = err:retryable()
end
```

### Kind-Workflow-Fehler

Fehler von Kind-Workflows (über `process.exec` oder EXIT-Events) enthalten dieselben Metadaten:

```lua
local result, err = process.exec("app:error_workflow", "app:worker")
if err then
    print(err:kind())       -- e.g. "NotFound"
    print(err:retryable())  -- false
    print(err:message())    -- error details
end
```

## Kompensationsmuster (Saga)

```lua
local function run_compensations(compensations)
    local first_err
    for _, comp in ipairs(compensations) do
        local _, err = funcs.call(comp.action, comp.args)
        if err and not first_err then
            first_err = err
        end
    end
    if first_err then return nil, first_err end
    return true
end

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
        local _, compensation_err = run_compensations(compensations)
        if compensation_err then
            return {status = "failed", step = "payment", error = tostring(err), compensation_error = tostring(compensation_err)}
        end
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    local shipment, err = funcs.call("app:ship_order", order.shipping)
    if err then
        local _, compensation_err = run_compensations(compensations)
        if compensation_err then
            return {status = "failed", step = "shipping", error = tostring(err), compensation_error = tostring(compensation_err)}
        end
        return {status = "failed", step = "shipping", error = tostring(err)}
    end

    return {status = "completed", tracking = shipment.tracking}
end
```

Kompensationen werden in umgekehrter Registrierungsreihenfolge ausgeführt. Wenn mehrere Kompensationen fehlschlagen, versucht der Workflow trotzdem die verbleibenden Aktionen und meldet den ersten Fehler über `compensation_error`.

## Siehe auch

- [Übersicht](temporal/overview.md) - Client- und Worker-Konfiguration
- [Activities](temporal/activities.md) - Activity-Definitionen und Optionen
- [Prozess](lua/core/process.md) - Prozessverwaltungs-API
- [Funktionen](lua/core/funcs.md) - Funktionsaufruf
- [Channels](lua/core/channel.md) - Channel-Operationen
