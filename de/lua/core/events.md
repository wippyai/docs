# Event-Bus
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Veröffentlichen und abonnieren Sie Events in Ihrer Anwendung für ereignisgesteuerte Architekturen.

## Laden

```lua
local events = require("events")
```

## Events abonnieren

Abonnieren Sie Events vom Event-Bus:

```lua
-- Alle Bestellungs-Events abonnieren
local sub, err = events.subscribe("orders.*")
if err then
    return nil, err
end

-- Bestimmte Event-Art abonnieren
local sub = events.subscribe("users", "user.created")

-- Alle Events von einem System abonnieren
local sub = events.subscribe("payments")

-- Events verarbeiten
local ch = sub:channel()
while true do
    local evt, ok = ch:receive()
    if not ok then break end

    logger:info("Received event", {
        system = evt.system,
        kind = evt.kind,
        path = evt.path
    })
    handle_event(evt)
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `system` | string | System-Muster (unterstützt Wildcards wie "test.*") |
| `kind` | string | Event-Art-Filter (optional) |

**Gibt zurück:** `Subscription, error`

## Events senden

Senden Sie ein Event an den Event-Bus:

```lua
-- Bestellung-erstellt-Event senden
local ok, err = events.send("orders", "order.created", "/orders/123", {
    order_id = "123",
    customer_id = "456",
    total = 99.99
})
if err then
    return nil, err
end

-- Benutzer-Event senden
events.send("users", "user.registered", "/users/" .. user.id, {
    user_id = user.id,
    email = user.email,
    created_at = time.now():format("2006-01-02T15:04:05Z07:00")
})

-- Zahlungs-Event senden
events.send("payments", "payment.completed", "/payments/" .. payment.id, {
    payment_id = payment.id,
    order_id = payment.order_id,
    amount = payment.amount,
    method = payment.method
})

-- Ohne Daten senden
events.send("system", "heartbeat", "/health")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `system` | string | System-Identifikator |
| `kind` | string | Event-Art/-Typ |
| `path` | string | Event-Pfad für Routing |
| `data` | any | Event-Payload (optional) |

**Gibt zurück:** `boolean, error`

## Subscription-Methoden

### Channel abrufen

Holen Sie den Channel zum Empfangen von Events:

```lua
local ch = sub:channel()

local evt, ok = ch:receive()
if ok then
    print("System:", evt.system)
    print("Kind:", evt.kind)
    print("Path:", evt.path)
    print("Data:", json.encode(evt.data))
end
```

Event-Felder: `system`, `kind`, `path`, `data`

### Subscription schließen

Abonnement beenden und Channel schließen:

```lua
sub:close()
```

## Berechtigungen

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `events.subscribe` | system | Events von einem System abonnieren |
| `events.send` | system | Events an ein System senden |

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leeres System | `errors.INVALID` | nein |
| Leere Art | `errors.INVALID` | nein |
| Leerer Pfad | `errors.INVALID` | nein |
| Policy abgelehnt | `errors.INVALID` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.
