# Entry-Typen-Referenz

Vollständige Referenz aller in Wippy verfügbaren Entry-Typen.

> Einträge referenzieren sich gegenseitig im `namespace:name`-Format. Die Registry verbindet Abhängigkeiten automatisch basierend auf diesen Referenzen und stellt sicher, dass Ressourcen in der richtigen Reihenfolge initialisiert werden.

## Siehe auch

- [Registry](concept-registry.md) - Wie Einträge gespeichert und aufgelöst werden
- [Konfiguration](guide-configuration.md) - YAML-Konfigurationsformat

## Lua-Runtime

| Kind | Beschreibung |
|------|--------------|
| `function.lua` | Lua-Funktions-Entry-Point |
| `process.lua` | Langlebiger Lua-Prozess |
| `workflow.lua` | Temporal-Workflow (deterministisch) |
| `library.lua` | Gemeinsam genutzte Lua-Bibliothek |

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
  imports:
    utils: app.lib:helpers  # Anderen Eintrag als Modul importieren
```

<tip>
Verwenden Sie <code>imports</code> um andere Lua-Einträge zu referenzieren. Sie werden über <code>require("alias_name")</code> in Ihrem Code verfügbar.
</tip>

## HTTP-Dienste

| Kind | Beschreibung |
|------|--------------|
| `http.service` | HTTP-Server (bindet Port) |
| `http.router` | Routen-Präfix und Middleware |
| `http.endpoint` | HTTP-Endpunkt (Methode + Pfad) |
| `http.static` | Statische Datei-Bereitstellung |

```yaml
# HTTP-Server
- name: gateway
  kind: http.service
  addr: ":8080"
  lifecycle:
    auto_start: true

# Router mit Middleware
- name: api
  kind: http.router
  meta:
    server: gateway
  prefix: /api
  middleware:
    - cors
    - rate_limit

# Endpunkt
- name: users_list
  kind: http.endpoint
  meta:
    router: app:api
  method: GET
  path: /users
  func: list_handler
```

**Lua-API:** Siehe [HTTP-Modul](lua-http.md)

```lua
local http = require("http")
local req = http.request()
local resp = http.response()

resp:status(200):json({users = get_users()})
```

## Datenbanken

| Kind | Beschreibung |
|------|--------------|
| `db.sql.sqlite` | SQLite-Datenbank |
| `db.sql.postgres` | PostgreSQL-Datenbank |
| `db.sql.mysql` | MySQL-Datenbank |
| `db.sql.mssql` | Microsoft SQL Server |
| `db.sql.oracle` | Oracle-Datenbank |

### SQLite

```yaml
- name: database
  kind: db.sql.sqlite
  file: "./data/app.db"
  lifecycle:
    auto_start: true

# In-Memory für Tests
- name: testdb
  kind: db.sql.sqlite
  file: ":memory:"
```

### PostgreSQL

```yaml
- name: database
  kind: db.sql.postgres
  dsn: "postgres://user:pass@localhost:5432/dbname?sslmode=disable"
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
  dsn: "user:pass@tcp(localhost:3306)/dbname?parseTime=true"
  lifecycle:
    auto_start: true
```

### MSSQL

```yaml
- name: database
  kind: db.sql.mssql
  dsn: "sqlserver://user:pass@localhost:1433?database=dbname"
  lifecycle:
    auto_start: true
```

**Lua-API:** Siehe [SQL-Modul](lua-sql.md)

```lua
local sql = require("sql")
local db, err = sql.get("app:database")

local rows, err = db:query("SELECT * FROM users WHERE id = ?", user_id)
db:execute("INSERT INTO logs (msg) VALUES (?)", message)
```


## Key-Value-Stores

| Kind | Beschreibung |
|------|--------------|
| `store.memory` | In-Memory-Key-Value-Store |
| `store.sql` | SQL-basierter Key-Value-Store |

```yaml
# Memory-Store
- name: cache
  kind: store.memory
  lifecycle:
    auto_start: true

# SQL-basierter Store
- name: persistent_store
  kind: store.sql
  database: app:database
  table: kv_store
  lifecycle:
    auto_start: true
```

**Lua-API:** Siehe [Store-Modul](lua-store.md)

```lua
local store = require("store")
local s, err = store.get("app:cache")

s:set("user:123", user_data, 3600)  -- TTL in Sekunden
local data = s:get("user:123")
```

## Queues

| Kind | Beschreibung |
|------|--------------|
| `queue.driver.memory` | In-Memory-Queue-Treiber |
| `queue.queue` | Queue-Deklaration |
| `queue.consumer` | Queue-Konsument |

```yaml
# Treiber
- name: queue_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true

# Queue
- name: jobs
  kind: queue.queue
  driver: queue_driver

# Konsument
- name: job_consumer
  kind: queue.consumer
  queue: app:jobs
  func: job_handler
  concurrency: 4
  prefetch: 10
  lifecycle:
    auto_start: true
```

**Lua-API:** Siehe [Queue-Modul](lua-queue.md)

```lua
local queue = require("queue")

-- Nachricht veröffentlichen
queue.publish("app:jobs", {task = "process", id = 123})

-- Im Consumer-Handler auf aktuelle Nachricht zugreifen
local msg = queue.message()
local data = msg:body_json()
```

<note>
Die <code>func</code> des Consumers wird für jede Nachricht aufgerufen. Verwenden Sie <code>queue.message()</code> im Handler um auf die aktuelle Nachricht zuzugreifen.
</note>

## Prozessverwaltung

| Kind | Beschreibung |
|------|--------------|
| `process.host` | Prozessausführungs-Host |
| `process.service` | Überwachter Prozess (umhüllt process.lua) |
| `terminal.host` | Terminal/CLI-Host |

```yaml
# Process Host (wo Prozesse laufen)
- name: processes
  kind: process.host
  host:
    workers: 32             # Worker-Goroutinen (Standard: NumCPU)
    queue_size: 1024        # Globale Queue-Kapazität
    local_queue_size: 256   # Pro-Worker-Queue
  lifecycle:
    auto_start: true

# Prozessdefinition
- name: worker_process
  kind: process.lua
  source: file://worker.lua
  method: main

# Überwachter Prozessdienst
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

## Temporal (Workflows)

| Kind | Beschreibung |
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

| Kind | Beschreibung |
|------|--------------|
| `config.aws` | AWS-Konfiguration |
| `cloudstorage.s3` | S3-Bucket-Zugriff |

```yaml
- name: aws
  kind: config.aws
  region: "us-east-1"
  access_key_id_env: "AWS_ACCESS_KEY_ID"
  secret_access_key_env: "AWS_SECRET_ACCESS_KEY"

- name: uploads
  kind: cloudstorage.s3
  config: app:aws
  bucket: "my-uploads"
  endpoint: ""  # Optional, für S3-kompatible Dienste
```

**Lua-API:** Siehe [Cloud-Storage-Modul](lua-cloudstorage.md)

```lua
local cloudstorage = require("cloudstorage")
local storage, err = cloudstorage.get("app:uploads")

storage:upload_object("files/doc.pdf", file_content)
local url = storage:presigned_get_url("files/doc.pdf", {expires = "1h"})
```

<tip>
Verwenden Sie <code>endpoint</code> um sich mit S3-kompatiblen Diensten wie MinIO oder DigitalOcean Spaces zu verbinden.
</tip>

## Dateisysteme

| Kind | Beschreibung |
|------|--------------|
| `fs.directory` | Verzeichniszugriff |

```yaml
- name: data_dir
  kind: fs.directory
  directory: "./data"
  auto_init: true   # Erstellen wenn nicht vorhanden
  mode: "0755"      # Berechtigungen
```

**Lua-API:** Siehe [Dateisystem-Modul](lua-fs.md)

```lua
local fs = require("fs")
local filesystem, err = fs.get("app:data_dir")

local file = filesystem:open("output.txt", "w")
file:write("Hello, World!")
file:close()
```

## Umgebung

| Kind | Beschreibung |
|------|--------------|
| `env.storage.memory` | In-Memory-Umgebungsspeicher |
| `env.storage.file` | Dateibasierter Umgebungsspeicher |
| `env.storage.os` | Betriebssystem-Umgebung |
| `env.storage.router` | Umgebungs-Router (mehrere Speicher) |
| `env.variable` | Umgebungsvariable |

```yaml
- name: os_env
  kind: env.storage.os

- name: file_env
  kind: env.storage.file
  file_path: ".env"
  auto_create: true

- name: app_env
  kind: env.storage.router
  storages:
    - app:os_env
    - app:file_env
```

**Lua-API:** Siehe [Env-Modul](lua-env.md)

```lua
local env = require("env")

local api_key = env.get("API_KEY")
env.set("CACHE_TTL", "3600")
```

<note>
Der Router versucht Speicher der Reihe nach. Der erste Treffer gewinnt beim Lesen; Schreibvorgänge gehen an den ersten beschreibbaren Speicher.
</note>

## Vorlagen

| Kind | Beschreibung |
|------|--------------|
| `template.jet` | Einzelne Jet-Vorlage |
| `template.set` | Vorlagen-Set-Konfiguration |

```yaml
# Vorlagen-Set mit Engine-Konfiguration
- name: templates
  kind: template.set
  engine:
    development_mode: false
    extensions:
      - ".jet"
      - ".html.jet"

# Einzelne Vorlage
- name: email_template
  kind: template.jet
  source: file://templates/email.jet
  set: app:templates
```

**Lua-API:** Siehe [Template-Modul](lua-template.md)

```lua
local templates = require("templates")
local set, err = templates.get("app:templates")

local html = set:render("email", {
    user = "Alice",
    message = "Willkommen!"
})
```

## Sicherheit

| Kind | Beschreibung |
|------|--------------|
| `security.policy` | Sicherheitsrichtlinie mit Bedingungen |
| `security.policy.expr` | Expression-basierte Richtlinie |
| `security.token_store` | Token-Speicher |

```yaml
# Bedingungsbasierte Richtlinie
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

# Expression-basierte Richtlinie
- name: owner_policy
  kind: security.policy.expr
  policy:
    actions: "*"
    resources: "*"
    effect: allow
    expression: 'actor.id == meta.owner_id || actor.meta.role == "admin"'
```

**Lua-API:** Siehe [Sicherheitsmodul](lua-security.md)

```lua
local security = require("security")

-- Berechtigung vor Aktion prüfen
if security.can("delete", "users", {user_id = id}) then
    delete_user(id)
end

-- Aktuellen Actor abrufen
local actor = security.actor()
```

<warning>
Richtlinien werden der Reihe nach ausgewertet. Die erste passende Richtlinie bestimmt den Zugriff. Platzieren Sie spezifischere Richtlinien vor allgemeineren.
</warning>

## Contracts (Dependency Injection)

| Kind | Beschreibung |
|------|--------------|
| `contract.definition` | Schnittstelle mit Methodenspezifikationen |
| `contract.binding` | Ordnet Contract-Methoden Funktionsimplementierungen zu |

```yaml
# Contract-Schnittstelle definieren
- name: greeter
  kind: contract.definition
  methods:
    - name: greet
      description: Gibt eine Begrüßungsnachricht zurück
    - name: greet_with_name
      description: Gibt eine personalisierte Begrüßung zurück
      input_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}
      output_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}

# Implementierungsfunktionen
- name: greeter_greet
  kind: function.lua
  source: file://greeter_greet.lua
  method: main

- name: greeter_greet_name
  kind: function.lua
  source: file://greeter_greet_name.lua
  method: main

# Contract-Methoden an Implementierungen binden
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

-- Binding nach ID öffnen
local greeter, err = contract.open("app:greeter_impl")

-- Methoden aufrufen
local result = greeter:greet()
local personalized = greeter:greet_with_name("Alice")

-- Prüfen ob Instanz Contract implementiert
local is_greeter = contract.is(greeter, "app:greeter")
```

**Lua-API:** Siehe [Contract-Modul](lua-contract.md)

<tip>
Markieren Sie ein Binding als <code>default: true</code> um es zu verwenden wenn ein Contract ohne Angabe einer Binding-ID geöffnet wird (funktioniert nur wenn keine <code>context_required</code>-Felder gesetzt sind).
</tip>

## Ausführung

| Kind | Beschreibung |
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

## Lebenszyklus-Konfiguration

Die meisten Einträge unterstützen Lebenszyklus-Konfiguration:

```yaml
- name: service
  kind: some.kind
  lifecycle:
    auto_start: true          # Automatisch starten
    start_timeout: 10s        # Maximale Startzeit
    stop_timeout: 10s         # Maximale Shutdown-Zeit
    stable_threshold: 5s      # Zeit bis als stabil betrachtet
    depends_on:
      - app:database
    restart:                  # Retry-Richtlinie
      initial_delay: 1s
      max_delay: 90s
      backoff_factor: 2.0
      max_attempts: 0         # 0 = unendlich
```

<note>
Verwenden Sie <code>depends_on</code> um sicherzustellen, dass Einträge in der richtigen Reihenfolge starten. Der Supervisor wartet auf Abhängigkeiten bis sie stabil sind, bevor abhängige Einträge gestartet werden.
</note>

## Eintragsreferenz-Format

Einträge werden im `namespace:name`-Format referenziert:

```yaml
# Definition
namespace: app.users
entries:
  - name: handler
    kind: function.lua

# Referenz aus anderem Eintrag
func: app.users:handler
```
