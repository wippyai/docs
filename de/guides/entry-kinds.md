---
title: "Entry-Typen-Referenz"
description: "Referenz der Wippy-Entry-Kinds für Runtime-, Storage-, Netzwerk-, Sicherheits-, Ausführungs- und Lebenszyklussysteme."
---

# Entry-Typen-Referenz

Diese Seite fasst die verfügbaren Entry-Kinds zusammen und verweist auf ihre ausführlichen Modul- und Systemreferenzen.

Die YAML- und Lua-Blöcke sind Referenzfragmente, keine einzelne Anwendung. Registry-IDs, Zugangsdaten, Datenobjekte und Helper wie `get_users` oder `delete_user` sind Beispiele; vollständige Rückgabe- und Fehlerverträge finden Sie auf den verlinkten Modulseiten.

> Einträge referenzieren sich gegenseitig im `namespace:name`-Format. Die Registry verbindet Abhängigkeiten automatisch basierend auf diesen Referenzen und stellt sicher, dass Ressourcen in der richtigen Reihenfolge initialisiert werden.

## Siehe auch

- [Registry](concepts/registry.md) - Wie Einträge gespeichert und aufgelöst werden
- [Konfiguration](guides/configuration.md) - YAML-Konfigurationsformat

## Lua-Runtime

| Art | Beschreibung |
|------|--------------|
| `function.lua` | Lua-Funktions-Entry-Point |
| `process.lua` | Langlebiger Lua-Prozess |
| `workflow.lua` | Temporal-Workflow (deterministisch) |
| `library.lua` | Gemeinsam genutzte Lua-Bibliothek |
| `module.lua` | Lua-Modul-Oberfläche |
| `function.lua.bc` | Vorkompiliertes Funktions-Bytecode |
| `library.lua.bc` | Vorkompiliertes Bibliothek-Bytecode |
| `process.lua.bc` | Vorkompiliertes Prozess-Bytecode |
| `workflow.lua.bc` | Vorkompiliertes Workflow-Bytecode |

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
  imports:
    utils: app.lib:helpers  # Import another entry as module
```

<tip>
Verwenden Sie <code>imports</code> um andere Lua-Einträge zu referenzieren. Sie werden über <code>require("alias_name")</code> in Ihrem Code verfügbar.
</tip>

## HTTP-Dienste

| Art | Beschreibung |
|------|--------------|
| `http.service` | HTTP-Server (bindet Port) |
| `http.router` | Routen-Präfix und Middleware |
| `http.endpoint` | HTTP-Endpunkt (Methode + Pfad) |
| `http.static` | Statische Datei-Bereitstellung |

```yaml
# HTTP server
- name: gateway
  kind: http.service
  addr: ":8080"
  lifecycle:
    auto_start: true

# Router with middleware
- name: api
  kind: http.router
  meta:
    server: gateway
  prefix: /api
  middleware:
    - cors
    - ratelimit

# Endpoint
- name: users_list
  kind: http.endpoint
  meta:
    router: app:api
  method: GET
  path: /users
  func: list_handler
```

**Lua-API:** Siehe [HTTP-Modul](lua/http/http.md)

```lua
local http = require("http")
local req = http.request()
local resp = http.response()

resp:set_status(200)
resp:write_json({users = get_users()})
```

## Datenbanken

| Art | Beschreibung |
|------|--------------|
| `db.sql.sqlite` | SQLite-Datenbank |
| `db.sql.postgres` | PostgreSQL-Datenbank |
| `db.sql.mysql` | MySQL-Datenbank |
| `db.cdc.postgres` | Postgres-Change-Data-Capture-Quelle (siehe [CDC](system/cdc.md)) |
| `db.cdc.sqlite` | SQLite-Change-Data-Capture-Quelle (siehe [CDC](system/cdc.md)) |

### SQLite

```yaml
- name: database
  kind: db.sql.sqlite
  file: "./data/app.db"
  lifecycle:
    auto_start: true

# In-memory for testing
- name: testdb
  kind: db.sql.sqlite
  file: ":memory:"
```

### PostgreSQL

```yaml
- name: database
  kind: db.sql.postgres
  host: localhost
  port: 5432
  database: dbname
  username: user
  password: pass
  options:
    sslmode: disable
  pool:
    max_open: 25
    max_idle: 5
    max_lifetime: "30m"
  lifecycle:
    auto_start: true
```

### MySQL

```yaml
- name: database
  kind: db.sql.mysql
  host: localhost
  port: 3306
  database: dbname
  username: user
  password: pass
  options:
    parseTime: "true"
  lifecycle:
    auto_start: true
```

Siehe [Datenbank](system/database.md) für `${env:NAME}`-Secret-Referenzen, TLS-Optionen und Verbindungs-Pool-Tuning. Ändert sich ein env-gestützter Wert hinter einem Datenbank-Eintrag, wird der Pool live ausgetauscht — aktive Ausleihen laufen mit den alten Verbindungseinstellungen zu Ende.

**Lua-API:** Siehe [SQL-Modul](lua/storage/sql.md)

```lua
local sql = require("sql")
local db, err = sql.get("app:database")

local rows, err = db:query("SELECT * FROM users WHERE id = ?", {user_id})
db:execute("INSERT INTO logs (msg) VALUES (?)", {message})
```


## Key-Value-Stores

| Art | Beschreibung |
|------|--------------|
| `store.memory` | In-Memory-Key-Value-Store |
| `store.sql` | SQL-basierter Key-Value-Store |
| `store.kv.raft` | Cluster-replizierter, stark konsistenter KV (geteiltes Raft) |
| `store.kv.crdt` | Cluster-replizierter, letztlich konsistenter KV (Gossip/CRDT) |

```yaml
# Memory store
- name: cache
  kind: store.memory
  lifecycle:
    auto_start: true

# SQL-backed store
- name: persistent_store
  kind: store.sql
  database: app:database
  table_name: kv_store
  lifecycle:
    auto_start: true

# Cluster-replicated store (requires clustering)
- name: deployments
  kind: store.kv.raft
  namespace: deploy
```

Die `store.kv.*`-Typen benötigen aktiviertes [Clustering](guides/cluster.md). Siehe [Store](system/store.md#cluster-kv-stores) für die Konsistenz-Abwägungen.

**Lua-API:** Siehe [Store-Modul](lua/storage/store.md)

```lua
local store = require("store")
local s, err = store.get("app:cache")

s:set("user:123", user_data, 3600)  -- TTL in seconds
local data = s:get("user:123")
```

## Queues

| Art | Beschreibung |
|------|--------------|
| `queue.driver.memory` | In-Memory-Queue-Treiber |
| `queue.driver.amqp` | AMQP-Treiber (RabbitMQ) |
| `queue.driver.sqs` | AWS-SQS-Treiber |
| `queue.queue` | Queue-Deklaration |
| `queue.consumer` | Queue-Konsument |

```yaml
# Driver
- name: queue_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true

# Queue
- name: jobs
  kind: queue.queue
  driver: queue_driver

# Consumer
- name: job_consumer
  kind: queue.consumer
  queue: app:jobs
  func: job_handler
  concurrency: 4
  prefetch: 10
  lifecycle:
    auto_start: true
```

**Lua-API:** Siehe [Queue-Modul](lua/storage/queue.md)

```lua
local queue = require("queue")

-- Publish a message
queue.publish("app:jobs", {task = "process", id = 123})

-- Im Consumer-Handler: der Nachrichtenrumpf ist das Argument des Handlers
local function main(data)
    -- Zustellungs-Metadaten über die aktuelle Nachricht abrufen
    local msg = queue.message()
    local id = msg:id()
    local priority = msg:header("priority")
    msg:ack()
end
```

<note>
Die <code>func</code> des Consumers wird einmal pro Nachricht mit dem Nachrichtenrumpf als Argument aufgerufen. Verwende <code>queue.message()</code> im Handler für <code>id()</code>, <code>header()</code>/<code>headers()</code> und <code>ack()</code>/<code>nack()</code> der Zustellung.
</note>

## Prozessverwaltung

| Art | Beschreibung |
|------|--------------|
| `process.host` | Prozessausführungs-Host |
| `process.service` | Überwachter Prozess (umhüllt process.lua) |
| `terminal.host` | Terminal/CLI-Host |
| `pg.scope` | Prozessgruppen-Scope (siehe [Prozessgruppen](system/process-groups.md)) |

```yaml
# Process host (where processes run)
- name: processes
  kind: process.host
  host:
    workers: 32             # Worker goroutines (default: NumCPU)
    queue_size: 1024        # Global queue capacity
    local_queue_size: 256   # Per-worker queue
  lifecycle:
    auto_start: true

# Process definition
- name: worker_process
  kind: process.lua
  source: file://worker.lua
  method: main

# Supervised process service
- name: worker
  kind: process.service
  process: app:worker_process
  host: app:processes
  input: ["arg1", "arg2"]
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10

- name: terminal
  kind: terminal.host
  lifecycle:
    auto_start: true
```

<tip>
Verwenden Sie <code>process.service</code> wenn ein Prozess als überwachter Dienst mit automatischem Neustart laufen soll. Das <code>process</code>-Feld referenziert einen <code>process.lua</code>-Eintrag.
</tip>

Das Aktualisieren eines laufenden `process.host`-Eintrags skaliert `host.workers` im laufenden Betrieb — laufende Prozesse, PIDs und Queues bleiben erhalten. `host.queue_size`, `host.local_queue_size` und `lifecycle` sind bei der Konstruktion fixiert: Ein Live-Update, das sie ändert, wird abgelehnt, ebenso das Anpassen der Worker-Anzahl auf einem Host, dessen Worker affinitäts-verwaltet sind.

### Prozess-Sicherheit

`process.lua`- und `process.lua.bc`-Einträge akzeptieren einen `security:`-Block auf oberster Ebene. Er ist Teil des Eintrags und gilt daher für jeden Spawn dieses Prozesses, sowohl auf `process.host` als auch auf `terminal.host`:

```yaml
- name: worker_process
  kind: process.lua
  source: file://worker.lua
  method: main
  security:
    actor:
      id: system.worker
      meta:
        tenant: acme
    policies:
      - app.security:worker_policy
    groups:
      - app.security:background_jobs
```

| Feld | Beschreibung |
|------|--------------|
| `actor.id` | Akteursidentität, unter der der Prozess läuft; ersetzt den geerbten Akteur |
| `actor.meta` | Akteursattribute, die Policies auswerten |
| `policies` | Registry-IDs (`namespace:name`) von Policies, die in den Scope eingefügt werden |
| `groups` | Registry-IDs von Policy-Gruppen, deren Policies in den Scope eingefügt werden |

Die Auflösung erfolgt beim Start des Prozesses und ist atomar: Lässt sich eine aufgeführte Policy oder Gruppe nicht auflösen, schlägt der Spawn fehl und es wird kein unvollständiger Kontext installiert. Wird `actor` weggelassen, wird der Akteur des spawnenden Prozesses geerbt; werden `policies` und `groups` beide weggelassen, wird dessen Scope geerbt. `function.lua`, `function.lua.bc`, `process.lua` und `process.lua.bc` akzeptieren den Block alle.

Ein Kommando-Eintrag kann zusätzlich `meta.command.security` deklarieren, was nur gilt, wenn der Eintrag als CLI-Kommando gestartet wird — siehe [Kommando-Sicherheit](guides/cli.md#command-security). Auf gewöhnliche Spawns hat es keine Auswirkung.

Siehe [Sicherheit](system/security.md).

## Temporal (Workflows)

| Art | Beschreibung |
|------|--------------|
| `temporal.client` | Temporal-Client-Verbindung |
| `temporal.worker` | Temporal-Worker |

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  namespace: "default"
  auth:
    type: none  # none, api_key, mtls
  lifecycle:
    auto_start: true

- name: temporal_worker
  kind: temporal.worker
  client: temporal_client
  task_queue: "main-queue"
  lifecycle:
    auto_start: true
```

## Cloud-Speicher

| Art | Beschreibung |
|------|--------------|
| `config.aws` | AWS-Konfiguration |
| `cloudstorage.s3` | S3-Bucket-Zugriff |

```yaml
- name: aws
  kind: config.aws
  region: "us-east-1"
  access_key_id: ${env:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:AWS_SECRET_ACCESS_KEY}

- name: uploads
  kind: cloudstorage.s3
  config: app:aws
  bucket: "my-uploads"
  endpoint: ""  # Optional, for S3-compatible services
```

**Lua-API:** Siehe [Cloud-Storage-Modul](lua/storage/cloud.md)

```lua
local cloudstorage = require("cloudstorage")
local storage, err = cloudstorage.get("app:uploads")

storage:upload_object("files/doc.pdf", file_content)
local url = storage:presigned_get_url("files/doc.pdf", {expiration = 3600})  -- Sekunden, Standard 3600
```

<tip>
Verwenden Sie <code>endpoint</code> um sich mit S3-kompatiblen Diensten wie MinIO oder DigitalOcean Spaces zu verbinden.
</tip>

## Dateisysteme

| Art | Beschreibung |
|------|--------------|
| `fs.directory` | Verzeichniszugriff |
| `fs.embed` | Schreibgeschütztes eingebettetes Dateisystem |

```yaml
- name: data_dir
  kind: fs.directory
  directory: "./data"
  auto_init: true   # Create if not exists
  mode: "0755"      # Permissions
```

**Lua-API:** Siehe [Dateisystem-Modul](lua/storage/filesystem.md)

```lua
local fs = require("fs")
local filesystem, err = fs.get("app:data_dir")

local file = filesystem:open("output.txt", "w")
file:write("Hello, World!")
file:close()
```

## Umgebung

| Art | Beschreibung |
|------|--------------|
| `env.storage.memory` | In-Memory-Umgebungsspeicher |
| `env.storage.file` | Dateibasierter Umgebungsspeicher |
| `env.storage.os` | Betriebssystem-Umgebung |
| `env.storage.static` | Schreibgeschützter statischer Key-Value-Speicher |
| `env.storage.router` | Umgebungs-Router (mehrere Speicher) |
| `env.variable` | Umgebungsvariable |

```yaml
- name: os_env
  kind: env.storage.os

- name: file_env
  kind: env.storage.file
  file_path: ".env"
  auto_create: true

- name: defaults
  kind: env.storage.static
  values:
    PUBLIC_API_HOST: "https://api.example.com"
    APP_ENV: "production"

- name: app_env
  kind: env.storage.router
  storages:
    - app:os_env
    - app:file_env
    - app:defaults
```

**Lua-API:** Siehe [Env-Modul](lua/system/env.md)

```lua
local env = require("env")

local api_key = env.get("API_KEY")
env.set("CACHE_TTL", "3600")
```

<note>
Der Router versucht Speicher der Reihe nach. Der erste Treffer gewinnt beim Lesen; Schreibvorgänge gehen an den ersten Speicher in der Liste.
</note>

## Vorlagen

| Art | Beschreibung |
|------|--------------|
| `template.jet` | Einzelne Jet-Vorlage |
| `template.set` | Vorlagen-Set-Konfiguration |

```yaml
# Template set with engine configuration
- name: templates
  kind: template.set
  engine:
    development_mode: false
    extensions:
      - ".jet"
      - ".html.jet"

# Individual template
- name: email_template
  kind: template.jet
  source: file://templates/email.jet
  set: app:templates
```

**Lua-API:** Siehe [Template-Modul](lua/text/template.md)

```lua
local templates = require("templates")
local set, err = templates.get("app:templates")

local html = set:render("email", {
    user = "Alice",
    message = "Welcome!"
})
```

## Sicherheit

| Art | Beschreibung |
|------|--------------|
| `security.policy` | Sicherheitsrichtlinie mit Bedingungen |
| `security.policy.expr` | Expression-basierte Richtlinie |
| `security.token_store` | Token-Speicher |

```yaml
# Condition-based policy
- name: admin_policy
  kind: security.policy
  policy:
    actions: "*"
    resources: "*"
    effect: allow
    conditions:
      - field: "actor.meta.role"
        operator: eq
        value: "admin"

# Expression-based policy
- name: owner_policy
  kind: security.policy.expr
  policy:
    actions: "*"
    resources: "*"
    effect: allow
    expression: 'actor.id == meta.owner_id || actor.meta.role == "admin"'
  groups:
    - operators
```

Policy-Gruppen werden von den Policies selbst gebildet: Eine Policy führt unter `groups:` die Gruppen-IDs auf, zu denen sie gehört, und eine Gruppe ist die Menge der Policies, die sie nennen. Es gibt keinen eigenen Gruppen-Entry-Typ. Gruppen-IDs sind Registry-IDs — ein bloßer Name wird im Namespace der deklarierenden Policy aufgelöst, aus `operators` oben wird also `app.security:operators`, wenn es im Namespace `app.security` deklariert wird. Einträge referenzieren Gruppen über ihren vollständigen `namespace:name`.

**Lua-API:** Siehe [Sicherheitsmodul](lua/security/security.md)

```lua
local security = require("security")

-- Check permission before action
if security.can("delete", "users", {user_id = id}) then
    delete_user(id)
end

-- Get current actor
local actor = security.actor()
```

<warning>
Jede Richtlinie im Geltungsbereich wird ausgewertet. Ein <code>deny</code> aus einer beliebigen passenden Richtlinie gewinnt gegen jedes <code>allow</code>; ohne ein deny gewährt ein passendes <code>allow</code> den Zugriff. Die Reihenfolge spielt keine Rolle.
</warning>

## Contracts (Dependency Injection)

| Art | Beschreibung |
|------|--------------|
| `contract.definition` | Schnittstelle mit Methodenspezifikationen |
| `contract.binding` | Ordnet Contract-Methoden Funktionsimplementierungen zu |

```yaml
# Define the contract interface
- name: greeter
  kind: contract.definition
  methods:
    - name: greet
      description: Returns a greeting message
    - name: greet_with_name
      description: Returns a personalized greeting
      input_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}
      output_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}

# Implementation functions
- name: greeter_greet
  kind: function.lua
  source: file://greeter_greet.lua
  method: main

- name: greeter_greet_name
  kind: function.lua
  source: file://greeter_greet_name.lua
  method: main

# Bind contract methods to implementations
- name: greeter_impl
  kind: contract.binding
  contracts:
    - contract: app:greeter
      default: true
      methods:
        greet: app:greeter_greet
        greet_with_name: app:greeter_greet_name
```

Verwendung aus Lua:

```lua
local contract = require("contract")

-- Open binding by ID
local greeter, err = contract.open("app:greeter_impl")

-- Call methods
local result = greeter:greet()
local personalized = greeter:greet_with_name("Alice")

-- Check if instance implements contract
local is_greeter = contract.is(greeter, "app:greeter")
```

**Lua-API:** Siehe [Contract-Modul](lua/core/contract.md)

<tip>
Markieren Sie ein Binding als <code>default: true</code> um es zu verwenden wenn ein Contract ohne Angabe einer Binding-ID geöffnet wird. Ein Contract darf nur ein Standard-Binding haben.
</tip>

## Ausführung

| Art | Beschreibung |
|------|--------------|
| `exec.native` | Native Befehlsausführung |
| `exec.docker` | Docker-Container-Ausführung |

```yaml
- name: native_exec
  kind: exec.native
  default_work_dir: "/app"
  command_whitelist:
    - "ls"
    - "cat"

- name: docker_exec
  kind: exec.docker
  image: "python:3.11-slim"
  default_work_dir: "/workspace"
  auto_remove: true
  memory_limit: 536870912  # 512MB
  command_whitelist:
    - "python"
```

## WASM-Laufzeit

| Art | Beschreibung |
|------|-------------|
| `function.wat` | WebAssembly-Funktion (WAT-Textformat) |
| `function.wasm` | WebAssembly-Funktion (binär) |
| `process.wasm` | WebAssembly-Prozess |

```yaml
# WAT-Text ist Inline-Quellcode
- name: sum_wat
  kind: function.wat
  source: file://sum.wat
  method: sum
  transport: payload   # oder wasi-http

# Binäres WASM wird aus einem Dateisystem-Eintrag geladen und per Hash verifiziert
- name: sum
  kind: function.wasm
  fs: app:modules
  path: sum.wasm
  hash: sha256:2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae
  method: sum
  transport: payload
```

`function.wasm` und `process.wasm` nehmen `fs`, `path` und `hash` — es gibt kein `source`-Feld auf einem Binäreintrag; `source` gehört ausschließlich zu `function.wat`. `hash` ist erforderlich und muss die Form `sha256:<hex>` haben; das Modul wird abgelehnt, wenn die Bytes nicht übereinstimmen.

Siehe [WASM-Übersicht](wasm/overview.md).

## Netzwerke

| Art | Beschreibung |
|------|-------------|
| `network` | Basis-Netzwerk-Overlay |
| `network.socks5` | SOCKS5-Proxy-Overlay |
| `network.i2p` | I2P-Netzwerk-Overlay |
| `network.tailscale` | Tailscale-Overlay |

Wird von `http.service` über `network:`, von `funcs`/`process` über die Option `network` und von `http_client` über die Option `overlay_network` referenziert. Siehe [Netzwerk](system/network.md).

## Registry-Primitive

| Art | Beschreibung |
|------|-------------|
| `registry.entry` | Reiner Dateneintrag ohne dahinterliegenden Dienst (anwendungsspezifische Konfiguration) |
| `ns.definition` | Namespace-Definition |
| `ns.requirement` | Namespace-Anforderungsdeklaration |
| `ns.dependency` | Namespace-Abhängigkeit |

Die `ns.*`-Arten werden wie jeder andere Eintrag verfasst: Eine Komponente deklariert `ns.definition` und `ns.requirement`, ein Host deklariert `ns.dependency`. Siehe [Komponenten bauen](guides/components.md).

## Lebenszyklus-Konfiguration

Vom Supervisor verwaltete Service-Einträge stellen Lebenszykluskonfiguration bereit. Der folgende Block gehört in einen Service-Eintrag, der sie unterstützt:

```yaml
lifecycle:
  auto_start: true          # Start automatically
  start_timeout: 10s        # Max startup time
  stop_timeout: 10s         # Max shutdown time
  stable_threshold: 5s      # Uninterrupted run time before retry accounting resets
  requires:
    - app:database
  restart:                  # Retry policy
    initial_delay: 1s
    max_delay: 90s
    backoff_factor: 2.0
    max_attempts: 0         # 0 = infinite
```

<note>
Verwenden Sie <code>depends_on</code> um sicherzustellen, dass Einträge in der richtigen Reihenfolge starten. Der Supervisor startet einen abhängigen Eintrag erst, nachdem jede seiner Abhängigkeiten ihren eigenen Start abgeschlossen hat.
</note>

## Eintragsreferenz-Format

Einträge werden im `namespace:name`-Format referenziert:

```yaml
# Definition
namespace: app.users
entries:
  - name: handler
    kind: function.lua

# Reference from another entry
func: app.users:handler
```

## Einträge überschreiben {id=overriding-entries}

Jedes Feld eines Eintrags — einschließlich seines `kind` — kann beim Start überschrieben werden, ohne die Quell-YAML zu bearbeiten, über den Konfigurationsabschnitt `override:` oder das CLI-Flag `-o`. Schlüssel verwenden das Format `namespace:entry:path`:

```yaml
override:
  app:gateway:addr: ":9090"        # data field (a bare path targets data.*)
  app:worker:meta.priority: high    # meta field
  app:db:kind: db.sql.postgres      # the entry's typed kind
  app:db:data.kind: custom          # a payload field literally named "kind"
```

| Pfad | Ziel |
|------|------|
| `kind` | Das typisierte kind des Eintrags (muss ein nicht-leerer string sein) |
| `data.<field>` oder nacktes `<field>` | Ein Feld im Daten-Payload des Eintrags |
| `meta.<field>` | Ein Feld in den Metadaten des Eintrags |

Dieselben Overrides gelten über die CLI:

```bash
wippy run -o app:db:kind=db.sql.postgres -o app:gateway:addr=:9090
```

CLI-Werte (`-o`) werden anhand ihrer Form gecastet (`true`/`false` zu bool, Zahlen zu Zahlen, sonst string); Werte im Abschnitt `override:` behalten ihren YAML-Typ. Um globale [Konfigurations](guides/configuration.md)-Abschnitte statt Einträgen zu überschreiben, verwenden Sie `--set`.
