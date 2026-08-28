---
title: "Hub"
description: "Metadaten und Artefakte im Wippy Hub durchsuchen, Zugangsdaten verwalten und den lokalen Artefakt-Cache aus Lua untersuchen."
---

# Hub

Das Modul `hub` liest Module, Versionen, Abhängigkeiten, Dateien, Artefakte und READMEs aus dem Wippy Hub. Es verwaltet außerdem das Runtime-Override für Hub-Zugangsdaten und kann nicht gepinnte Artefakte aus dem lokalen Cache entfernen.

Diese Seite ist eine API-Referenz. Katalogkoordinaten dienen nur der Veranschaulichung; Artefakt-, Authentifizierungs- und Cache-Operationen erfordern passenden Netzwerkzugriff, Zugangsdaten, Lock-Zustand und Sicherheitsrichtlinien.

## Laden

```lua
local hub = require("hub")
```

## Optionen pro Aufruf

Netzwerkgestützte Katalog- und Artefaktaufrufe akzeptieren eine optionale Tabelle mit diesen gemeinsamen Schlüsseln:

| Schlüssel | Typ | Beschreibung |
|-----|------|-------------|
| `registry` | string | Überschreibt die Registry-URL |
| `token` | string | Überschreibt das API-Token |
| `timeout` | duration/number | Anfrage-Timeout (z. B. `"3m"` oder Sekunden) |

Aufrufe mit Paginierungsunterstützung akzeptieren zusätzlich `page` und `page_size`. Authentifizierungsaufrufe erhalten eine Registry-URL direkt. Cache-Aufrufe und Methoden des Package-Handles verwenden ihre eigenen, unten beschriebenen Optionen.

## Module

```lua
local result, err = hub.modules.list({
    org = "wippy",
    visibility = "public",
    type = "library",
    sort_order = "downloads_desc",
    page = 1,
    page_size = 20,
})
-- result = { items, total, page, page_size }
```

| Funktion | Beschreibung |
|----------|-------------|
| `hub.modules.list(opts?)` | Module mit Filtern auflisten |
| `hub.modules.search(query, opts?)` | Nach Suchbegriff suchen |
| `hub.modules.get(module, opts?)` | Modul nach `org/name` oder Modul-ID abrufen |
| `hub.modules.readme(module, opts?)` | README abrufen; gibt `{content, filename, version}` zurück |

### Optionen für List/Search

| Option | Werte |
|--------|--------|
| `organization_id` / `org` | string |
| `visibility` | `public`, `private`, `internal` |
| `type` | `library`, `application`, `agent`, `plugin` |
| `sort_order` | `name_asc`, `name_desc`, `created_desc`, `updated_desc`, `downloads_desc` |
| `keywords` (search) | Array von Strings |
| `license` (search) | string |
| `include_deprecated` (search) | boolean |

### README

```lua
local readme, err = hub.modules.readme("wippy/terminal", {
    version = "1.2.3"
})
if err then return nil, err end
print(readme.content)
```

Die Option `version` akzeptiert entweder einen Versionsstring oder eine Tabelle wie `{id, version, label}`.

## Versionen

```lua
local versions, err = hub.versions.list("wippy/terminal", {
    include_yanked = false,
    page_size = 50,
})

local v, err = hub.versions.get("wippy/terminal", "1.0.0")
```

| Funktion | Beschreibung |
|----------|-------------|
| `hub.versions.list(module, opts?)` | Versionen eines Moduls auflisten |
| `hub.versions.get(module, version, opts?)` | Eine bestimmte Version abrufen |
| `hub.versions.inspect(module, version, opts?)` | Das Artefakt einer Version inspizieren (lädt das Bundle herunter und liest es) |
| `hub.versions.open(module, version, opts?)` | Das Artefakt einer Version als Package-Handle öffnen |

### Package-Handle

`hub.versions.open` lädt das Artefakt herunter und gibt ein Handle mit den Feldern `version`, `digest`, `packed` zurück:

```lua
local pkg, err = hub.versions.open("wippy/terminal", "1.2.3")
if err then return nil, err end

local entries, entries_err = pkg:entries({
    kind = "function.lua",       -- string or string[], omit for all kinds
    include_data = false,        -- default true
})
-- each entry: { id = "ns:name", kind = "...", meta = {...}, data = <any> }
local _, close_err = pkg:close()
if entries_err then return nil, entries_err end
if close_err then return nil, close_err end
return entries
```

| Methode | Beschreibung |
|---------|--------------|
| `pkg:metadata()` | Pack-Metadaten-Map |
| `pkg:entries(opts?)` | Registry-Einträge im Artefakt; `opts.kind` filtert, `opts.include_data` (Standard true) steuert das `data`-Feld |
| `pkg:resources()` | Liste eingebetteter Ressourcen |
| `pkg:fs(resource)` | Dateisystem-Handle für eine eingebettete Ressource |
| `pkg:close()` | Handle freigeben |

Entry-`data` wird ohne Auflösung von `${env:...}`-Referenzen zurückgegeben.

## Lokaler Artefakt-Cache

```lua
local entries, err = hub.cache.list()

local removed, err = hub.cache.remove("wippy/terminal", "1.2.3", {
    force = false,
})

local candidates, err = hub.cache.prune({
    dry_run = true,
})
```

| Funktion | Beschreibung |
|----------|--------------|
| `hub.cache.list()` | Gecachte Artefakte als Datensätze `{module, version, size, pinned}` auflisten |
| `hub.cache.remove(module, version, opts?)` | Ein Artefakt entfernen; `opts.force = true` erlaubt dies auch bei Pinning durch die Lock-Datei |
| `hub.cache.prune(opts?)` | Nicht von der Lock-Datei referenzierte Artefakte entfernen; `opts.dry_run = true` meldet nur Kandidaten |

`hub.cache.remove` und `hub.cache.prune` löschen Dateien aus dem durch die Lock-Datei bestimmten Vendor-Verzeichnis, sofern Dry-Run- oder Pin-Schutz dies nicht verhindert.

## Abhängigkeiten

```lua
local deps, err = hub.dependencies.get("wippy/terminal", "1.0.0")
local users, err = hub.dependents.get("wippy/terminal")
```

| Funktion | Beschreibung |
|----------|-------------|
| `hub.dependencies.get(module, version?, opts?)` | Abhängigkeiten einer Modulversion |
| `hub.dependents.get(module, opts?)` | Module, die von diesem abhängen |

## Dateien

```lua
local files, err = hub.files.list("wippy/terminal", "1.0.0")
```

| Funktion | Beschreibung |
|----------|-------------|
| `hub.files.list(module, version, opts?)` | Dateien einer Version auflisten (`version` erforderlich); gibt `{items, total, page, page_size}` zurück |

## Authentifizierung

Ein Registry-Token in den laufenden Prozess einspeisen — jeder Hub-Konsument übernimmt es beim nächsten Aufruf, ohne Neustart:

```lua
local status, err = hub.auth.authenticate("wpy_xxx")          -- default registry
local status, err = hub.auth.authenticate("wpy_xxx", "https://hub.example.com")

local status, err = hub.auth.status()
local ok, err = hub.auth.logout()
```

Die Token-Zeichenketten oben sind Platzhalter. Laden Sie echte Zugangsdaten aus einem Secret-gestützten Environment-Eintrag oder einer anderen geschützten Quelle; speichern Sie sie nicht in Lua oder Registry-YAML.

| Funktion | Beschreibung |
|----------|-------------|
| `hub.auth.authenticate(token, registry?)` | Das Token gegen die Registry validieren und bei Erfolg als Runtime-Override installieren |
| `hub.auth.status(registry?)` | Die aktuelle Zugangsberechtigung live validieren |
| `hub.auth.logout(registry?)` | Das Runtime-Token-Override löschen |

`status` enthält `authenticated`, `registry` und `orgs`; Identitätsfelder (`username`, `user_id`, `scope`, `expires_at`, `expired`) sind nur vorhanden, wenn authentifiziert. Ein Token, das die Validierung nicht besteht, wird nicht gespeichert — `authenticate` gibt `authenticated = false` zurück. Das Override hat Vorrang vor `WIPPY_TOKEN` und gespeicherten Zugangsdaten.

## Berechtigungen

Jede Operation der obersten Ebene unter `hub.*` prüft den entsprechenden Aktionsnamen, etwa `hub.modules.list`, `hub.versions.open`, `hub.dependencies.get`, `hub.files.list`, `hub.auth.status` oder `hub.cache.prune`. Aktionen für ein Modul verwenden dessen übergebene Referenz als Sicherheitsressource; Authentifizierungsaktionen verwenden die Registry-URL. Nach dem autorisierten Aufruf von `hub.versions.open` führen Methoden des Package-Handles keine weitere Berechtigungsprüfung aus.

## Siehe auch

- [CLI-Referenz](guides/cli.md) — `wippy readme`, `wippy search`, `wippy publish`
- [Veröffentlichungsleitfaden](guides/publishing.md)
