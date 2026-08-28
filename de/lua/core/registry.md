---
title: "Entry-Registry"
description: "Registry-Entrys und Metadaten lesen, Versionen und Snapshots prüfen und Changesets anwenden."
---

# Entry-Registry
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Das Modul `registry` liest und ändert Entrys und bietet Zugriff auf Snapshots und die Versionshistorie. Diese Seite ist eine API-Referenz; die Änderungsbeispiele verwenden beispielhafte IDs und benötigen Richtlinien, die genau diese Ressourcen und Entry-Kinds autorisieren.

## Laden

```lua
local registry = require("registry")
```

## Entry-Struktur

```lua
{
    id = "app.lib:assert",     -- string: "namespace:name"
    kind = "function.lua",     -- string: entry type
    meta = {type = "test"},    -- table: searchable metadata
    data = {...}               -- any: entry payload
}
```

## Entry abrufen

```lua
local entry, err = registry.get("app.lib:assert")
```

**Berechtigung:** `registry.get` auf Entry-ID

## Entries finden

```lua
local entries, err = registry.find({[".kind"] = "function.lua"})
local entries, err = registry.find({[".kind"] = "http.endpoint", [".ns"] = "app.api"})
```

Die Root-Selektoren lauten `.kind`, `.name`, `.ns` und `.id`; ihre Werte unterstützen Glob-Matching. Metadatenfilter verwenden das Präfix `meta.`, beispielsweise `{["meta.type"] = "test"}`.

## ID parsen

```lua
local id = registry.parse_id("app.lib:assert")
-- id.ns = "app.lib", id.name = "assert"
```

## Snapshots

Zeitpunktbezogene Ansicht der Registry:

```lua
local snap, err = registry.snapshot()           -- current state
local snap, err = registry.snapshot_at(5)       -- at version 5
```

### Snapshot-Methoden

| Methode | Gibt zurück | Beschreibung |
|--------|---------|-------------|
| `snap:entries()` | `Entry[], error` | Alle zugänglichen Entries |
| `snap:get(id)` | `Entry, error` | Einzelner Entry nach ID |
| `snap:find(filter)` | `Entry[]` | Entries filtern |
| `snap:namespace(ns)` | `Entry[]` | Entries im Namespace |
| `snap:version()` | `Version` | Snapshot-Version |
| `snap:changes()` | `Changes` | Changeset erstellen |

## Prozesslokale Overlays

`registry.overlay(owner_id)` öffnet ein prozesslokales Overlay für einen logischen Owner. Es gibt einen normalen Snapshot der effektiven Registry zurück; erstellen Sie daraus ein Changeset und wenden Sie es wie eine dauerhafte Änderung an:

```lua
local snap, err = registry.overlay("controllers:customer-db")
if err then
    return nil, err
end

local changes = snap:changes()
changes:create({
    id = "runtime.data_sources:customer-db",
    kind = "db.sql.postgres",
    data = {host = "db.example.com", database = "customer"}
})

local current_version, err = changes:apply()
```

Overlay-Änderungen wirken auf Registry-Topologie und Ressourcen dieses Prozesses, erzeugen aber keine dauerhaften Historienversionen. `changes:apply()` gibt deshalb die unveränderte aktuelle dauerhafte Version zurück. Ein Overlay übersteht normale Historien-Commits und die Auswahl einer Version; bei einem Cold Boot oder expliziten Laden des Registry-Zustands wird es entfernt und anschließend von seinem Owner abgeglichen.

Overlay-Snapshots verwenden generationsbasierte optimistische Nebenläufigkeit. Das Anwenden von Änderungen aus einem veralteten Snapshot schlägt atomar mit dem wiederholbaren Fehler `errors.CONFLICT` fehl; öffnen Sie das Overlay erneut und erstellen Sie das Changeset neu. Ein Changeset darf für jede Entry-ID höchstens eine Operation enthalten. Owner-IDs werden auf ihre kanonische Identität getrimmt. Der Owner ist Registry-Zustand und kein Entry-Metadatum; Entry-Kinds, die einer Expansion-Direktive gehören, können nicht über ein Overlay geändert werden.

Normale Aufrufe von `registry.get`, `find` und `snapshot` sehen die zusammengesetzte effektive Registry und erfordern weiterhin `registry.get` für jeden Entry; die Overlay-Berechtigung auf Owner-Ebene ersetzt keine Leseberechtigung.

## Versionen

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- numeric ID
print(version:string())   -- display string
local prev = version:previous()  -- previous version or nil
local next = version:next()      -- next version or nil
```

## Historie

```lua
local hist, err = registry.history()
local versions, err = hist:versions()
local version, err = hist:get_version(5)
local snap, err = hist:snapshot_at(version)
```

## Changesets

Ein Changeset aus Create-, Update- und Delete-Operationen aufbauen und anschließend anwenden:

```lua
local snap, err = registry.snapshot()
local changes = snap:changes()

changes:create({
    id = "test:new_entry",
    kind = "test.kind",
    meta = {type = "test"},
    data = {config = "value"}
})

changes:update({
    id = "test:existing",
    kind = "test.kind",
    meta = {updated = true},
    data = {new_value = true}
})

changes:delete("test:old_entry")

local new_version, err = changes:apply()
```

**Berechtigung:** `registry.apply` für `changes:apply()`

### Changes-Methoden

| Methode | Beschreibung |
|--------|-------------|
| `changes:create(entry)` | Create-Operation hinzufügen |
| `changes:update(entry)` | Update-Operation hinzufügen |
| `changes:delete(id)` | Delete-Operation hinzufügen (String oder `{ns, name}`) |
| `changes:ops()` | Ausstehende Operationen abrufen |
| `changes:apply()` | Änderungen anwenden, gibt neue Version zurück |

## Version anwenden

Auf eine bestimmte Version vor- oder zurückrollen:

```lua
local prev = current_version:previous()
local ok, err = registry.apply_version(prev)
```

**Berechtigung:** `registry.apply_version`

## Delta erstellen

Operationen berechnen, um zwischen Zuständen zu wechseln:

```lua
local from = {{id = "test:a", kind = "test", meta = {}, data = {}}}
local to = {{id = "test:b", kind = "test", meta = {}, data = {}}}

local ops, err = registry.build_delta(from, to)
for _, op in ipairs(ops) do
    print(op.kind, op.entry.id)  -- "entry.create", "entry.update", "entry.delete"
end
```

## Berechtigungen

| Berechtigung | Ressource | Beschreibung |
|------------|----------|-------------|
| `registry.get` | Entry-ID | Entry lesen (filtert auch find/entries-Ergebnisse) |
| `registry.apply` | - | Changeset anwenden |
| `registry.apply_version` | - | Version anwenden/zurückrollen |
| `registry.overlay.get` | Owner-ID | Overlay eines Owners öffnen |
| `registry.overlay.apply` | Owner-ID | Overlay-Changeset anwenden |
| `registry.overlay.create.<kind>` | Entry-ID | Entry des angegebenen Kinds in einem Overlay erstellen |
| `registry.overlay.update.<kind>` | Entry-ID | Entry des angegebenen Kinds in einem Overlay aktualisieren |
| `registry.overlay.delete.<kind>` | Entry-ID | Entry des angegebenen Kinds aus einem Overlay löschen |

## Fehler

| Bedingung | Art |
|-----------|------|
| Entry nicht gefunden | `errors.NOT_FOUND` |
| Version nicht gefunden | `errors.NOT_FOUND` |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` |
| Ungültiger Parameter | `errors.INVALID` |
| Keine Änderungen anzuwenden | `errors.INVALID` |
| Leerer Overlay-Owner oder direktiveneigenes Kind | `errors.INVALID` |
| Veralteter Overlay-Snapshot | `errors.CONFLICT` (wiederholbar) |
| Registry nicht verfügbar | `errors.INTERNAL` |

Siehe [Fehlerbehandlung](lua/core/errors.md) für den Umgang mit Fehlern.
