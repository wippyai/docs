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
| `queue.consumer` | Consumer der Nachrichten verarbeitet |

## Driver-Konfiguration

### Memory-Driver

In-Process-Driver für Entwicklung und Single-Node-Deployments. Keine externen Abhängigkeiten.

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
| `default_message_ttl` | duration | - | Standard-Message-TTL für deklarierte Queues |
| `default_queue_ttl` | duration | - | Standard-TTL für deklarierte Queues |
| `default_queue_expiry` | duration | - | Standard-Queue-Expiry für deklarierte Queues |
| `prefetch_count` | int | - | Channel-weite Prefetch-Obergrenze |
| `frame_size` | int | - | AMQP-Frame-Size-Limit |
| `channel_max` | int | - | Maximale Channels pro Verbindung |
| `tls` | object | - | TLS-Einstellungen (siehe unten) |

TLS-Block:

```yaml
  tls:
    enabled: true
    server_name: "rabbit.example.com"
    cert_env: "AMQP_CLIENT_CERT"
    key_env: "AMQP_CLIENT_KEY"
    ca_env: "AMQP_CA_CERT"
    insecure_skip_verify: false
```

Inline-Felder `cert`/`key`/`ca` enthalten PEM-Inhalt; `*_env`-Varianten werden über die Env-Registry aufgelöst. Die beiden Quellen schließen sich pro Feld gegenseitig aus. `insecure_skip_verify` deaktiviert die Zertifikatsprüfung (nur für Entwicklung).

### SQS-Driver

Für AWS SQS und SQS-kompatible Endpoints (LocalStack, ElasticMQ). Anmeldedaten, Region und andere AWS-SDK-Einstellungen kommen aus einer geteilten `config.aws`-Ressource.

```yaml
- name: aws_config
  kind: config.aws
  region: us-east-1
  access_key_id_env: app:AWS_ACCESS_KEY_ID
  secret_access_key_env: app:AWS_SECRET_ACCESS_KEY

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

Queues werden vom Driver bei der ersten Verwendung automatisch erstellt. Verwenden Sie SQS-präfixierte Header (`sqs.*`), um SQS-spezifische Attribute beim Publish zu adressieren; neutrale Schlüssel wie `correlation_id` und `content_type` werden, wo möglich, in SQS-Systemattribute übersetzt.

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
| `codec` | string | Nein | Payload-Kodierung (z. B. `json/plain`, `msgpack/plain`) |
| `queue_name` | string | Nein | Externer Queue-Name (Standard: Entry-Name) |
| `driver_options` | object | Nein | Per-Driver-Sub-Bag, indiziert nach Driver-Kind |
| `dead_letter.queue` | Registry-ID | Nein | Queue-ID für fehlgeschlagene Nachrichten |
| `dead_letter.max_attempts` | int | Nein | Versuche vor Routing zur DLQ |

### Driver-Optionen

Schlüssel unter `driver_options` sind nach Driver-Name geordnet. Ein Driver liest nur seinen eigenen Sub-Bag — andere Schlüssel sind inaktiv, was es einer einzigen Queue-Definition erlaubt, bei Bedarf Einstellungen für mehrere Driver zu deklarieren.

**memory:**

| Schlüssel | Beschreibung |
|-----------|--------------|
| `max_length` | Begrenzte Puffergröße (0 = unbegrenzt) |

**amqp:**

| Schlüssel | Beschreibung |
|-----------|--------------|
| `durable` | Übersteht Broker-Neustart |
| `auto_delete` | Wird gelöscht wenn letzter Consumer sich trennt |
| `message_ttl` | Per-Queue-Message-TTL-Override |
| `queue_expiry` | Ablauf für ungenutzte Queues |
| `max_length` | Maximal aufbewahrte Nachrichten |

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
    depends_on:
      - app.queue:tasks
```

| Feld | Standard | Beschreibung |
|------|----------|--------------|
| `queue` | erforderlich | Queue-Registry-ID |
| `func` | erforderlich | Handler-Funktions-Registry-ID |
| `concurrency` | 1 | Parallele Worker-Anzahl |
| `prefetch` | 10 | Per-Worker-Puffergröße |
| `auto_ack` | false | Wenn true, ruft die Runtime kein Broker-Ack auf; Handler-Erfolg/-Fehler ist das einzige Settle-Signal |
| `driver_options` | - | Per-Driver-Sub-Bag (gleiche Struktur wie Queue) |

**amqp-Consumer-Optionen:**

| Schlüssel | Beschreibung |
|-----------|--------------|
| `exclusive` | Single-Consumer-Queue-Zugriff |
| `no_local` | Lehnt Nachrichten ab, die auf derselben Verbindung publiziert wurden |
| `no_wait` | Wartet beim Subscribe nicht auf Broker-Bestätigung |
| `consumer_tag` | Kennung für dieses Abonnement |

<tip>
Consumer respektieren Aufrufkontext und können Sicherheitsrichtlinien unterliegen. Konfigurieren Sie Actor und Richtlinien auf Lebenszyklus-Ebene. Siehe <a href="system/security.md">Sicherheit</a>.
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

Consumer-Handler erhalten den dekodierten Nachrichteninhalt als erstes Argument. Verwenden Sie `queue.message()`, um auf Delivery-Metadaten (id, headers) zuzugreifen.

```lua
local queue = require("queue")
local logger = require("logger")

local function main(body)
    local msg = queue.message()
    logger:info("processing", {
        id = msg:id(),
        correlation_id = msg:header("correlation_id")
    })

    local ok, err = process_task(body)
    if err then
        return false  -- nack: redelivery or DLQ
    end
    return true       -- ack: remove from queue
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

Die Runtime settled basierend auf der Handler-Rückgabe automatisch:

| Handler-Ergebnis | Aktion |
|------------------|--------|
| `true` oder Nicht-`false`-Rückgabe | Ack |
| `false` | Nack (Redelivery oder Dead-Letter je nach Driver) |
| Geworfener Fehler | Nack |

Rufen Sie `msg:ack()` oder `msg:nack()` explizit nur auf, um vorzeitig zu settlen. Settlement ist Single-Shot: der zuerst eintreffende Aufruf gewinnt.

### Dead-Letter-Routing

Wenn `dead_letter` auf der Queue konfiguriert ist, wird eine Nachricht, die über `max_attempts` hinaus nack'd wird, mit den vom Driver gesetzten Headern `x_dead_letter_reason` und `x_original_queue` an die DLQ geleitet. Publisher dürfen keinen `x_*`-Header setzen — diese sind für DLQ-Buchhaltung reserviert.

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

Siehe [Queue-Modul](lua/storage/queue.md) für vollständige API.

## Kontrolliertes Herunterfahren

Beim Stoppen des Consumers:

1. Keine neuen Lieferungen mehr annehmen
2. Worker-Kontexte abbrechen
3. Auf laufende Nachrichten warten (mit Timeout)
4. Fehler zurückgeben wenn Worker nicht rechtzeitig fertig werden

## Siehe auch

- [Queue-Modul](lua/storage/queue.md) - Lua-API-Referenz
- [Queue-Konsumenten-Anleitung](guides/queue-consumers.md) - Consumer-Muster und Worker-Pools
- [Supervision](guides/supervision.md) - Consumer-Lebenszyklus-Verwaltung
