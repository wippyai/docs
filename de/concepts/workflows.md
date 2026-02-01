# Workflows

Workflows sind dauerhafte, langlebige Operationen, die Abstürze und Neustarts überleben. Sie bieten Zuverlässigkeitsgarantien für kritische Geschäftsprozesse wie Zahlungen, Auftragsabwicklung und mehrstufige Genehmigungen.

## Warum Workflows?

Funktionen sind flüchtig - wenn der Host abstürzt, geht laufende Arbeit verloren. Workflows persistieren ihren Zustand:

| Aspekt | Funktionen | Workflows |
|--------|------------|-----------|
| Zustand | Im Speicher | Persistiert |
| Absturz | Verlorene Arbeit | Setzt fort |
| Dauer | Sekunden bis Minuten | Stunden bis Monate |
| Abschluss | Best Effort | Garantiert |

## Wie Workflows funktionieren

Workflow-Code sieht aus wie regulärer Lua-Code:

```lua
local funcs = require("funcs")
local time = require("time")

local result = funcs.call("app.api:charge_card", payment)
time.sleep("24h")
local status = funcs.call("app.api:check_status", result.id)

if status == "failed" then
    funcs.call("app.api:refund", result.id)
end
```

Die Workflow-Engine fängt Aufrufe ab und zeichnet Ergebnisse auf. Wenn der Prozess abstürzt, wird die Ausführung aus der Historie replayed - gleicher Code, gleiche Ergebnisse.

<note>
Wippy behandelt Determinismus automatisch. Operationen wie <code>funcs.call()</code>, <code>time.sleep()</code>, <code>uuid.v4()</code> und <code>time.now()</code> werden abgefangen und ihre Ergebnisse aufgezeichnet. Beim Replay werden aufgezeichnete Werte zurückgegeben, anstatt sie erneut auszuführen.
</note>

## Workflow-Muster

### Saga-Muster

Bei Fehlern kompensieren:

```lua
local funcs = require("funcs")

local inventory = funcs.call("app.inventory:reserve", items)
if inventory.error then
    return nil, inventory.error
end

local payment = funcs.call("app.payments:charge", amount)
if payment.error then
    funcs.call("app.inventory:release", inventory.id)
    return nil, payment.error
end

local shipping = funcs.call("app.shipping:create", order)
if shipping.error then
    funcs.call("app.payments:refund", payment.id)
    funcs.call("app.inventory:release", inventory.id)
    return nil, shipping.error
end

return {inventory = inventory, payment = payment, shipping = shipping}
```

### Auf Signale warten

Auf externe Events warten (Genehmigungsentscheidungen, Webhooks, Benutzeraktionen):

```lua
local funcs = require("funcs")

funcs.call("app.approvals:submit", request)

local inbox = process.inbox()
local msg = inbox:receive()  -- blockiert bis Signal ankommt

if msg.approved then
    funcs.call("app.orders:fulfill", request.order_id)
else
    funcs.call("app.notifications:send_rejection", request)
end
```

## Wann was verwenden

| Anwendungsfall | Wählen |
|----------------|--------|
| HTTP-Request-Behandlung | Funktionen |
| Datentransformation | Funktionen |
| Hintergrundjobs | Prozesse |
| Benutzersitzungszustand | Prozesse |
| Echtzeit-Messaging | Prozesse |
| Zahlungsverarbeitung | Workflows |
| Auftragsabwicklung | Workflows |
| Mehrtägige Genehmigungen | Workflows |

## Workflows starten

Workflows werden auf dieselbe Weise gestartet wie Prozesse - mit `process.spawn()` mit einem anderen Host:

```lua
-- Workflow auf temporal worker starten
local pid = process.spawn("app.workflows:order_processor", "app:temporal_worker", order_data)

-- Signale an Workflow senden
process.send(pid, "update", {status = "approved"})
```

Aus Sicht des Aufrufers ist die API identisch. Der Unterschied ist der Host: Workflows laufen auf einem `temporal.worker` statt auf einem `process.host`.

<tip>
Wenn ein Workflow Kinder über <code>process.spawn()</code> startet, werden sie zu Kind-Workflows beim selben Provider, wobei Dauerhaftigkeitsgarantien erhalten bleiben.
</tip>

## Fehler und Supervision

Prozesse können als überwachte Dienste mit `process.service` laufen:

```yaml
# Prozessdefinition
- name: session_handler
  kind: process.lua
  source: file://session_handler.lua
  method: main

# Überwachter Dienst, der den Prozess umhüllt
- name: session_manager
  kind: process.service
  process: app:session_handler
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

Workflows verwenden keine Supervision-Bäume - sie werden automatisch vom Workflow-Provider (Temporal) verwaltet. Der Provider behandelt Persistenz, Retries und Wiederherstellung.

## Konfiguration

Prozessdefinition (dynamisch gestartet):

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_processor.lua
  method: main
  modules:
    - funcs
    - time
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

Siehe [Temporal](https://temporal.io) für Produktions-Workflow-Infrastruktur.

## Siehe auch

- [Funktionen](concept-functions.md) - Zustandslose Request-Behandlung
- [Prozessmodell](concept-process-model.md) - Zustandsbehaftete Hintergrundarbeit
- [Supervision](guide-supervision.md) - Prozess-Neustart-Richtlinien
