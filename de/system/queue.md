# Queue

Wippy bietet ein Queue-System für asynchrone Nachrichtenverarbeitung mit konfigurierbaren Treibern und Konsumenten.

## Architektur

```mermaid
flowchart LR
    P[Publisher] --> D[Driver]
    D --> Q[Queue]
    Q --> C[Consumer]
    C --> W[Worker Pool]
    W --> F[Function]
```

- **Driver** - Backend-Implementierung (Memory, AMQP, Redis)
- **Queue** - Logische Queue gebunden an einen Driver
- **Consumer** - Verbindet Queue mit Handler mit Nebenläufigkeits-Einstellungen
- **Worker Pool** - Nebenläufige Nachrichtenverarbeiter

Mehrere Queues können einen Driver teilen. Mehrere Consumer können aus derselben Queue verarbeiten.

## Entry-Typen

| Kind | Beschreibung |
|------|--------------|
| `queue.driver.memory` | In-Memory-Queue-Treiber |
| `queue.queue` | Queue-Deklaration mit Driver-Referenz |
| `queue.consumer` | Consumer der Nachrichten verarbeitet |

## Driver-Konfiguration

### Memory-Driver

In-Memory-Driver für Entwicklung und Tests.

```yaml
- name: memory_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true
```

<note>
Zusätzliche Driver (AMQP, Redis, SQS) sind geplant. Die Driver-Schnittstelle ermöglicht den Austausch von Backends ohne Änderung der Queue- oder Consumer-Konfiguration.
</note>

## Queue-Konfiguration

```yaml
- name: tasks
  kind: queue.queue
  driver: app.queue:memory_driver
```

| Feld | Typ | Erforderlich | Beschreibung |
|------|-----|--------------|--------------|
| `driver` | Registry-ID | Ja | Referenz auf Queue-Driver |
| `options` | Map | Nein | Treiberspezifische Optionen |

<note>
Der Memory-Driver hat keine Konfigurationsoptionen. Externe Driver (AMQP, Redis, SQS) definieren ihre eigenen Optionen für Queue-Verhalten wie Dauerhaftigkeit, maximale Länge und TTL.
</note>

## Consumer-Konfiguration

```yaml
- name: task_consumer
  kind: queue.consumer
  queue: app.queue:tasks
  func: app.queue:task_handler
  concurrency: 4
  prefetch: 20
  lifecycle:
    auto_start: true
    depends_on:
      - app.queue:tasks
```

| Feld | Standard | Max | Beschreibung |
|------|----------|-----|--------------|
| `queue` | Erforderlich | - | Queue-Registry-ID |
| `func` | Erforderlich | - | Handler-Funktions-Registry-ID |
| `concurrency` | 1 | 1000 | Parallele Worker-Anzahl |
| `prefetch` | 10 | 10000 | Nachrichtenpuffer-Größe |

<tip>
Consumer respektieren Aufrufkontext und können Sicherheitsrichtlinien unterliegen. Konfigurieren Sie Actor und Richtlinien auf Lebenszyklus-Ebene. Siehe <a href="system-security.md">Sicherheit</a>.
</tip>

### Worker-Pool

Worker laufen als nebenläufige Goroutinen:

```
concurrency: 3, prefetch: 10

1. Driver liefert bis zu 10 Nachrichten in den Puffer
2. 3 Worker holen nebenläufig aus dem Puffer
3. Wenn Worker fertig sind, füllt sich der Puffer nach
4. Gegendruck wenn alle Worker beschäftigt und Puffer voll
```

## Handler-Funktion

Consumer-Funktionen empfangen Nachrichtendaten und geben Erfolg oder Fehler zurück:

```lua
local json = require("json")
local logger = require("logger")

local function handler(body)
    local data = json.decode(body)

    logger.info("Verarbeite", {task_id = data.id})

    local result, err = process_task(data)
    if err then
        return nil, err  -- Nack: Nachricht erneut einreihen
    end

    return result  -- Ack: Aus Queue entfernen
end

return handler
```

```yaml
- name: task_handler
  kind: function.lua
  source: file://task_handler.lua
  modules:
    - json
    - logger
```

### Bestätigung

| Handler-Ergebnis | Aktion | Effekt |
|------------------|--------|--------|
| Rückgabewert | Ack | Nachricht aus Queue entfernt |
| Fehler zurückgeben | Nack | Nachricht erneut eingereiht (treiberabhängig) |

## Nachrichten veröffentlichen

Aus Lua-Code:

```lua
local queue = require("queue")

queue.publish("app.queue:tasks", {
    id = "task-123",
    action = "process",
    data = payload
})
```

Siehe [Queue-Modul](lua-queue.md) für vollständige API.

## Graceful Shutdown

Beim Consumer-Stop:

1. Keine neuen Lieferungen mehr annehmen
2. Worker-Kontexte abbrechen
3. Auf laufende Nachrichten warten (mit Timeout)
4. Fehler zurückgeben wenn Worker nicht rechtzeitig fertig werden

## Siehe auch

- [Queue-Modul](lua/storage/queue.md) - Lua-API-Referenz
- [Queue-Konsumenten-Anleitung](guides/queue-consumers.md) - Consumer-Muster und Worker-Pools
- [Supervision](guides/supervision.md) - Consumer-Lebenszyklus-Verwaltung
