---
title: "Module veröffentlichen"
---

# Module veröffentlichen

Teile wiederverwendbaren Code im Wippy Hub.

## Voraussetzungen

1. Erstelle ein Konto auf [hub.wippy.ai](https://hub.wippy.ai)
2. Erstelle eine Organisation oder tritt einer bei
3. Registriere deinen Modulnamen unter deiner Organisation

## Modulstruktur

```
mymodule/
├── wippy.yaml      # Modul-Manifest
├── src/
│   ├── _index.yaml # Eintragsdefinitionen
│   └── *.lua       # Quelldateien
└── README.md       # Dokumentation (optional)
```

## wippy.yaml

Modul-Manifest:

```yaml
organization: acme
module: http-utils
description: HTTP utilities and helpers
license: MIT
repository: https://github.com/acme/http-utils
homepage: https://acme.dev
keywords:
  - http
  - utilities
```

| Feld | Erforderlich | Beschreibung |
|-------|----------|-------------|
| `organization` | Ja | Name deiner Organisation im Hub |
| `module` | Ja | Modulname |
| `description` | Nein | Kurzbeschreibung |
| `license` | Nein | SPDX-Bezeichner (MIT, Apache-2.0) |
| `repository` | Nein | URL des Quell-Repositories |
| `homepage` | Nein | Projekt-Homepage |
| `keywords` | Nein | Suchschlüsselwörter |

## Eintragsdefinitionen

Einträge werden in `_index.yaml` definiert:

```yaml
version: "1.0"
namespace: acme.http

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: HTTP Utilities
      description: Helpers for HTTP operations

  - name: client
    kind: library.lua
    source: file://client.lua
    modules:
      - http_client
      - json
```

## Abhängigkeiten

Deklariere Abhängigkeiten zu anderen Modulen:

```yaml
entries:
  - name: __dependency.wippy.test
    kind: ns.dependency
    meta:
      description: Testing framework
    component: wippy/test
    version: ">=0.3.0"
```

Versions-Constraints:

| Constraint | Bedeutung |
|------------|---------|
| `*` | Beliebige Version |
| `1.0.0` | Exakte Version |
| `>=1.0.0` | Mindestversion |
| `^1.0.0` | Kompatibel (gleiche Major-Version) |

## Anforderungen

Definiere Konfigurationen, die Konsumenten bereitstellen müssen:

```yaml
entries:
  - name: api_endpoint
    kind: ns.requirement
    meta:
      description: API endpoint URL
    targets:
      - entry: acme.http:client
        path: ".meta.endpoint"
    default: "https://api.example.com"
```

Targets geben an, wo der Wert eingefügt wird:
- `entry` - Vollständige Eintrags-ID, die konfiguriert werden soll
- `path` - JSONPath für die Werteinfügung

Konsumenten konfigurieren über Override. Das `-o`-Flag erwartet ein Tripel `namespace:entry:field=value`:

```bash
wippy run -o acme.http:client:meta.endpoint=https://custom.api.com
```

## Imports

Andere Einträge referenzieren:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  modules:
    - json
  imports:
    client: acme.http:client           # Gleicher Namespace
    utils: acme.utils:helpers          # Anderer Namespace
    base_registry: :registry           # Eingebaut
```

In Lua:

```lua
local client = require("client")
local utils = require("utils")
```

## Contracts

Öffentliche Schnittstellen definieren:

```yaml
- name: http_contract
  kind: contract.definition
  meta:
    name: HTTP Client Contract
  methods:
    - name: get
      description: Perform GET request
    - name: post
      description: Perform POST request

- name: http_contract_binding
  kind: contract.binding
  contracts:
    - contract: acme.http:http_contract
      methods:
        get: acme.http:get_handler
        post: acme.http:post_handler
```

## Veröffentlichungs-Workflow

### 1. Authentifizierung

```bash
wippy auth login
```

### 2. Vorbereitung

```bash
wippy init
wippy update
wippy lint
```

### 3. Validierung

```bash
wippy publish --dry-run
```

### 4. Veröffentlichung

```bash
wippy publish --version 1.0.0
```

Mit Release Notes:

```bash
wippy publish --version 1.0.0 --release-notes "Initial release"
```

### Zusätzliche Flags

| Flag | Beschreibung |
|------|-------------|
| `--label <name>` | Als veränderliches Label veröffentlichen (z. B. `latest`, `beta`) anstelle einer unveränderlichen Version |
| `--protected` | Veröffentlichte Version als geschützt markieren (kann nicht gelöscht oder überschrieben werden) |
| `--registry <url>` | Registry-URL für diese Veröffentlichung überschreiben |
| `--config <dir>` | Verzeichnis mit `wippy.yaml` (Standard: aktuelles Verzeichnis) |
| `--create` | Das Modul auf dem Hub registrieren, falls es noch nicht existiert, und dann veröffentlichen |
| `--module-visibility <v>` | Sichtbarkeit für `--create`: `private` (Standard) oder `public` |
| `--module-type <t>` | Typ für `--create`: `application` (Standard), `library`, `agent` oder `plugin` |
| `--module-display-name <n>` | Anzeigename für `--create` |

### Statische Dateien einbetten

Module mit `fs.directory`-Einträgen (statische Assets, Templates, öffentliche Dateien) müssen `--embed` verwenden, um sie in das veröffentlichte Paket aufzunehmen. Ohne dieses Flag werden `fs.directory`-Einträge ausgeschlossen.

```bash
wippy publish --version 1.0.0 --embed app:public_files
wippy publish --version 1.0.0 --embed app:assets,app:templates
```

Das `--embed`-Flag akzeptiert Eintrags-IDs oder Namen, die mit `fs.directory`-Einträgen übereinstimmen. Dasselbe Flag ist auch für `wippy pack` verfügbar.

### Erste Veröffentlichung

Wenn Sie ein Modul zum ersten Mal veröffentlichen, wird es automatisch auf dem Hub registriert (standardmäßig privat) und die Veröffentlichung einmal wiederholt. Geben Sie `--create` an, um es vorab zu registrieren und seine Eigenschaften zu setzen:

```bash
wippy publish --create --version 0.1.0 \
  --module-visibility public \
  --module-type library \
  --module-display-name "HTTP Utils"
```

`--create` ist idempotent — für ein bereits registriertes Modul ist der Erstellungsschritt ein No-op. Wenn Ihr Konto keine Module in der Organisation erstellen kann, gibt der Hub einen Berechtigungsfehler zurück, statt zu veröffentlichen.

### Veröffentlichen auf einem lokalen Hub

Richten Sie `--registry` auf einen lokal laufenden Hub, um ohne die öffentliche Registry zu veröffentlichen und zu installieren. Reines HTTP ist nur für lokale Hosts erlaubt — `localhost`, `127.0.0.1` und die Container-Aliase `host.docker.internal` (Docker Desktop / OrbStack) sowie `host.containers.internal` (Podman); jeder andere Host muss HTTPS verwenden.

```bash
wippy auth login --registry http://localhost:8080 --token wpy_xxx
wippy publish --registry http://localhost:8080 --create --version 0.1.0
```

Registry und Token können auch aus den Umgebungsvariablen `WIPPY_REGISTRY` und `WIPPY_TOKEN` stammen. Wenn nicht gesetzt, ist die Standard-Registry `https://hub.wippy.ai`.

### Kontingente

Wenn das Kontingent der Organisation für private Module erschöpft ist, schlägt die Veröffentlichung mit einer Meldung wie `cannot publish: Private-module quota exhausted (5 of 5)...` fehl. Machen Sie das Modul öffentlich oder bitten Sie einen Org-Admin, das Kontingent zu erhöhen. Uploads und Downloads werden bei vorübergehenden Netzwerkfehlern automatisch wiederholt.

## Veröffentlichte Module verwenden

### Abhängigkeit hinzufügen

```bash
wippy add acme/http-utils
wippy add acme/http-utils@1.0.0
wippy install
```

### Anforderungen konfigurieren

Werte zur Laufzeit überschreiben:

```bash
wippy run -o acme.http:client:meta.endpoint=https://my.api.com
```

Oder in `.wippy.yaml`:

```yaml
override:
  acme.http:client:meta.endpoint: "https://my.api.com"
```

### Im eigenen Code importieren

```yaml
# your src/_index.yaml
entries:
  - name: __dependency.acme.http
    kind: ns.dependency
    component: acme/http-utils
    version: ">=1.0.0"

  - name: my_handler
    kind: function.lua
    source: file://handler.lua
    imports:
      http: acme.http:client
```

## Vollständiges Beispiel

**wippy.yaml:**
```yaml
organization: acme
module: cache
description: In-memory caching with TTL
license: MIT
keywords:
  - cache
  - memory
```

**src/_index.yaml:**
```yaml
version: "1.0"
namespace: acme.cache

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: Cache Module

  - name: max_size
    kind: ns.requirement
    meta:
      description: Maximum cache entries
    targets:
      - entry: acme.cache:cache
        path: ".meta.max_size"
    default: "1000"

  - name: cache
    kind: library.lua
    meta:
      max_size: 1000
    source: file://cache.lua
    modules:
      - time
```

**src/cache.lua:**
```lua
local time = require("time")

local cache = {}
local store = {}
local max_size = 1000

function cache.set(key, value, ttl)
    if #store >= max_size then
        cache.evict_oldest()
    end
    store[key] = {
        value = value,
        expires = ttl and (time.now():unix() + ttl) or nil
    }
end

function cache.get(key)
    local entry = store[key]
    if not entry then return nil end
    if entry.expires and time.now():unix() > entry.expires then
        store[key] = nil
        return nil
    end
    return entry.value
end

return cache
```

Veröffentlichen:

```bash
wippy init && wippy update && wippy lint
wippy publish --version 1.0.0
```

## Siehe auch

- [CLI-Referenz](guides/cli.md)
- [Entry-Typen](guides/entry-kinds.md)
- [Konfiguration](guides/configuration.md)
