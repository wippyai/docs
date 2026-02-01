# Nachrichten-Queue
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Veroffentlichen und Konsumieren von Nachrichten aus verteilten Queues. Unterstutzt mehrere Backends einschliesslich RabbitMQ und andere AMQP-kompatible Broker.

Fur Queue-Konfiguration siehe [Queue](system-queue.md).

## Laden

```lua
local queue = require("queue")
```

## Nachrichten veroffentlichen

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

**Gibt zuruck:** `boolean, error`

### Nachrichten-Header

Header ermoglichen Routing, Priorisierung und Tracing:

```lua
queue.publish("app:notifications", {
    type = "order_shipped",
    order_id = order.id
}, {
    priority = "high",
    correlation_id = request_id
})
```

## Zugriff auf Zustellungskontext

Innerhalb eines Queue-Consumers auf die aktuelle Nachricht zugreifen:

```lua
local msg, err = queue.message()
if err then
    return nil, err
end

local msg_id = msg:id()
local priority = msg:header("priority")
local all_headers = msg:headers()
```

**Gibt zuruck:** `Message, error`

Nur verfugbar beim Verarbeiten von Queue-Nachrichten im Consumer-Kontext.

## Nachrichten-Methoden

| Methode | Gibt zuruck | Beschreibung |
|--------|---------|-------------|
| `id()` | `string, error` | Eindeutiger Nachrichten-Identifikator |
| `header(key)` | `any, error` | Einzelner Header-Wert (nil wenn fehlend) |
| `headers()` | `table, error` | Alle Nachrichten-Header |

## Consumer-Muster

Queue-Consumer werden als Entry-Points definiert, die den Payload direkt empfangen:

```yaml
entries:
  - kind: queue.consumer
    id: email_worker
    queue: app:emails
    method: handle_email
```

```lua
function handle_email(payload)
    local msg = queue.message()

    logger:info("Processing", {
        message_id = msg:id(),
        to = payload.to
    })

    local ok, err = email.send(payload.to, payload.template, payload.data)
    if err then
        return nil, err  -- Nachricht wird erneut eingereiht oder dead-lettered
    end
end
```

## Berechtigungen

Queue-Operationen unterliegen der Sicherheitsrichtlinienauswertung.

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `queue.publish` | - | Allgemeine Berechtigung zum Veroffentlichen von Nachrichten |
| `queue.publish.queue` | Queue-ID | Zu spezifischer Queue veroffentlichen |

Beide Berechtigungen werden gepruft: zuerst die allgemeine Berechtigung, dann die queue-spezifische.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Queue-ID leer | `errors.INVALID` | nein |
| Nachrichtendaten leer | `errors.INVALID` | nein |
| Kein Zustellungskontext | `errors.INVALID` | nein |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` | nein |
| Veroffentlichung fehlgeschlagen | `errors.INTERNAL` | ja |

Siehe [Fehlerbehandlung](lua/core/errors.md) fur die Arbeit mit Fehlern.

## Siehe auch

- [Queue-Konfiguration](system/queue.md) - Queue-Treiber und Entry-Definitionen
- [Queue-Consumer-Leitfaden](guides/queue-consumers.md) - Consumer-Muster und Worker-Pools
- [Prozessverwaltung](lua/core/process.md) - Prozess-Spawning und Kommunikation
- [Channels](lua/core/channel.md) - Inter-Prozess-Kommunikationsmuster
- [Funktionen](lua/core/funcs.md) - Asynchrone Funktionsaufrufe
