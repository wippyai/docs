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
| `name` | Nein | Benutzerdefinierter Workflow-Name (Standard ist Entry-ID) |

## Grundlegende Implementierung

```lua
local funcs = require("funcs")
local time = require("time")

local function main(order)
    -- Activity aufrufen
    local payment, err = funcs.call("app:charge_payment", {
        amount = order.total,
        customer = order.customer_id
    })
    if err then
        return {status = "failed", error = tostring(err)}
    end

    -- Dauerhafter Sleep (überlebt Neustarts)
    time.sleep("1h")

    -- Weitere Activity
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
print(info.workflow_id)    -- Workflow-Ausführungs-ID
print(info.run_id)         -- Aktuelle Run-ID
print(info.workflow_type)  -- Workflow-Typname
print(info.task_queue)     -- Task-Queue-Name
print(info.namespace)      -- Temporal-Namespace
print(info.attempt)        -- Aktuelle Versuchsnummer
print(info.history_length) -- Anzahl der History-Events
print(info.history_size)   -- History-Größe in Bytes
```

### workflow.version()

Code-Änderungen mit deterministischer Versionierung behandeln:

```lua
local version = workflow.version("payment-v2", 1, 2)

if version == 1 then
    -- Altes Verhalten (für bestehende Ausführungen)
    result = funcs.call("app:old_payment", input)
else
    -- Neues Verhalten (Version 2)
    result = funcs.call("app:new_payment", input)
end
```

Parameter:
- `change_id` - Eindeutiger Bezeichner für diese Änderung
- `min_supported` - Minimal unterstützte Version
- `max_supported` - Maximale (aktuelle) Version

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
        notes = "Prioritätskunde",
        source = "web"
    }
})
```

### workflow.history_length()

Anzahl der Events in der Workflow-History abrufen:

```lua
local length = workflow.history_length()
if length > 10000 then
    -- Continue-as-new in Betracht ziehen
end
```

### workflow.history_size()

Workflow-History-Größe in Bytes abrufen:

```lua
local size = workflow.history_size()
```

### workflow.exec()

Kind-Workflow ausführen:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
```

## Signale

Daten an laufende Workflows über die Prozess-Inbox senden.

**Signale senden:**

```lua
process.send(workflow_pid, "approve", {
    approved_by = "admin",
    comment = "Sieht gut aus"
})
```

**Signale im Workflow empfangen:**

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg = inbox:receive()
        local topic = msg:topic()

        if topic == "approve" then
            local data = msg:payload():data()
            break
        elseif topic == "cancel" then
            local data = msg:payload():data()
            return {status = "cancelled", reason = data.reason}
        end
    end

    return process_order(order)
end
```

## Timer

Dauerhafte Timer überleben Neustarts:

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
```

## Determinismus

Workflow-Code muss deterministisch sein. Dieselben Eingaben müssen dieselbe Sequenz von Befehlen erzeugen.

### Erlaubt

```lua
-- Workflow-Info für aktuellen Zeitkontext verwenden
local info = workflow.info()

-- Dauerhaften Sleep verwenden
time.sleep("1h")

-- Activities für I/O verwenden
local data = funcs.call("app:fetch_data", id)

-- Versionierung für Code-Änderungen verwenden
local v = workflow.version("change-1", 1, 2)
```

### Nicht erlaubt

```lua
-- Keine Wanduhr-Zeit verwenden
local now = os.time()  -- Nicht-deterministisch

-- Kein direktes Random verwenden
local r = math.random()  -- Nicht-deterministisch

-- Kein I/O im Workflow-Code
local file = io.open("data.txt")  -- Nicht-deterministisch

-- Keinen globalen veränderlichen Zustand verwenden
counter = counter + 1  -- Nicht-deterministisch über Replays hinweg
```

## Fehlerbehandlung

```lua
local function main(order)
    local result, err = funcs.call("app:risky_activity", order)

    if err then
        -- Loggen und kompensieren
        funcs.call("app:send_alert", {
            error = tostring(err),
            order_id = order.id
        })

        return {status = "failed", error = tostring(err)}
    end

    return {status = "completed", result = result}
end
```

## Kompensationsmuster (Saga)

```lua
local function main(order)
    local compensations = {}

    -- Schritt 1: Inventar reservieren
    local reservation, err = funcs.call("app:reserve_inventory", order.items)
    if err then
        return {status = "failed", step = "inventory", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:release_inventory",
        args = reservation.id
    })

    -- Schritt 2: Zahlung belasten
    local payment, err = funcs.call("app:charge_payment", order.payment)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    -- Schritt 3: Bestellung versenden
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

## Workflows starten

Workflows aus beliebigem Code starten:

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- Workflow-Eintrag
    "app:worker",            -- Temporal-Worker
    {order_id = "123"}       -- Eingabe
)
```

Aus HTTP-Handlern:

```lua
local function handler()
    local req = http.request()
    local order = json.decode(req:body())

    local pid, err = process.spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    if err then
        return http.response():status(500):json({error = tostring(err)})
    end

    return http.response():json({
        workflow_id = tostring(pid),
        status = "started"
    })
end
```

## Siehe auch

- [Übersicht](temporal/overview.md) - Konfiguration
- [Activities](temporal/activities.md) - Activity-Definitionen
- [Prozess](lua/core/process.md) - Prozessverwaltung
- [Funktionen](lua/core/funcs.md) - Funktionsaufrufe
