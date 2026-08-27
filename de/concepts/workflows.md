---
title: "Workflows"
description: "Wie Wippy lang laufende Workflows persistiert, Ausführungen erneut abspielt, Signale empfängt und sich von Fehlern erholt."
---

# Workflows

Workflows speichern den Zustand lang laufender Operationen dauerhaft, damit die Ausführung nach Abstürzen und Neustarts wiederhergestellt werden kann. Sie eignen sich für Vorgänge wie Zahlungen, Auftragserfüllung und mehrstufige Genehmigungen.

## Warum Workflows verwenden?

Funktionen halten laufenden Zustand im Arbeitsspeicher, Workflows speichern Ausführungszustand dauerhaft:

| Aspekt | Funktionen | Workflows |
|--------|-----------|-----------|
| Zustand | Aufruflokal | Aus persistierter Historie rekonstruiert |
| Worker-Absturz | Laufender Aufruf schlägt fehl | Replay aus aufgezeichneter Historie |
| Dauer | Sekunden bis Minuten | Stunden bis Monate |
| Anwendungsfehler | Wird an Aufrufer zurückgegeben | Beendet oder wiederholt gemäß Provider-Richtlinie |

## Funktionsweise von Workflows

Workflow-Code sieht wie gewöhnlicher Lua-Code aus:

```lua
local funcs = require("funcs")
local time = require("time")

local result, err = funcs.call("app.api:charge_card", payment)
if err then return nil, err end

time.sleep("24h")

local status, err = funcs.call("app.api:check_status", result.id)
if err then return nil, err end

if status == "failed" then
    local _, refund_err = funcs.call("app.api:refund", result.id)
    if refund_err then return nil, refund_err end
end

return status
```

Die Workflow-Engine fängt Aufrufe ab und zeichnet ihre Ergebnisse auf. Nach einem Absturz spielt sie die Ausführung aus der aufgezeichneten Historie erneut ab.

Innerhalb eines Workflows läuft jedes Ziel von `funcs.call()` als Temporal-Activity. Ein
`function.*`-Zieleintrag muss sich über `meta.temporal.activity.worker` bei einem Worker
registrieren; nicht registrierte Einträge stehen dem Workflow nicht zur Verfügung. Ein
`process.*`-Activity-Ziel benötigt zusätzlich `meta.options.default_host` oder das ältere
`meta.default_host`, damit es in der vom Temporal-Worker verwendeten Funktionsregistry
registriert wird. Das Funktionsbeispiel und Activity-Optionen finden Sie unter
[Activities](../temporal/activities.md).

<note>
Workflow-Autoren müssen weiterhin deterministischen Code schreiben. Wippy beschränkt Workflow-Module auf als Deterministic oder Workflow klassifizierte Module und stellt Replay-sichere Implementierungen unterstützter Operationen bereit. <code>funcs.call()</code> führt eine aufgezeichnete Activity aus, <code>time.sleep()</code> verwendet einen Workflow-Timer, <code>uuid.v4()</code> zeichnet einen Seiteneffekt auf und <code>time.now()</code> liest die deterministische Zeitreferenz des Workflows.
</note>

## Workflow-Muster

### Saga-Muster

Kompensieren Sie bei einem Fehler:

```lua
local funcs = require("funcs")

local inventory, err = funcs.call("app.inventory:reserve", items)
if err then return nil, err end

local payment, err = funcs.call("app.payments:charge", amount)
if err then
    local _, compensation_err = funcs.call("app.inventory:release", inventory.id)
    return nil, compensation_err or err
end

local shipping, err = funcs.call("app.shipping:create", order)
if err then
    local _, refund_err = funcs.call("app.payments:refund", payment.id)
    local _, release_err = funcs.call("app.inventory:release", inventory.id)
    return nil, refund_err or release_err or err
end

return {inventory = inventory, payment = payment, shipping = shipping}
```

### Auf Signale warten

Warten Sie auf externe Ereignisse wie Genehmigungsentscheidungen, Webhooks oder Benutzeraktionen:

```lua
local funcs = require("funcs")

local _, err = funcs.call("app.approvals:submit", request)
if err then return nil, err end

local inbox = process.inbox()
local msg, open = inbox:receive()  -- blocks until signal arrives
if not open then return nil, errors.new("workflow inbox closed") end

local decision, payload_err = msg:payload():data()
if payload_err then return nil, payload_err end

if decision.approved then
    return funcs.call("app.orders:fulfill", request.order_id)
else
    return funcs.call("app.notifications:send_rejection", request)
end
```

## Compute-Modell auswählen

| Anwendungsfall | Auswahl |
|----------|--------|
| Verarbeitung von HTTP-Anfragen | Funktionen |
| Datentransformation | Funktionen |
| Hintergrundaufgaben | Prozesse |
| Zustand von Benutzersitzungen | Prozesse |
| Echtzeitnachrichten | Prozesse |
| Zahlungsverarbeitung | Workflows |
| Auftragserfüllung | Workflows |
| Mehrtägige Genehmigungen | Workflows |

## Workflows starten

Workflows verwenden `process.spawn()` mit einem Workflow-Host:

```lua
-- Spawn workflow on temporal worker
local pid, err = process.spawn("app.workflows:order_processor", "app:temporal_worker", order_data)
if err then return nil, err end

-- Send signals to workflow
local ok, err = process.send(pid, "update", {status = "approved"})
if err then return nil, err end
return ok
```

Der Aufrufer verwendet dieselbe Spawn-API. Der Host bestimmt, ob der Eintrag auf einem
`temporal.worker` oder einem `process.host` läuft. Persistierte Historie und Replay gelten
nur für den über Temporal gehosteten Pfad. Ein Workflow-Eintrag, der über einen gewöhnlichen
Process Host läuft, hat In-Memory-Prozesssemantik und erhält keine Temporal-Dauerhaftigkeit.

<tip>
Wenn ein Workflow über <code>process.spawn()</code> Kinder startet, werden diese beim selben Provider zu Child Workflows und behalten die Dauerhaftigkeitsgarantien.
</tip>

## Fehler und Supervision

Prozesse können mit `process.service` als überwachte Services laufen:

```yaml
# Process definition
- name: session_handler
  kind: process.lua
  source: file://session_handler.lua
  method: main

# Supervised service wrapping the process
- name: session_manager
  kind: process.service
  process: app:session_handler
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

Workflows verwenden keine Prozess-Supervision-Trees. Der Workflow-Provider verwaltet
Persistenz und Wiederherstellung; Retries auf Anwendungsebene folgen den konfigurierten
Workflow- und Activity-Richtlinien.

## Konfiguration

Workflow-Definition für dynamischen Start:

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_processor.lua
  method: main
  meta:
    temporal:
      workflow:
        worker: app:temporal_worker
  modules:
    - funcs
    - time
```

Jede über `funcs.call()` aufgerufene Funktion oder jeder darüber aufgerufene Prozess deklariert ebenfalls den
Activity-Worker. Beispiel:

```yaml
- name: charge_card
  kind: function.lua
  source: file://charge_card.lua
  method: main
  meta:
    temporal:
      activity:
        worker: app:temporal_worker
```

Workflow-Provider:

```yaml
- name: temporal_worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "orders"
  lifecycle:
    auto_start: true
```

Produktionsinfrastruktur für Workflows beschreibt [Temporal](https://temporal.io).

## Siehe auch

- [Funktionen](./functions.md) — Anfragegebundene Aufrufe
- [Prozessmodell](./process-model.md) — Zustandsbehaftete Hintergrundarbeit
- [Supervision](../guides/supervision.md) — Richtlinien für Prozessneustarts
