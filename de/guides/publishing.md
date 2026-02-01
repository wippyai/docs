# Module veröffentlichen

Wiederverwendbaren Code auf dem Wippy Hub teilen.

## Voraussetzungen

1. Konto auf [hub.wippy.ai](https://hub.wippy.ai) erstellen
2. Organisation erstellen oder einer beitreten
3. Modulnamen unter Ihrer Organisation registrieren

## Modulstruktur

```
mymodule/
├── wippy.yaml      # Modul-Manifest
├── src/
│   ├── _index.yaml # Entry-Definitionen
│   └── *.lua       # Quelldateien
└── README.md       # Dokumentation (optional)
```

## wippy.yaml

Modul-Manifest:

```yaml
organization: acme
module: http-utils
description: HTTP-Utilities und Helfer
license: MIT
repository: https://github.com/acme/http-utils
homepage: https://acme.dev
keywords:
  - http
  - utilities
```

| Feld | Erforderlich | Beschreibung |
|------|--------------|--------------|
| `organization` | Ja | Ihr Organisationsname auf dem Hub |
| `module` | Ja | Modulname |
| `description` | Ja | Kurze Beschreibung |
| `license` | Nein | SPDX-Bezeichner (MIT, Apache-2.0) |
| `repository` | Nein | Quell-Repository-URL |
| `homepage` | Nein | Projekt-Homepage |
| `keywords` | Nein | Such-Schlüsselwörter |

## Entry-Definitionen

Einträge werden in `_index.yaml` definiert:

```yaml
version: "1.0"
namespace: acme.http

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: HTTP-Utilities
      description: Helfer für HTTP-Operationen

  - name: client
    kind: library.lua
    source: file://client.lua
    modules:
      - http_client
      - json
```

## Abhängigkeiten

Abhängigkeiten von anderen Modulen deklarieren:

```yaml
entries:
  - name: __dependency.wippy.test
    kind: ns.dependency
    meta:
      description: Test-Framework
    component: wippy/test
    version: ">=0.3.0"
```

Versionsbeschränkungen:

| Beschränkung | Bedeutung |
|--------------|-----------|
| `*` | Jede Version |
| `1.0.0` | Exakte Version |
| `>=1.0.0` | Mindestversion |
| `^1.0.0` | Kompatibel (gleiche Major-Version) |

## Anforderungen

Konfiguration definieren, die Konsumenten bereitstellen müssen:

```yaml
entries:
  - name: api_endpoint
    kind: ns.requirement
    meta:
      description: API-Endpunkt-URL
    targets:
      - entry: acme.http:client
        path: ".meta.endpoint"
    default: "https://api.example.com"
```

Targets spezifizieren, wo der Wert injiziert wird:
- `entry` - Vollständige Entry-ID zum Konfigurieren
- `path` - JSONPath für Wert-Injektion

Konsumenten konfigurieren über Override:

```bash
wippy run -o acme.http:api_endpoint=https://custom.api.com
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
      description: GET-Anfrage ausführen
    - name: post
      description: POST-Anfrage ausführen

- name: http_contract_binding
  kind: contract.binding
  contracts:
    - contract: acme.http:http_contract
      methods:
        get: acme.http:get_handler
        post: acme.http:post_handler
```

## Veröffentlichungs-Workflow

### 1. Authentifizieren

```bash
wippy auth login
```

### 2. Vorbereiten

```bash
wippy init
wippy update
wippy lint
```

### 3. Validieren

```bash
wippy publish --dry-run
```

### 4. Veröffentlichen

```bash
wippy publish --version 1.0.0
```

Mit Release-Notizen:

```bash
wippy publish --version 1.0.0 --release-notes "Erste Veröffentlichung"
```

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
wippy run -o acme.http:api_endpoint=https://my.api.com
```

Oder in `.wippy.yaml`:

```yaml
override:
  acme.http:api_endpoint: "https://my.api.com"
```

### In Ihrem Code importieren

```yaml
# Ihr src/_index.yaml
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
description: In-Memory-Caching mit TTL
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
      title: Cache-Modul

  - name: max_size
    kind: ns.requirement
    meta:
      description: Maximale Cache-Einträge
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
