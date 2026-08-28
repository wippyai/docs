---
title: "YAML & Projektstruktur"
description: "Projektlayout, YAML-Definitionsdateien und Namenskonventionen."
---

# YAML & Projektstruktur

## Verzeichnisstruktur

```
myapp/
├── .wippy.yaml          # Runtime configuration
├── wippy.lock           # Source directories config
├── .wippy/              # Installed modules
└── src/                 # Application source
    ├── _index.yaml      # Entry definitions
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

Eine Definitionsdatei enthält einen `namespace` und entweder ein `entries`-Array oder die Felder `name` und `kind` auf oberster Ebene. Der optionale Marker `version` ist üblicherweise `"1.0"`; der Loader von v0.3.32a verlangt ihn nicht.

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
| `version` | Nein | Manifest-Versionsmarker, üblicherweise `"1.0"` |
| `namespace` | Ja | Entry-Namespace für diese Datei |
| `entries` | Bedingt | Array von Entry-Definitionen; nur bei Verwendung von `name` und `kind` auf oberster Ebene weglassen |

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

### Quellverzeichnisse

Die Datei `wippy.lock` benennt den Quellstamm der Anwendung und das Basisverzeichnis zur Auflösung gesperrter Module:

```yaml
directories:
  modules: .wippy
  src: ./src
```

Wippy fügt `directories.src` als Ladepfad der Anwendung hinzu. `directories.modules` wird nicht als ein einziger Quellbaum gescannt: Jedes gesperrte Modul wird in sein versioniertes `.wapp`-Archiv oder seinen entpackten Modulpfad aufgelöst, jeder Ersatz in seinen konfigurierten Entry-Stamm. Der Loader scannt die Anwendungsquelle und ausgewählte verzeichnisbasierte Modul- oder Ersatzwurzeln rekursiv nach `.yaml`-, `.yml`- und `.json`-Manifesten; `.wapp`-Module werden als Archive gelesen. Nur objektförmige Dateien mit `namespace` gelten als Registry-Manifeste, `node_modules`-Verzeichnisse werden übersprungen. `_index.yaml` ist eine Projektkonvention, nicht der einzige zulässige Dateiname.

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

Die Entry-Kinds beschreibt der [Leitfaden zu Entry-Kinds](../guides/entry-kinds.md).

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

Die Runtime-Konfigurationsfelder beschreibt der [Konfigurationsleitfaden](../guides/configuration.md).

### wippy.lock

Definiert Quellverzeichnisse:

```yaml
directories:
  modules: .wippy
  src: ./src
```

## Einträge referenzieren

Referenzieren Sie Einträge nach vollständiger ID oder — sofern der Entry-Kind dies unterstützt — relativem Namen. HTTP-Router und -Endpoints hängen sich über `meta.server` und `meta.router` an, nicht über kindseitige Listen ihrer Kinder:

```yaml
# Router declares itself against a server
- name: api
  kind: http.router
  meta:
    server: app:gateway
  prefix: /api

# Endpoint references router by registry ID (cross-namespace works the same way)
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

- [Anwendungsarchitektur](../concepts/architecture.md) — Anwendung in Slices und Schichten organisieren
- [Leitfaden zu Entry-Kinds](../guides/entry-kinds.md) — Verfügbare Entry-Kinds
- [Konfigurationsleitfaden](../guides/configuration.md) — Runtime-Optionen konfigurieren
- [Benutzerdefinierte Entry-Kinds](../internals/kinds.md) — Handler implementieren (fortgeschritten)
