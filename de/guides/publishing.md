---
title: "Module veröffentlichen"
description: "Bereiten Sie Module für den Wippy Hub vor, validieren, veröffentlichen, konfigurieren und verwenden Sie sie."
---

# Module veröffentlichen

Beim Veröffentlichen wird ein Modul gepackt und eine Version oder ein veränderliches Label über den Wippy Hub bereitgestellt.

Dies ist ein Veröffentlichungsworkflow mit Referenz. Die Module, URLs, Tokens, Zugangsdaten und Beispielquellen unter `acme/*` dienen nur als Beispiele; ersetzen Sie sie durch Ressourcen Ihrer Organisation.

## Voraussetzungen

1. Erstellen Sie ein Konto auf [hub.wippy.ai](https://hub.wippy.ai).
2. Erstellen Sie eine Organisation oder treten Sie einer bei.
3. Wählen Sie einen Modulnamen. Die erste Veröffentlichung kann einen fehlenden Namen registrieren, sofern Ihr Konto die Berechtigung besitzt; mit `--create` registrieren Sie ihn vor dem Upload und setzen seine Eigenschaften explizit.

## Modulstruktur

```
mymodule/
├── wippy.yaml      # Module manifest
├── src/
│   ├── _index.yaml # Entry definitions
│   └── *.lua       # Source files
└── README.md       # Documentation (optional)
```

## wippy.yaml

Modul-Manifest:

```yaml
organization: acme
module: http-utils
type: library
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
| `type` | Nein | Modultyp: `library`, `application`, `agent` oder `plugin` |
| `description` | Nein | Kurzbeschreibung |
| `license` | Nein | SPDX-Bezeichner (MIT, Apache-2.0) |
| `repository` | Nein | URL des Quell-Repositories |
| `homepage` | Nein | Projekt-Homepage |
| `keywords` | Nein | Suchschlüsselwörter |

`type` ist die maßgebliche Quelle dafür, wie der Hub das Modul klassifiziert, und kann bei einer späteren Veröffentlichung geändert werden; `--module-type` überschreibt es für eine einzelne Veröffentlichung. Wenn es fehlt, erhalten neu erstellte Module standardmäßig den Typ `application` mit einer Deprecation-Warnung.

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
    readme: file://README.md
    wiki:
      GUIDE.md: file://docs/GUIDE.md
      examples/auth.md: file://docs/auth.md

  - name: client
    kind: library.lua
    source: file://client.lua
    modules:
      - http_client
      - json
```

Die `wiki:`-Map auf `ns.definition` veröffentlicht zusätzliche Dokumentationsseiten neben dem Readme: Schlüssel sind Seitenpfade, Werte sind `file://`-Referenzen. Inhalte werden zur Pack-Zeit eingebettet und vom Hub als durchstöberbares Wiki je Modul bereitgestellt.

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

`default` akzeptiert jeden skalaren Typ — `default: 20` fließt als Zahl in ein numerisches Target, nicht als String. Dasselbe gilt für `parameters[].value` auf `ns.dependency`-Einträgen, und beide akzeptieren `${env:NAME}`-Referenzen, die wörtlich mitgeführt und beim Dekodieren des Ziel-Eintrags aufgelöst werden.

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
    client: acme.http:client           # Same namespace
    utils: acme.utils:helpers          # Different namespace
    base_registry: :registry           # Built-in
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
| `--module-type <t>` | Modultyp: `library`, `application`, `agent` oder `plugin` (überschreibt `type:` in wippy.yaml) |
| `--module-display-name <n>` | Anzeigename für `--create` |

### Statische Dateien einbetten

Wählen Sie einen einzubettenden `fs.directory`-Eintrag entweder mit `--embed` oder über die dauerhafte `embed:`-Liste im Projektmanifest aus. Ausgewählte Einträge werden in `fs.embed`-Ressourcen umgewandelt. Ein nicht ausgewählter `fs.directory`-Eintrag bleibt im Pack, seine referenzierten Verzeichnisinhalte werden jedoch nicht aufgenommen.

```yaml
# wippy.yaml
embed:
  - app:public_files
  - app:assets
```

```bash
wippy publish --version 1.0.0 --embed app:public_files
wippy publish --version 1.0.0 --embed app:assets,app:templates
```

Die Manifestliste und `--embed` akzeptieren Entry-IDs oder Namen passender `fs.directory`-Einträge. Dasselbe CLI-Flag steht für `wippy pack` zur Verfügung; eine CLI-Auswahl überschreibt bei diesem Aufruf die Manifestliste.

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

## Runtime-Defaults veröffentlichen {#publishing-runtime-defaults}

Anwendungen (nur `type: application`) können Runtime-Konfigurationsdefaults über `publish.runtime` in `wippy.yaml` in ihren Packs ausliefern:

```yaml
type: application
publish:
  runtime:
    source: .wippy.yaml            # default: .wippy.yaml
    sections: [security, registry, override]
    vars: [public_url]
```

| Feld | Beschreibung |
|------|--------------|
| `source` | Konfigurationsdatei, aus der die Abschnitte gelesen werden (Standard: `.wippy.yaml`) |
| `sections` | Runtime-Konfigurationsabschnitte, die als Defaults in die Pack-Metadaten kopiert werden |
| `vars` | Explizite Allowlist von Variablen, die auch unreferenziert gepackt werden |

Regeln:

- Nur Variablen, die von den ausgewählten Abschnitten oder veröffentlichten Profilen referenziert werden, werden gepackt (transitiv verfolgt); alles andere braucht einen `vars`-Eintrag.
- `${env:...}`-Referenzen in exportierter Konfiguration werden abgelehnt — die Umgebung des Veröffentlichenden gelangt nie in ein Pack.
- Die maschinenlokalen Abschnitte `boot`, `extensions` und `workspace` können nicht exportiert werden.
- Nur das Pack der Hauptanwendung liefert Host-Runtime-Defaults; Runtime-Metadaten in Abhängigkeits-Packs werden ignoriert.

Am Zielort wird die Konfiguration von niedrigster zu höchster Priorität angewendet: App-Pack-Defaults, eingebaute Runtime-Defaults, lokale Konfigurationsdateien, ausgewählte Profile, CLI-Überschreibungen.

## Profile veröffentlichen {#publishing-profiles}

Profile der Root-Anwendung werden in die `runtime.profiles`-Metadaten des Packs exportiert. Das Veröffentlichen wählt oder fixiert kein Profil — Konsumenten wählen eines zur Laufzeit mit `wippy run --profile <name>`:

```yaml
publish:
  profiles:
    enabled: true
    source: config/profiles.yaml   # default: .wippy.yaml
    include: [production]          # omit to publish all non-workspace profiles
```

`include: []` veröffentlicht keine Profile; ein unbekannter Name lässt die Veröffentlichung fehlschlagen. `workspace`-Unterabschnitte werden auch innerhalb eines veröffentlichten Profils nie exportiert. Siehe [Konfiguration](./configuration.md#profiles).

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

## Beispielmodul

**wippy.yaml:**
```yaml
organization: acme
module: cache
type: library
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

  - name: cache
    kind: library.lua
    source: file://cache.lua
    modules:
      - time
```

**src/cache.lua:**
```lua
local time = require("time")

local cache = {}
local store = {}

function cache.set(key, value, ttl)
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
wippy init
wippy update
wippy lint
wippy publish --version 1.0.0
```

## Siehe auch

- [CLI-Referenz](./cli.md) — Veröffentlichungsbefehle und Flags
- [Entry-Kinds](./entry-kinds.md) — Modul- und Dependency-Einträge
- [Konfiguration](./configuration.md) — Runtime-Konfiguration und Profile
