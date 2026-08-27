---
title: "Queue"
description: "Konfigurieren Sie Memory-, AMQP- oder SQS-Queue-Treiber, logische Queues, Consumer, Bestätigungen und Publishing."
---

# Queue

Das Queue-System verbindet asynchrone Message-Publisher, Treiber, Queues, Consumer und Handler-Funktionen.

Diese Seite ist eine Konfigurations- und Verhaltensreferenz. YAML-Blöcke sind Fragmente für eine bestehende Entry-Liste, sofern sie kein vollständiges Dokument zeigen; Beispiele mit externen Treibern setzen voraus, dass der Broker oder AWS-kompatible Dienst bereits vorhanden ist.

## Architektur

```mermaid
flowchart LR
    P[Publisher] --> D[Driver]
    D --> Q[Queue]
    Q --> C[Consumer]
    C --> W[Worker Pool]
    W --> F[Function]
```

- **Driver** - Backend-Implementierung (Memory, AMQP, SQS)
- **Queue** - Logische Queue gebunden an einen Driver
- **Consumer** - Verbindet Queue mit Handler mit Nebenläufigkeits-Einstellungen
- **Worker Pool** - Nebenläufige Nachrichtenverarbeiter

Mehrere Queues können einen Driver teilen. Mehrere Consumer können aus derselben Queue verarbeiten.

## Entry-Typen

| Kind | Beschreibung |
|------|--------------|
| `queue.driver.memory` | In-Memory-Queue-Treiber |
| `queue.driver.amqp` | AMQP (RabbitMQ) Treiber |
| `queue.driver.sqs` | AWS-SQS-Treiber (auch LocalStack, ElasticMQ) |
| `queue.queue` | Queue-Deklaration mit Driver-Referenz |
| `queue.consumer` | Consumer, der Nachrichten verarbeitet |

## Driver-Konfiguration

### Memory-Driver

Der In-Process-Treiber ist für Entwicklung und Single-Node-Deployments vorgesehen und besitzt keine externen Abhängigkeiten.

```yaml
- name: memory_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true
```

### AMQP-Driver

Für RabbitMQ und AMQP-0-9-1-kompatible Broker.

```yaml
- name: amqp_driver
  kind: queue.driver.amqp
  url: "amqp://guest:guest@localhost:5672/"
  vhost: "/"
  connection_name: "wippy-service"
  heartbeat: "10s"
  connection_timeout: "30s"
  reconnect_delay: "1s"
  reconnect_max_delay: "30s"
  default_message_ttl: "1h"
  default_queue_expiry: "24h"
  prefetch_count: 10
  lifecycle:
    auto_start: true
```

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `url` | string | `amqp://guest:guest@localhost:5672/` | Broker-URL |
| `vhost` | string | - | Virtual-Host-Override |
| `connection_name` | string | - | In Broker-UI angezeigte Kennung |
| `auth_mechanism` | string | `PLAIN` | `PLAIN`, `EXTERNAL` (mTLS), oder `AMQPLAIN` |
| `heartbeat` | duration | - | Keep-Alive-Intervall |
| `connection_timeout` | duration | - | Dial-Timeout |
| `reconnect_delay` | duration | `1s` | Initialer Reconnect-Backoff |
| `reconnect_max_delay` | duration | `30s` | Maximaler Reconnect-Backoff |
| `default_message_ttl` | duration | - | Ablaufzeit pro Nachricht, wenn ein Publisher keine angibt |
| `default_queue_ttl` | duration | - | Standardmäßige Queue-weite Nachrichten-TTL (`x-message-ttl`) |
| `default_queue_expiry` | duration | - | Standardmäßiger Ablauf ungenutzter Queues (`x-expires`) |
| `prefetch_count` | int | - | Channel-weite Prefetch-Obergrenze |
| `frame_size` | int | - | AMQP-Frame-Size-Limit |
| `channel_max` | int | - | Maximale Channels pro Verbindung |
| `tls` | object | - | TLS-Einstellungen (siehe unten) |

Konfigurieren Sie TLS unter `tls`:

```yaml
  tls:
    enabled: true
    server_name: "rabbit.example.com"
    cert: ${env:app.env:amqp_cert}
    key:  ${env:app.env:amqp_key}
    ca:   ${env:app.env:amqp_ca}
    insecure_skip_verify: false
```

`cert`, `key` und `ca` enthalten PEM-Inhalt — inline, über `file://` oder als `${env:NAME}`-Platzhalter, der durch die [Env-Registry](./env.md) aufgelöst wird. `insecure_skip_verify` deaktiviert die Zertifikatsprüfung und ist nur für die Entwicklung gedacht. Die veralteten Direktiven `cert_env`, `key_env` und `ca_env` lesen ebenfalls aus der Env-Registry, behalten aber einen Inline- oder Nullwert bei, wenn die Auflösung fehlt oder leer ist; moderne Platzhalter ohne Standardwert schlagen bei fehlenden Variablen fehl.

### SQS-Driver

Für AWS SQS und SQS-kompatible Endpoints (LocalStack, ElasticMQ). Anmeldedaten, Region und andere AWS-SDK-Einstellungen kommen aus einer geteilten `config.aws`-Ressource.

```yaml
- name: aws_config
  kind: config.aws
  region: us-east-1
  access_key_id: ${env:app:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:app:AWS_SECRET_ACCESS_KEY}

- name: sqs_driver
  kind: queue.driver.sqs
  config: app:aws_config
  endpoint: "http://localhost:9324"
  message_retention_period: 345600
  default_delay_seconds: 0
  lifecycle:
    auto_start: true
```

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `config` | Registry-ID | erforderlich | `config.aws`-Ressource mit Region und Anmeldedaten |
| `endpoint` | string | - | Eigene Endpoint-URL (LocalStack, ElasticMQ); für echtes AWS weglassen |
| `message_retention_period` | int | `345600` (4d) | Queue-weite Aufbewahrung in Sekunden (60–1209600) |
| `default_delay_seconds` | int | `0` | Standard-Delivery-Verzögerung bei CreateQueue (0–900) |
| `disable_message_checksum_validation` | bool | `false` | SQS-Nachrichten-Prüfsummen beim Senden/Empfangen deaktivieren |
| `use_fips` | bool | `false` | FIPS-konforme Endpoints verwenden |
| `use_dual_stack` | bool | `false` | Dual-Stack-Endpoints (IPv4 + IPv6) verwenden |

Queues werden vom Treiber bei der ersten Verwendung automatisch erstellt. Verwenden Sie SQS-präfixierte Header für SQS-spezifische Felder beim Publishing: `sqs.delay_seconds`, `sqs.message_group_id` und `sqs.message_deduplication_id` werden typisierten SQS-Nachrichtenfeldern zugeordnet. Alle anderen Header — neutrale Schlüssel wie `correlation_id` und `content_type` sowie alle Schlüssel unter `sqs.message_attributes.*` — werden unverändert als SQS-Nachrichtenattribute übertragen.

## Queue-Konfiguration

```yaml
- name: tasks
  kind: queue.queue
  driver: app.queue:memory_driver
  codec: json/plain
  queue_name: "app_tasks"
  driver_options:
    memory:
      max_length: 500
  dead_letter:
    queue: app.queue:tasks_dlq
    max_attempts: 5
```

| Feld | Typ | Erforderlich | Beschreibung |
|------|-----|--------------|--------------|
| `driver` | Registry-ID | Ja | Queue-Driver |
| `codec` | string | Nein | Wire-Kodierung für Nachrichten-Bodies. Standard ist `json/plain` (siehe [Codecs](#codecs)) |
| `queue_name` | string | Nein | Externer Queue-Name (Standard: Entry-Name) |
| `driver_options` | object | Nein | Per-Driver-Sub-Bag, indiziert nach Driver-Kind |
| `dead_letter.queue` | Registry-ID | Nein | Queue-ID für fehlgeschlagene Nachrichten; akzeptiert, aber von keinem integrierten Treiber durchgesetzt |
| `dead_letter.max_attempts` | int | Nein | Versuche vor dem Routing zur DLQ; akzeptiert, aber von keinem integrierten Treiber durchgesetzt |

### Driver-Optionen

Schlüssel unter `driver_options` sind nach Driver-Name geordnet. Ein Driver liest nur seinen eigenen Sub-Bag — andere Schlüssel sind inaktiv, was es einer einzigen Queue-Definition erlaubt, bei Bedarf Einstellungen für mehrere Driver zu deklarieren.

**memory:**

| Schlüssel | Beschreibung |
|-----------|--------------|
| `max_length` | Begrenzte Puffergröße (0 oder nicht gesetzt = Standardwert 1000) |

**amqp:**

| Schlüssel | Beschreibung |
|-----------|--------------|
| `durable` | Übersteht Broker-Neustart |
| `auto_delete` | Wird gelöscht wenn letzter Consumer sich trennt |
| `message_ttl` | Per-Queue-Message-TTL-Override |
| `queue_expiry` | Ablauf für ungenutzte Queues |
| `max_length` | Maximal aufbewahrte Nachrichten |

### Codecs

Der `codec` legt fest, wie ein Nachrichten-Body serialisiert wird, bevor er an den Broker übergeben wird. Es ist ein Payload-Format-String und ist standardmäßig `json/plain`:

| Codec | Format |
|-------|--------|
| `json/plain` | JSON (Standard) |
| `application/msgpack` | MessagePack |

Der AMQP-Driver setzt einen passenden `content-type` (`application/json` oder `application/msgpack`) auf veröffentlichte Nachrichten. Ein unbekannter Codec schlägt fehl, wenn die Queue deklariert wird, nicht beim Veröffentlichen.

## Consumer-Konfiguration

```yaml
- name: task_consumer
  kind: queue.consumer
  queue: app.queue:tasks
  func: app.queue:task_handler
  concurrency: 4
  prefetch: 20
  auto_ack: false
  driver_options:
    amqp:
      consumer_tag: "worker-1"
      exclusive: false
  lifecycle:
    auto_start: true
    requires:
      - app.queue:tasks
```

| Feld | Standard | Beschreibung |
|------|----------|--------------|
| `queue` | erforderlich | Queue-Registry-ID |
| `func` | erforderlich | Handler-Funktions-Registry-ID |
| `concurrency` | 1 | Parallele Worker-Anzahl |
| `prefetch` | 10 | Größe des gemeinsamen Delivery-Puffers; AMQP verwendet den Wert außerdem als QoS-Prefetch-Anzahl des Channels |
| `auto_ack` | false | Backend-spezifische Auto-Ack-Option; bei AMQP fordert `true` den Broker auf, bei der Zustellung zu bestätigen |
| `driver_options` | - | Per-Driver-Sub-Bag (gleiche Struktur wie Queue) |

**amqp-Consumer-Optionen:**

| Schlüssel | Beschreibung |
|-----------|--------------|
| `exclusive` | Single-Consumer-Queue-Zugriff |
| `no_local` | Lehnt Nachrichten ab, die auf derselben Verbindung publiziert wurden |
| `no_wait` | Wartet beim Subscribe nicht auf Broker-Bestätigung |
| `consumer_tag` | Kennung für dieses Abonnement |

<tip>
Consumer berücksichtigen den Aufrufkontext und können Sicherheitsrichtlinien unterliegen. Konfigurieren Sie Actor und Richtlinien auf Lebenszyklusebene. Siehe <a href="./security.md">Sicherheit</a>.
</tip>

### Worker-Pool

Worker werden nebenläufig ausgeführt:

```
concurrency: 3, prefetch: 10

1. Driver delivers up to 10 messages to the shared buffer
2. 3 workers pull from the buffer and can each hold an active delivery
3. As workers finish, buffer refills
4. Backpressure when all workers busy and buffer full
```

## Handler-Funktion

Consumer-Handler erhalten den dekodierten Nachrichteninhalt als erstes Argument. Verwenden Sie `queue.message()`, um auf Delivery-Metadaten (id, headers) zuzugreifen.

```lua
local queue = require("queue")
local logger = require("logger")

local function main(body)
    local msg, msg_err = queue.message()
    if msg_err then return nil, msg_err end
    local message_id, id_err = msg:id()
    if id_err then return nil, id_err end
    local correlation_id, header_err = msg:header("correlation_id")
    if header_err then return nil, header_err end

    logger:info("processing", {
        id = message_id,
        correlation_id = correlation_id
    })

    local _, task_err = process_task(body)
    if task_err then return nil, task_err end
    return true
end

return { main = main }
```

```yaml
- name: task_handler
  kind: function.lua
  source: file://task_handler.lua
  method: main
  modules:
    - queue
    - logger
```

### Bestätigung

Sofern der Handler die Nachricht nicht ausdrücklich bestätigt oder ablehnt, entscheidet der Consumer anhand des Ergebnisses des Funktionsaufrufs:

| Handler-Ergebnis | Aktion |
|------------------|--------|
| Abschluss ohne Aufruffehler | Ack |
| Zurückgegebener oder ausgelöster Aufruffehler | Nack (erneute Zustellung gemäß Treiber) |

Gewöhnliche Rückgabewerte, einschließlich `false`, wählen das Bestätigungsverhalten nicht aus. Rufen Sie `msg:ack()` oder `msg:nack()` auf, um ausdrücklich zu bestätigen oder abzulehnen. Settlement ist einmalig: Der erste eintreffende Aufruf gewinnt.

### Dead-Letter-Routing

Dead-Letter-Routing ist noch nicht implementiert. Der Block `dead_letter` wird in der Konfiguration akzeptiert, aber derzeit zählt kein integrierter Treiber Versuche, leitet abgelehnte Nachrichten an die konfigurierte DLQ weiter oder setzt `x_dead_letter_*`-Header. Eine abgelehnte Nachricht wird gemäß der eigenen Richtlinie des Treibers erneut zugestellt. Der Header-Namespace `x_*` ist für zukünftige DLQ-Buchhaltung reserviert; Publisher sollten daher keine `x_*`-Header setzen.

## Nachrichten veröffentlichen

Aus Lua-Code:

```lua
local queue = require("queue")

local published, publish_err = queue.publish("app.queue:tasks", {
    id = "task-123",
    action = "process",
    data = payload
})
if publish_err then return nil, publish_err end
return published
```

Siehe [Queue-Modul](../lua/storage/queue.md) für die Lua-API zum Publishing und für Nachrichten.

## Kontrolliertes Herunterfahren

Beim Stoppen des Consumers:

1. Keine neuen Lieferungen mehr annehmen
2. Worker-Kontexte abbrechen
3. Auf laufende Nachrichten warten (mit Timeout)
4. Fehler zurückgeben wenn Worker nicht rechtzeitig fertig werden

## Siehe auch

- [Queue-Modul](../lua/storage/queue.md) - Lua-API-Referenz
- [Queue-Consumer-Anleitung](../guides/queue-consumers.md) - Consumer-Muster und Worker-Pools
- [Supervision](../guides/supervision.md) - Consumer-Lebenszyklusverwaltung
