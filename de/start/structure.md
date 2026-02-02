# YAML & Projektstruktur

Projektlayout, YAML-Definitionsdateien und Namenskonventionen.

## Verzeichnisstruktur

```
myapp/
├── .wippy.yaml          # Runtime-Konfiguration
├── wippy.lock           # Quellverzeichnis-Konfiguration
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
YAML-Definitionen werden beim Start in die Registry geladen. Die Registry ist die maßgebliche Datenquelle — YAML-Dateien sind eine Möglichkeit, sie zu befüllen. Einträge können auch aus anderen Quellen stammen oder programmatisch erstellt werden.
</note>

### Dateistruktur

Jede YAML-Datei mit `version` und `namespace` ist gültig:

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    meta:
      comment: Ruft Benutzer nach ID ab
    source: file://get_user.lua
    method: handler
    modules:
      - sql
      - json

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      comment: Benutzer-API-Endpunkt
    method: GET
    path: /users/{id}
    func: get_user
```

| Feld | Erforderlich | Beschreibung |
|------|--------------|--------------|
| `version` | ja | Schemaversion (aktuell `"1.0"`) |
| `namespace` | ja | Entry-Namespace für diese Datei |
| `entries` | ja | Array von Entry-Definitionen |

### Namenskonvention

Verwenden Sie Punkte (`.`) zur semantischen Trennung und Unterstriche (`_`) für Wörter:

```yaml
# Funktion und ihr Endpunkt
- name: get_user              # Die Funktion
- name: get_user.endpoint     # Ihr HTTP-Endpunkt

# Mehrere Endpunkte für dieselbe Funktion
- name: list_orders
- name: list_orders.endpoint.get
- name: list_orders.endpoint.post

# Router
- name: api.public            # Öffentlicher API-Router
- name: api.admin             # Admin-API-Router
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

Die `wippy.lock`-Datei definiert, woher Wippy Definitionen lädt:

```yaml
directories:
  modules: .wippy
  src: ./src
```

Wippy scannt diese Verzeichnisse rekursiv nach YAML-Dateien.

## Entry-Definitionen

Jeder Eintrag steht im `entries`-Array. Eigenschaften befinden sich auf oberster Ebene (kein `data:`-Wrapper):

```yaml
entries:
  - name: hello
    kind: function.lua
    meta:
      comment: Gibt Hello World zurück
    source: file://hello.lua
    method: handler
    modules:
      - http
      - json

  - name: hello.endpoint
    kind: http.endpoint
    meta:
      comment: Hello-Endpunkt
    method: GET
    path: /hello
    func: hello
```

### Metadaten

Verwenden Sie `meta` für benutzerfreundliche Informationen:

```yaml
- name: payment_handler
  kind: function.lua
  meta:
    title: Zahlungsprozessor
    comment: Verarbeitet Stripe-Zahlungen
  source: file://payment.lua
```

Konvention: `meta.title` und `meta.comment` werden in Verwaltungsoberflächen ansprechend dargestellt.

### Anwendungseinträge

Verwenden Sie `registry.entry`-Kind für Konfiguration auf Anwendungsebene:

```yaml
- name: config
  kind: registry.entry
  meta:
    title: Anwendungseinstellungen
    type: application
  environment: production
  features:
    dark_mode: true
    beta_access: false
```

## Häufige Entry-Typen

| Kind | Zweck |
|------|-------|
| `registry.entry` | Allgemeine Daten |
| `function.lua` | Aufrufbare Lua-Funktion |
| `process.lua` | Langlebiger Prozess |
| `http.service` | HTTP-Server |
| `http.router` | Routengruppe |
| `http.endpoint` | HTTP-Handler |
| `process.host` | Prozess-Supervisor |

Siehe [Entry-Typen-Anleitung](guides/entry-kinds.md) für vollständige Referenz.

## Konfigurationsdateien

### .wippy.yaml

Runtime-Konfiguration im Projektstamm:

```yaml
logger:
  level: info
  mode: production

host:
  worker_count: 16

http:
  address: :8080
```

Siehe [Konfigurationsanleitung](guides/configuration.md) für alle Optionen.

### wippy.lock

Definiert Quellverzeichnisse:

```yaml
directories:
  modules: .wippy
  src: ./src
```

## Einträge referenzieren

Referenzieren Sie Einträge nach vollständiger ID oder relativem Namen:

```yaml
# Vollständige ID (namespace-übergreifend)
- name: main.router
  kind: http.router
  endpoints:
    - app.api:get_user.endpoint
    - app.api:list_orders.endpoint

# Gleicher Namespace - nur Name verwenden
- name: get_user.endpoint
  kind: http.endpoint
  func: get_user
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

- [Entry-Typen-Anleitung](guides/entry-kinds.md) - Verfügbare Entry-Typen
- [Konfigurationsanleitung](guides/configuration.md) - Runtime-Optionen
- [Benutzerdefinierte Entry-Typen](internals/kinds.md) - Handler implementieren (fortgeschritten)
