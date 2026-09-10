---
title: "Nachrichten-Queue"
description: "Veröffentlichen und Konsumieren von Nachrichten aus verteilten Queues. Unterstützt mehrere Backends einschließlich RabbitMQ und andere…"
---

# Nachrichten-Queue
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Das Modul `queue` veröffentlicht Nachrichten und verarbeitet Zustellungen aus konfigurierten verteilten Queues, darunter RabbitMQ und andere AMQP-kompatible Broker.

Diese Seite ist eine API-Referenz. Die Ausschnitte zum Veröffentlichen setzen voraus, dass die Queue-Einträge und Berechtigungen bereits vorhanden sind. Der Consumer-Abschnitt ist ein Teilrezept für einen von `queue.consumer` aufgerufenen Handler und keine eigenständige Queue-Bereitstellung.

Informationen zur Queue-Konfiguration finden Sie unter [Queue](system/queue.md).

## Laden

```lua
local queue = require("queue")
```

## Nachrichten veröffentlichen

Senden Sie Nachrichten an eine Queue per ID:

```lua
local ok, err = queue.publish("app:tasks", {
    action = "send_email",
    user_id = 456,
    template = "welcome"
})
if err then
    return nil, err
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `queue_id` | string | Queue-Identifikator (Format: "namespace:name") |
| `data` | any | Nachrichtendaten (Tables, Strings, Zahlen, Booleans) |
| `headers` | table | Optionale Nachrichten-Header |

**Gibt zurück:** `boolean, error`

### Nachrichten-Header

Header übertragen Metadaten für Routing, Priorisierung und Tracing. Schlüssel müssen Zeichenketten sein; als Werte können Publisher Zeichenketten, Ganzzahlen, Zahlen oder boolesche Werte verwenden:

```lua
local ok, err = queue.publish("app:notifications", {
    type = "order_shipped",
    order_id = order.id
}, {
    priority = 5,
    correlation_id = request_id
})
if err then return nil, err end
```

Consumer erhalten jeden Header-Wert als Zeichenkette. Die Schlüssel `x_original_queue`, `x_dead_letter_reason`, `x_dead_letter_time` und `attempts` sind für Zustellungs- und Dead-Letter-Verwaltung reserviert und dürfen von Publishern nicht gesetzt werden.

## Zugriff auf Zustellungskontext

Innerhalb eines Queue-Consumers auf die aktuelle Nachricht zugreifen:

```lua
local msg, err = queue.message()
if err then
    return nil, err
end

local msg_id, id_err = msg:id()
if id_err then return nil, id_err end
local priority, header_err = msg:header("priority")
if header_err then return nil, header_err end
local all_headers, headers_err = msg:headers()
if headers_err then return nil, headers_err end
```

**Gibt zurück:** `Message, error`

Diese Funktion ist nur verfügbar, während ein Queue-Consumer eine Nachricht verarbeitet.

## Nachrichten-Methoden

| Methode | Gibt zurück | Beschreibung |
|--------|---------|-------------|
| `id()` | `string, error` | Eindeutiger Nachrichten-Identifikator |
| `header(key)` | `string, error` | Einzelner Header-Wert als String (nil wenn fehlend) |
| `headers()` | `table, error` | Alle Nachrichten-Header |
| `ack()` | `boolean, error` | Verarbeitung bestaetigen (single-shot) |
| `nack()` | `boolean, error` | Fehlschlag fuer Redelivery oder Dead-Letter melden (single-shot) |

Die Runtime bestätigt die Zustellung bei erfolgreichem Handler automatisch und weist sie bei einem Handler-Fehler automatisch zurück. Rufen Sie `ack` oder `nack` nur auf, um die Zustellung vorzeitig abzuschließen. Die Zustellung kann nur einmal abgeschlossen werden; nach der Rückkehr des Consumer-Handlers ist das `Message`-Objekt ungültig.

## Queue-Info

```lua
local stats, err = queue.info("app:tasks")
if err then return nil, err end
-- stats may contain: message_count, consumer_count, ready (driver-dependent)
```

**Gibt zurück:** `table, error`

## Consumer-Muster

Ein `queue.consumer`-Entry bindet eine Queue an eine Handler-Funktion (referenziert über `func`). Der Handler empfängt den Nachrichten-Payload direkt:

```yaml
entries:
  - kind: queue.consumer
    name: email_worker
    queue: app:emails
    func: app:email_handler
```

Dieses Fragment setzt voraus, dass `app:emails` und der Funktionseintrag `app:email_handler` bereits vorhanden sind. Der folgende Funktionsquelltext setzt voraus, dass die Anwendung `deliver_email(payload)` bereitstellt und alle dafür benötigten Berechtigungen erteilt.

```lua
-- app:email_handler
function handle_email(payload)
    local msg = queue.message()

    logger:info("Processing", {
        message_id = message_id,
        to = payload.to
    })

    local ok, send_err = deliver_email(payload)
    if send_err then return nil, send_err end
    return ok
end

return {main = main}
```

Wenn der Aufruf einen Fehler zurückgibt, weist der Consumer die noch nicht abgeschlossene Zustellung zurück. Die erneute Zustellung folgt anschließend dem Verhalten des ausgewählten Treibers; die integrierte Dead-Letter-Konfiguration wird in dieser Version nicht erzwungen.

## Berechtigungen

Queue-Operationen unterliegen der Auswertung der Sicherheitsrichtlinien.

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `queue.publish` | - | Allgemeine Berechtigung zum Veröffentlichen von Nachrichten |
| `queue.publish.queue` | Queue-ID | Zu spezifischer Queue veröffentlichen |

Die Runtime prüft zuerst die allgemeine und anschließend die Queue-spezifische Berechtigung.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Queue-ID leer | `errors.INVALID` | nein |
| Nachrichtenargument fehlt oder ist eine leere Tabelle | `errors.INVALID` | nein |
| Kein Zustellungskontext | `errors.INVALID` | nein |
| Nachricht freigegeben oder bereits abgeschlossen | `errors.INVALID` | nein |
| Veröffentlichung nicht erlaubt | `errors.INVALID` | nein |
| Veröffentlichung fehlgeschlagen | `errors.INTERNAL` | nein |
| Queue oder Treiber für `info` nicht gefunden | `errors.INTERNAL` | nein |

Informationen zum Umgang mit Fehlern finden Sie unter [Fehlerbehandlung](lua/core/errors.md).

## Siehe auch

- [Queue-Konfiguration](system/queue.md) – Queue-Treiber und Eintragsdefinitionen
- [Leitfaden für Queue-Consumer](guides/queue-consumers.md) – Consumer-Muster und Worker-Pools
- [Prozessverwaltung](lua/core/process.md) – Prozesse starten und mit ihnen kommunizieren
- [Channels](lua/core/channel.md) – Muster für die Kommunikation zwischen Prozessen
- [Funktionen](lua/core/funcs.md) – Asynchrone Funktionsaufrufe
