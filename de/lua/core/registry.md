# Entry-Registry
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Abfragen und modifizieren Sie registrierte Entries. Zugriff auf Metadaten, Snapshots und Versionshistorie.

## Laden

```lua
local registry = require("registry")
```

## Entry-Struktur

```lua
{
    id = "app.lib:assert",     -- string: "namespace:name"
    kind = "function.lua",     -- string: Entry-Typ
    meta = {type = "test"},    -- table: durchsuchbare Metadaten
    data = {...}               -- any: Entry-Payload
}
```

## Entry abrufen

```lua
local entry, err = registry.get("app.lib:assert")
```

**Berechtigung:** `registry.get` auf Entry-ID

## Entries finden

```lua
local entries, err = registry.find({kind = "function.lua"})
local entries, err = registry.find({kind = "http.endpoint", namespace = "app.api"})
```

Filterfelder werden gegen Entry-Metadaten abgeglichen.

## ID parsen

```lua
local id = registry.parse_id("app.lib:assert")
-- id.ns = "app.lib", id.name = "assert"
```

## Snapshots

Zeitpunktbezogene Ansicht der Registry:

```lua
local snap, err = registry.snapshot()           -- aktueller Zustand
local snap, err = registry.snapshot_at(5)       -- bei Version 5
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

## Versionen

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- numerische ID
print(version:string())   -- Anzeigestring
local prev = version:previous()  -- vorherige Version oder nil
```

## Historie

```lua
local hist, err = registry.history()
local versions, err = hist:versions()
local version, err = hist:get_version(5)
local snap, err = hist:snapshot_at(version)
```

## Changesets

Modifikationen aufbauen und anwenden:

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

## Fehler

| Bedingung | Art |
|-----------|------|
| Entry nicht gefunden | `errors.NOT_FOUND` |
| Version nicht gefunden | `errors.NOT_FOUND` |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` |
| Ungültiger Parameter | `errors.INVALID` |
| Keine Änderungen anzuwenden | `errors.INVALID` |
| Registry nicht verfügbar | `errors.INTERNAL` |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
