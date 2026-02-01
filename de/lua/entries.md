# Lua Entry-Arten

Konfiguration fur Lua-basierte Entries: Funktionen, Prozesse, Workflows und Bibliotheken.

## Entry-Arten

| Art | Beschreibung |
|------|-------------|
| `function.lua` | Zustandslose Funktion, lauft bei Bedarf |
| `process.lua` | Lang laufender Actor mit Zustand |
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
| `modules` | nein | Erlaubte Module fur `require()` |
| `imports` | nein | Andere Entries als lokale Module |
| `meta` | nein | Durchsuchbare Metadaten |

## function.lua

Zustandslose Funktion, die bei Bedarf aufgerufen wird. Jeder Aufruf ist unabhangig.

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
```

Verwendung fur: HTTP-Handler, Datentransformationen, Hilfsfunktionen.

## process.lua

Lang laufender Actor, der Zustand uber Nachrichten hinweg beibehalt. Kommuniziert uber Nachrichtenubergabe.

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

Verwendung fur: Hintergrund-Worker, Service-Daemons, zustandsbehaftete Actors.

Um als uberwachter Service zu laufen:

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

Dauerhafter Workflow, der Neustarts uberlebt. Zustand wird in Temporal persistiert.

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - workflow
    - time
```

Verwendung fur: Mehrstufige Geschaftsprozesse, lang laufende Orchestrierungen.

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

Andere Entries referenzieren sie uber `imports`:

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

Das `modules`-Feld steuert, welche Module mit `require()` geladen werden konnen:

```yaml
modules:
  - http
  - json
  - sql
  - process
  - channel
```

Nur aufgelistete Module sind verfugbar. Dies bietet:
- Sicherheit: Verhindert Zugriff auf Systemmodule
- Explizite Abhangigkeiten: Klar, was der Code benotigt
- Determinismus: Workflows erhalten nur deterministische Module

Siehe [Lua-Laufzeitumgebung](lua-overview.md) fur verfugbare Module.

## Imports

Importieren Sie andere Entries als lokale Module:

```yaml
imports:
  utils: app.lib:utils       # require("utils")
  auth: app.auth:helpers     # require("auth")
```

Der Schlussel wird zum Modulnamen im Lua-Code. Der Wert ist die Entry-ID (`namespace:name`).

## Pool-Konfiguration

Konfigurieren Sie den Ausfuhrungspool fur Funktionen:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  pool:
    type: inline    # Im Kontext des Aufrufers ausfuhren
```

Pool-Typen:
- `inline` - Im Kontext des Aufrufers ausfuhren (Standard fur HTTP-Handler)

## Metadaten

Verwenden Sie `meta` fur Routing und Discovery:

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

Metadaten sind uber die Registry durchsuchbar:

```lua
local registry = require("registry")
local handlers = registry.find({type = "handler"})
```

## Siehe auch

- [Entry-Arten](guide-entry-kinds.md) - Referenz aller Entry-Arten
- [Compute Units](concept-compute-units.md) - Funktionen vs. Prozesse vs. Workflows
- [Lua-Laufzeitumgebung](lua-overview.md) - Verfugbare Module
