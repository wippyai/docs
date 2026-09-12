---
title: "YAML & Projektstruktur"
description: "Projektlayout, YAML-Definitionsdateien und Namenskonventionen."
---

# YAML & Projektstruktur

## Verzeichnisstruktur

```
myapp/
├── .wippy.yaml          # Runtime-Konfiguration
├── wippy.lock           # Quellverzeichnisse und gesperrte Module
├── .wippy/              # Installierte Module
└── src/                 # Anwendungsquellcode
    ├── _index.yaml      # Entry-Definitionen
    ├── api/
    │   ├── _index.yaml
    │   └── *.lua
    └── workers/
        ├── _index.yaml
        └── *.lua
```

## YAML-Definitionsdateien

<note>
YAML-Definitionen werden beim Start in die Registry geladen. Die Registry ist die maßgebliche Datenquelle; YAML-Dateien sind eine Möglichkeit, sie zu befüllen. Einträge können auch aus anderen Quellen stammen oder programmatisch erstellt werden.
</note>

### Format einer Definitionsdatei

Jede YAML-Datei mit einem `namespace` plus entweder einem `entries`-Array oder einem `name`+`kind` auf oberster Ebene ist eine gültige Definitionsdatei. `version` ist optional:

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    meta:
      comment: Fetches user by ID
    source: file://get_user.lua
    method: handler
    modules:
      - sql
      - json

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      comment: User API endpoint
    method: GET
    path: /users/{id}
    func: get_user
```

| Feld | Erforderlich | Beschreibung |
|------|--------------|--------------|
| `version` | nein | Schemaversion (aktuell `"1.0"`) |
| `namespace` | ja | Entry-Namespace für diese Datei |
| `entries` | ja | Array von Entry-Definitionen |

### Namenskonvention

Verwenden Sie Punkte (`.`) zur semantischen Trennung und Unterstriche (`_`) für Wörter:

```yaml
# Function and its endpoint
- name: get_user              # The function
- name: get_user.endpoint     # Its HTTP endpoint

# Multiple endpoints for same function
- name: list_orders
- name: list_orders.endpoint.get
- name: list_orders.endpoint.post

# Routers
- name: api.public            # Public API router
- name: api.admin             # Admin API router
```

<tip>
Muster: <code>basis_name.variante</code> — Punkte trennen semantische Teile, Unterstriche trennen Wörter innerhalb eines Teils.
</tip>

### Namespaces

Namespaces sind durch Punkte getrennte Bezeichner:

```
app
app.api
app.api.v2
app.workers
```

Die vollständige Entry-ID kombiniert Namespace und Name: `app.api:get_user`

### Die Lock-Datei

`wippy.lock` hält fest, woher Wippy Definitionen lädt und welche Modulversionen ausgewählt sind:

```yaml
directories:
  modules: .wippy
  src: ./src
options:
  unpack_modules: false
modules:
  - name: acme/http
    version: v1.2.0
    hash: 4ea816fe84ca58a1f0869e5ca6afa93d6ddd72fa09e1162d9e600a7fbf39f0a2
```

| Feld | Beschreibung |
|------|--------------|
| `directories.src` | Quellverzeichnis der Anwendung, wird rekursiv nach YAML-Definitionsdateien durchsucht |
| `directories.modules` | Basisverzeichnis für eingebundene Module; Packs landen unter `<modules>/vendor/` |
| `options.unpack_modules` | Jede `.wapp` in ein Verzeichnis daneben entpacken, statt das Pack direkt zu laden (Standard `false`) |
| `modules[].name` | Modulkennung in der Form `org/module` |
| `modules[].version` | Ausgewählte Version |
| `modules[].hash` | Artefakt-Digest, dem das eingebundene Pack entsprechen muss |
| `modules[].root` | Markiert die ausgewählte Deployment-Wurzel; höchstens ein Modul darf sie tragen |

Eingebundene Packs werden als `.wapp`-Dateien aufbewahrt. Mit `unpack_modules: true` wird jedes Modul zusätzlich in ein Verzeichnis entpackt, und die verifizierte `.wapp` bleibt daneben liegen — die Installation sucht nach dem Pack, ein Verzeichnis ohne zugehöriges Pack wird also erneut heruntergeladen.

Ein `replacements:`-Abschnitt in `wippy.lock` ist veraltet. Er wird weiterhin geladen, mit einer Warnung; lokale Modul-Überschreibungen stattdessen unter `workspace.replacements` in einer Runtime-Konfigurationsdatei deklarieren. Siehe [Abhängigkeitsverwaltung](guides/dependency-management.md#local-development-with-replacements).

## Entry-Definitionen

Jedes Element des `entries`-Arrays definiert einen Eintrag. Kind-spezifische Felder können wie in diesem Beispiel neben `name`, `kind` und `meta` stehen:

```yaml
entries:
  - name: hello
    kind: function.lua
    meta:
      comment: Returns hello world
    source: file://hello.lua
    method: handler
    modules:
      - http
      - json

  - name: hello.endpoint
    kind: http.endpoint
    meta:
      comment: Hello endpoint
    method: GET
    path: /hello
    func: hello
```

Ein explizites `data:`-Feld wird ebenfalls unterstützt. Ist es vorhanden, bildet sein Wert den vollständigen Kind-spezifischen Payload; mischen Sie ihn daher nicht mit Kind-spezifischen Geschwisterfeldern:

```yaml
entries:
  - name: config
    kind: registry.entry
    data:
      environment: production
      features:
        dark_mode: true
```

### Metadaten

Verwenden Sie `meta` für benutzerfreundliche Informationen:

```yaml
- name: payment_handler
  kind: function.lua
  meta:
    title: Payment Processor
    comment: Handles Stripe payments
  source: file://payment.lua
```

Verwenden Sie `meta.title` und `meta.comment` für beschreibende Informationen, die Registry-Verbraucher und Verwaltungsoberflächen anzeigen können.

### Anwendungseinträge

Verwenden Sie `registry.entry`-Kind für Konfiguration auf Anwendungsebene:

```yaml
- name: config
  kind: registry.entry
  meta:
    title: Application Settings
    type: application
  environment: production
  features:
    dark_mode: true
    beta_access: false
```

## Häufige Entry-Typen

| Art | Zweck |
|------|-------|
| `registry.entry` | Allgemeine Daten, die ohne normalen Event-Versand gespeichert werden |
| `function.lua` | Aufrufbare Lua-Funktion |
| `process.lua` | Langlebiger Prozess |
| `http.service` | HTTP-Server |
| `http.router` | Routengruppe |
| `http.endpoint` | HTTP-Handler |
| `process.host` | Host für die Prozessausführung |

Die Entry-Kinds beschreibt der [Leitfaden zu Entry-Kinds](guides/entry-kinds.md).

## Konfigurationsdateien

### .wippy.yaml

Runtime-Konfiguration im Projektstamm:

```yaml
version: "1.0"

logger:
  encoding: json

logmanager:
  min_level: 0

supervisor:
  host:
    worker_count: 16
```

Die Runtime-Konfigurationsfelder beschreibt der [Konfigurationsleitfaden](guides/configuration.md).

### wippy.lock

Quellverzeichnisse und der ausgewählte Modulgraph — siehe [Die Lock-Datei](#the-lock-file) oben.

## Einträge referenzieren

Referenzieren Sie Einträge nach vollständiger ID oder relativem Namen. Kinder hängen sich über `meta` an ihren Parent, nicht über Listen auf Parent-Seite:

```yaml
# Router deklariert sich gegen einen Server
- name: api
  kind: http.router
  meta:
    server: app:gateway
  prefix: /api

# Endpunkt referenziert den Router per Registry-ID (namespace-übergreifend funktioniert es genauso)
- name: get_user.endpoint
  kind: http.endpoint
  meta:
    router: app.api:api
  method: GET
  path: /users/{id}
  func: app.api:get_user
```

## Beispielprojekt

```
myapp/
├── .wippy.yaml
├── wippy.lock
└── src/
    ├── _index.yaml           # namespace: app
    ├── api/
    │   ├── _index.yaml       # namespace: app.api
    │   ├── users.lua
    │   └── orders.lua
    ├── lib/
    │   ├── _index.yaml       # namespace: app.lib
    │   └── database.lua
    └── workers/
        ├── _index.yaml       # namespace: app.workers
        └── email_sender.lua
```

## Siehe auch

- [Anwendungsarchitektur](concepts/architecture.md) — Anwendung in Slices und Schichten organisieren
- [Leitfaden zu Entry-Kinds](guides/entry-kinds.md) — Verfügbare Entry-Kinds
- [Konfigurationsleitfaden](guides/configuration.md) — Runtime-Optionen konfigurieren
- [Benutzerdefinierte Entry-Kinds](internals/kinds.md) — Handler implementieren (fortgeschritten)
