# Lua Entry-Arten

Konfiguration für Lua-basierte Entries: Funktionen, Prozesse, Workflows und Bibliotheken.

## Entry-Arten

| Art | Beschreibung |
|------|-------------|
| `function.lua` | Zustandslose Funktion, läuft bei Bedarf |
| `process.lua` | Lang laufender Aktor mit Zustand |
| `workflow.lua` | Dauerhafter Workflow (Temporal) |
| `library.lua` | Gemeinsam genutzter Code, der von anderen Entries importiert wird |

## Gemeinsame Felder

Alle Lua-Entries teilen diese Felder:

| Feld | Erforderlich | Beschreibung |
|-------|----------|-------------|
| `name` | ja | Eindeutiger Name innerhalb des Namespace |
| `kind` | ja | Eine der oben genannten Lua-Arten |
| `source` | ja | Lua-Dateipfad (`file://path.lua`) |
| `method` | ja | Zu exportierende Funktion |
| `modules` | nein | Erlaubte Module für `require()` |
| `imports` | nein | Andere Entries als lokale Module |
| `meta` | nein | Durchsuchbare Metadaten |

## function.lua

Zustandslose Funktion, die bei Bedarf aufgerufen wird. Jeder Aufruf ist unabhängig.

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
```

Verwendung für: HTTP-Handler, Datentransformationen, Hilfsfunktionen.

## process.lua

Lang laufender Aktor, der Zustand über Nachrichten hinweg beibehält. Kommuniziert über Nachrichtenübergabe.

```yaml
- name: worker
  kind: process.lua
  source: file://worker.lua
  method: main
  modules:
    - process
    - channel
    - sql
```

Verwendung für: Hintergrund-Worker, Service-Daemons, zustandsbehaftete Aktoren.

Um als überwachter Service zu laufen:

```yaml
- name: worker_service
  kind: process.service
  process: app:worker
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

## workflow.lua

Dauerhafter Workflow, der Neustarts überlebt. Zustand wird in Temporal gespeichert.

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - workflow
    - time
```

Verwendung für: Mehrstufige Geschäftsprozesse, lang laufende Orchestrierungen.

## library.lua

Gemeinsam genutzter Code, der von anderen Entries importiert werden kann.

```yaml
- name: helpers
  kind: library.lua
  source: file://helpers.lua
  method: main
  modules:
    - json
    - base64
```

Andere Entries referenzieren sie über `imports`:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  imports:
    helpers: app.lib:helpers
```

Im Lua-Code:

```lua
local helpers = require("helpers")
helpers.format_date(timestamp)
```

## Module

Das `modules`-Feld steuert, welche Module mit `require()` geladen werden können:

```yaml
modules:
  - http
  - json
  - sql
  - process
  - channel
```

Nur aufgelistete Module sind verfügbar. Dies bietet:
- Sicherheit: Verhindert Zugriff auf Systemmodule
- Explizite Abhängigkeiten: Klar, was der Code benötigt
- Determinismus: Workflows erhalten nur deterministische Module

Siehe [Lua-Laufzeitumgebung](lua/overview.md) für verfügbare Module.

## Imports

Importieren Sie andere Entries als lokale Module:

```yaml
imports:
  utils: app.lib:utils       # require("utils")
  auth: app.auth:helpers     # require("auth")
```

Der Schlüssel wird zum Modulnamen im Lua-Code. Der Wert ist die Entry-ID (`namespace:name`).

## Pool-Konfiguration

Konfigurieren Sie den Ausführungspool für Funktionen:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  pool:
    type: inline    # Im Kontext des Aufrufers ausführen
```

Pool-Typen:
- `inline` - Im Kontext des Aufrufers ausführen (Standard für HTTP-Handler)

## Metadaten

Verwenden Sie `meta` für Routing und Discovery:

```yaml
- name: api_handler
  kind: function.lua
  meta:
    type: handler
    version: "2.0"
    tags: [api, users]
  source: file://api.lua
  method: handle
  modules:
    - http
    - json
```

Metadaten sind über die Registry durchsuchbar:

```lua
local registry = require("registry")
local handlers = registry.find({type = "handler"})
```

## Siehe auch

- [Entry-Arten](guides/entry-kinds.md) - Referenz aller Entry-Arten
- [Compute Units](concepts/compute-units.md) - Funktionen vs. Prozesse vs. Workflows
- [Lua-Laufzeitumgebung](lua/overview.md) - Verfügbare Module
