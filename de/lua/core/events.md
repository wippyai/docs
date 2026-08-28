---
title: "Event-Bus"
description: "Best-Effort-Events der Runtime und Anwendung veröffentlichen und beobachten."
---

# Event-Bus
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Der Event-Bus veröffentlicht Runtime- und Anwendungsaktivität für Monitoring, Logging, Metriken und reaktive Nebeneffekte. Diese Seite ist eine API-Referenz; die Ausschnitte setzen einen ausführbaren Lua-Entry mit dem aufgeführten Modul und den erforderlichen Berechtigungen voraus.

<note>
Der Event-Bus ist ein Best-Effort-Publish/Subscribe-Kanal, kein zuverlässiger Transport. Verlassen Sie sich bei geschäftskritischer Zustellung nicht darauf. Verwenden Sie Prozess-Messaging (`process.send`), Channels oder die [Nachrichten-Queue](lua/storage/queue.md), wenn die Zustellung für die Korrektheit der Anwendung erforderlich ist.
</note>

## Laden

```lua
local events = require("events")
```

## Events abonnieren

Abonniert ein System oder Systemmuster mit einem optionalen Filter für die Event-Art:

```lua
-- Subscribe to all order events
local sub, err = events.subscribe("orders.*")
if err then
    return nil, err
end

-- Process events
local ch = sub:channel()
while true do
    local evt, ok = ch:receive()
    if not ok then break end

    print(evt.system, evt.kind, evt.path)
    -- Process evt.data when the publisher supplied a payload.
end
```

Übergeben Sie ein zweites Argument, um die Zustellung auf eine Art zu beschränken, beispielsweise `events.subscribe("users", "user.created")`. Ohne Art werden alle Arten des passenden Systems akzeptiert.

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `system` | string | System-Muster (unterstützt Wildcards wie "test.*") |
| `kind` | string | Event-Art-Filter (optional) |

**Gibt zurück:** `Subscription, error`

## Events senden

Ein Ereignis an den Event-Bus senden:

```lua
-- Send order created event
local ok, err = events.send("orders", "order.created", "/orders/123", {
    order_id = "123",
    customer_id = "456",
    total = 99.99
})
if err then
    return nil, err
end

-- Send without data
local heartbeat_sent, heartbeat_err = events.send("system", "heartbeat", "/health")
if heartbeat_err then
    return nil, heartbeat_err
end
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `system` | string | System-Identifikator |
| `kind` | string | Event-Art/-Typ |
| `path` | string | Event-Pfad für Routing |
| `data` | any | Event-Payload (optional) |

**Gibt zurück:** `boolean, error`

Eine erfolgreiche Rückgabe bestätigt, dass die Runtime das Senden angenommen hat. Sie bestätigt nicht, dass ein Subscriber das Event empfangen oder verarbeitet hat.

## Subscription-Methoden

### Channel abrufen

Den Channel zum Empfangen von Ereignissen holen:

```lua
local json = require("json")
local ch = sub:channel()

local evt, ok = ch:receive()
if ok then
    print("System:", evt.system)
    print("Kind:", evt.kind)
    print("Path:", evt.path)
    local encoded, encode_err = json.encode(evt.data)
    if encode_err then return nil, encode_err end
    print("Data:", encoded)
end
```

Jedes Event enthält `system`, `kind` und `path`. Das Feld `data` ist nur vorhanden, wenn der Publisher ein von `nil` verschiedenes Payload angegeben hat.

### Subscription schließen

Abonnement beenden und Channel schließen:

```lua
local closed = sub:close() -- true
```

Das Schließen ist idempotent. Nachdem der Channel geschlossen wurde, gibt `receive()` nach dem Leeren gepufferter Events `nil, false` zurück.

## Berechtigungen

| Aktion | Ressource | Beschreibung |
|--------|-----------|--------------|
| `events.subscribe` | system | Events von einem System abonnieren |
| `events.send` | system | Events an ein System senden |

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|-----|--------------|
| Leeres System | `errors.INVALID` | nein |
| Leere Art beim Senden | `errors.INVALID` | nein |
| Leerer Pfad | `errors.INVALID` | nein |
| Policy abgelehnt | `errors.INVALID` | nein |
| Ausführungs- oder Prozesskontext fehlt | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua/core/errors.md) für den Umgang mit Fehlern.
