---
title: "Lua-Entry-Kinds"
description: "Konfiguration Lua-basierter Einträge: Funktionen, Prozesse, Workflows und Bibliotheken."
---

# Lua-Entry-Kinds

Lua-Entry-Kinds bestimmen, wie Quellcode als Funktion, Prozess, Workflow oder Bibliothek geladen und ausgeführt wird.

Diese Seite ist eine Konfigurationsreferenz. Die YAML-Blöcke sind partielle Eintragsdefinitionen, die unter einer `entries:`-Map in einem Wippy-Index stehen; für sich allein sind sie keine vollständigen Anwendungen. Referenzierte Quelldateien, Imports, Abhängigkeiten, Process Hosts und Sicherheitsrichtlinien müssen im umgebenden Projekt vorhanden sein.

## Entry-Kinds

| Art | Beschreibung |
|------|-------------|
| `function.lua` | Zustandslose Funktion, wird bei Bedarf ausgeführt |
| `process.lua` | Lang laufender Aktor mit Zustand |
| `workflow.lua` | Dauerhafter Workflow (Temporal) |
| `library.lua` | Gemeinsam genutzter Code, den andere Einträge importieren |

Jeder Kind besitzt ein vorkompiliertes Bytecode-Gegenstück (`function.lua.bc`, `library.lua.bc`, `process.lua.bc`, `workflow.lua.bc`), das `wippy pack --bytecode '**'` oder ein Muster wie `--bytecode 'app:**'` erzeugt. Autoren schreiben `.lua`-Einträge; beim Packen mit diesem Flag werden die Bytecode-Kinds ausgegeben.

`module.lua` ist für integrierte Moduldefinitionen reserviert, die die Runtime erstellt. Es ist kein vom Autor definierbarer Quell-Eintrag und besitzt kein Bytecode-Gegenstück.

## Gemeinsame Felder

Alle Lua-Einträge verwenden diese Felder:

| Feld | Erforderlich | Beschreibung |
|-------|--------------|--------------|
| `name` | ja | Eindeutiger Name im Namespace |
| `kind` | ja | Einer der oben aufgeführten Lua-Kinds |
| `source` | ja | Inline-Lua-Quellcode oder eine beim Laden der Registry aufgelöste Referenz `file://path.lua` |
| `method` | function/process/workflow | Zu exportierende Funktion (Bibliotheken verwenden das Feld nicht) |
| `modules` | nein | Erlaubte Module für `require()` |
| `imports` | nein | Andere Einträge als lokale Module |
| `meta` | nein | Durchsuchbare Metadaten |

`pool` gilt nur für `function.lua`. `security` gilt für `function.lua` und `process.lua`.

## `function.lua`

Ein `function.lua`-Eintrag wird bei Bedarf ausgeführt; jeder Aufruf wird unabhängig behandelt.

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
```

Verwenden Sie Funktionen für HTTP-Handler, Datentransformationen und Hilfsfunktionen.

## `process.lua`

Ein `process.lua`-Eintrag ist ein lang laufender Aktor, der Zustand hält und über Nachrichten kommuniziert.

```yaml
- name: worker
  kind: process.lua
  source: file://worker.lua
  method: main
  modules:
    - sql
```

Wählen Sie einen Prozess für Hintergrund-Worker, Service-Daemons und zustandsbehaftete Aktoren.

So wird er als überwachter Service ausgeführt:

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

## `workflow.lua`

Ein `workflow.lua`-Eintrag definiert einen dauerhaften Workflow, dessen Zustand in Temporal persistiert wird.

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - workflow
    - time
```

Verwenden Sie Workflows für mehrstufige Geschäftsprozesse und lang laufende Orchestrierung.

## `library.lua`

Ein `library.lua`-Eintrag stellt gemeinsam genutzten Code bereit, den andere Einträge importieren können.

```yaml
- name: helpers
  kind: library.lua
  source: file://helpers.lua
  modules:
    - json
    - base64
```

Andere Einträge referenzieren ihn über `imports`:

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

Das Feld `modules` steuert, welche Module mit `require()` geladen werden können:

```yaml
modules:
  - http
  - json
  - sql
```

`channel`, `payload`, `print`, `process`, `subscribe` und `unsubscribe` werden als globale Lua-Werte geladen und müssen nicht unter `modules:` stehen. `require("process")` ist ebenfalls ohne `modules:`-Deklaration erlaubt.

Nur aufgeführte integrierte Module und unter `imports` deklarierte Aliasse sind verfügbar. Die Modul-Allowlist begrenzt den Zugriff auf Runtime-Capabilities, macht Abhängigkeiten explizit und beschränkt Workflows auf workflowkompatible Modulklassen.

Verfügbare Module behandelt [Lua-Runtime](lua/overview.md).

## Imports

Andere Einträge lassen sich als lokale Module importieren:

```yaml
imports:
  utils: app.lib:utils       # require("utils")
  auth: app.auth:helpers     # require("auth")
```

Der Schlüssel wird zum Modulnamen im Lua-Code. Der Wert ist die Eintrags-ID (`namespace:name`).

## Funktions-Pools

Mit `pool` konfigurieren Sie, wie ein Funktionseintrag ausgeführt wird:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  pool:
    type: adaptive    # explicit; omit to use auto-select (lazy)
    max_size: 16      # cap for elastic growth
```

| Feld | Pools | Beschreibung |
|------|-------|--------------|
| `type` | alle | Scheduler-Implementierung (siehe Tabelle unten) |
| `workers` | static | Worker-Anzahl; wenn gesetzt, muss bei der Konfigurationsvalidierung auch `size` positiv sein |
| `size` | static | Worker-Anzahl, wenn `workers` fehlt; bei fehlendem `type` wählt ein positiver `size`-Wert allein `inline` |
| `buffer` | static | Kapazität der Task-Queue (Standard: `workers * 64`) |
| `max_size` | lazy, adaptive | Obergrenze für elastisches Wachstum (Standard: 16 bei explizitem Typ) |
| `warm_start` | alle | Akzeptiertes Konfigurationsflag; in diesem Runtime-Release ohne Wirkung |

| Typ | Verhalten |
|-----|-----------|
| `inline` | Synchrone Ausführung in der Goroutine des Aufrufers. Keine Isolation zwischen Aufrufen. |
| `lazy` | Keine inaktiven Worker; werden bei Bedarf gestartet und im Leerlauf beendet. |
| `static` | Kanalbasierter Pool fester Größe. Vorhersagbar bei gleichmäßiger Last. |
| `adaptive` | Automatisch skalierender Pool: wächst unter Last und schrumpft im Leerlauf. |

Wenn `type` fehlt, wählt die Runtime:

- `static`, wenn `workers` positiv ist;
- `lazy`, wenn `workers` null ist und entweder `size` null oder `max_size` positiv ist; oder
- `inline`, wenn `size` positiv und `max_size` null ist.

Der automatisch gewählte Lazy-Pool verwendet einen positiven `max_size`-Wert und andernfalls den Standard 100. Ein expliziter `lazy`- oder `adaptive`-Pool verwendet standardmäßig `max_size: 16`. Ein expliziter `static`-Pool verwendet zuerst `workers`, dann `size` und schließlich 8; sein Standardpuffer entspricht der gewählten Worker-Anzahl multipliziert mit 64.

## Metadaten

Mit `meta` versehen Sie Einträge mit durchsuchbaren Feldern für Routing und Discovery:

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
    - registry
```

Metadaten lassen sich über die Registry durchsuchen:

```lua
local registry = require("registry")
local handlers, err = registry.find({["meta.type"] = "handler"})
if err then
    return nil, err
end
```

Die Abfrage gibt alle passenden Registry-Einträge zurück. Der Lua-Code gehört zu einem ausführbaren Eintrag, dessen `modules`-Liste `registry` enthält, etwa dem oben gezeigten `api_handler`-Eintrag.

## Siehe auch

- [Entry-Kinds](guides/entry-kinds.md) - Referenz aller Entry-Kinds
- [Compute Units](concepts/compute-units.md) - Funktionen, Prozesse und Workflows im Vergleich
- [Lua-Runtime](lua/overview.md) - Verfügbare Module
