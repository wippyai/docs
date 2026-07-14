---
title: "Hub"
---

# Hub

Schreibgeschützter Zugriff auf den Wippy Hub-Modulkatalog: Module auflisten, suchen, Metadaten, Versionen, Abhängigkeiten und READMEs abrufen.

## Laden

```lua
local hub = require("hub")
```

## Optionen pro Aufruf

Jeder Aufruf akzeptiert eine optionale Optionstabelle. Schlüssel, die für alle Aufrufe gelten:

| Schlüssel | Typ | Beschreibung |
|-----|------|-------------|
| `registry` | string | Überschreibt die Registry-URL |
| `token` | string | Überschreibt das API-Token |
| `timeout` | duration/number | Anfrage-Timeout (z. B. `"3m"` oder Sekunden) |

Aufrufe mit Paginierungsunterstützung akzeptieren zusätzlich `page` und `page_size`.

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
print(readme.content)
```

Die Option `version` akzeptiert entweder einen Versionsstring oder eine Tabelle wie `{id, version, label}`.

## Versionen

```lua
local versions, err = hub.versions.list("wippy/http", {
    include_yanked = false,
    page_size = 50,
})

local v, err = hub.versions.get("wippy/http", "1.0.0")
```

| Funktion | Beschreibung |
|----------|-------------|
| `hub.versions.list(module, opts?)` | Versionen eines Moduls auflisten |
| `hub.versions.get(module, version, opts?)` | Eine bestimmte Version abrufen |
| `hub.versions.inspect(module, version, opts?)` | Das Artefakt einer Version inspizieren (lädt das Bundle herunter und liest es) |

## Abhängigkeiten

```lua
local deps, err = hub.dependencies.get("wippy/http", "1.0.0")
local users, err = hub.dependents.get("wippy/http")
```

| Funktion | Beschreibung |
|----------|-------------|
| `hub.dependencies.get(module, version?, opts?)` | Abhängigkeiten einer Modulversion |
| `hub.dependents.get(module, opts?)` | Module, die von diesem abhängen |

## Dateien

```lua
local files, err = hub.files.list("wippy/http", "1.0.0")
```

| Funktion | Beschreibung |
|----------|-------------|
| `hub.files.list(module, version, opts?)` | Dateien einer Version auflisten (`version` erforderlich); gibt `{items, total, page, page_size}` zurück |

## Siehe auch

- [CLI Reference](guides/cli.md) — `wippy readme`, `wippy search`, `wippy publish`
- [Publishing Guide](guides/publishing.md)
