---
title: "Entry-Registry"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='permissions'/"
---

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

Entries, die aus `registry.get`, `registry.find`, `snap:entries()`, `snap:get()`, `snap:namespace()` und `snap:find()` zurückgelesen werden, tragen nur diese vier autorenseitigen Felder.

`dependency_root` ist ein schreibseitiges Feld, das `changes:create()` und `changes:update()` akzeptieren. Es ist ein Boolean, der einen `ns.dependency`-Entry als Deployment-Root markiert. Die Entry-APIs geben es nie zurück; Registry-eigener Zustand wird über [`snap:state()`](lua/core/registry.md#snapshot-state) gelesen.

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
| `snap:state()` | `State, error` | Entries mit Registry-eigenen Metadaten, plus der aufgelöste Modulgraph |
| `snap:get(id)` | `Entry, error` | Einzelner Entry nach ID |
| `snap:find(filter)` | `Entry[]` | Entries filtern |
| `snap:namespace(ns)` | `Entry[]` | Entries im Namespace |
| `snap:version()` | `Version` | Snapshot-Version |
| `snap:changes()` | `Changes` | Changeset erstellen |

### Snapshot-Zustand

`snap:state()` gibt den Entry-Zustand zusammen mit dem Modulgraphen zurück, der für die Snapshot-Version ausgewählt wurde. Registry-eigene Herkunft wird an jedem Entry mitgeführt statt in `meta` gemischt, sodass sie nicht mit vom Autor gesetzten Metadaten verwechselt werden kann.

```lua
local snap, err = registry.snapshot()
local state, err = snap:state()

for _, entry in ipairs(state.entries) do
    print(entry.id, entry.registry.owner, entry.registry.root)
end

if state.resolution then
    print(state.resolution.digest, state.resolution.input_digest)
    for _, module in ipairs(state.resolution.modules) do
        print(module.name, module.version)
    end
end
```

Jeder Entry in `state.entries` hat die vier autorenseitigen Felder plus:

- `registry.owner` - Deployment-Quelle, die den Entry geliefert hat
- `registry.root` - `true`, wenn der Entry eine vom Deployment ausgewählte Abhängigkeitsdeklaration ist

`state.resolution` beschreibt den Modulgraphen einer `registry.snapshot()`-Sicht. Es fehlt bei Snapshots, die keinen eigenen Graphen tragen, darunter `registry.snapshot_at()` und Overlay-Snapshots:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `digest` | string | Inhalts-Digest der vollständigen unveränderlichen Auswahl |
| `input_digest` | string | Digest der deklarierten Root-Menge |
| `baseline_digest` | string | Digest der Deployment-Baseline, gegen die der Graph gelöst wurde; entfällt, wenn ungebunden |
| `roots` | array | Vom Autor deklarierte Abhängigkeiten, die als Solver-Eingaben dienen |
| `references` | array | Root-förmige Deklarationen, die in einen bestehenden Root derselben Komponente eingefaltet wurden; entfällt, wenn leer |
| `modules` | array | Ausgewählte Module |

Einträge in `roots` und `references` haben `id`, `component` und `version`. Einträge in `modules` haben `name` und `version`, plus `version_id`, `source`, `digest`, `size_bytes` und `protected`, sofern gesetzt.

## Versionen

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- numerische ID
print(version:string())   -- Anzeigestring
local prev = version:previous()  -- vorherige Version oder nil
local next = version:next()      -- nächste Version oder nil
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

### Entries löschen

`changes:delete()` akzeptiert einen ID-String, eine Tabelle mit einem `id`-String, eine Tabelle mit `ns`- und `name`-Strings oder ein Array aus beliebigen davon. Arrays dürfen verschachtelt sein, und doppelte IDs fallen zu einer einzigen Delete-Operation zusammen.

```lua
changes:delete("test:old_entry")
changes:delete({id = "test:old_entry"})
changes:delete({ns = "test", name = "old_entry"})
changes:delete({"test:a", {ns = "test", name = "b"}, {"test:c"}})
```

Eine leere Liste, eine Tabelle, die sich selbst referenziert, und ein Wert, der weder String noch Tabelle ist, werden mit `errors.INVALID` abgelehnt.

### Changes-Methoden

| Methode | Beschreibung |
|--------|-------------|
| `changes:create(entry)` | Create-Operation hinzufügen |
| `changes:update(entry)` | Update-Operation hinzufügen |
| `changes:delete(id)` | Delete-Operation hinzufügen |
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

## Overlays

Ein Overlay ist eine prozesslokale Menge von Registry-Entries, die einer logischen Identität gehört. Overlay-Entries nehmen an der gewöhnlichen Topologie und den Handler-Übergängen teil, sodass Dienste für sie genau wie für dauerhafte Entries starten und stoppen, aber sie bringen die Registry-Historie nie voran und erscheinen in keiner Version. Sie existieren nur im laufenden Prozess und sind nach einem Kaltstart leer, weshalb der besitzende Steuerdienst sie beim Start abgleicht.

```lua
local snap, err = registry.overlay("data-sources:crm")
```

**Gibt zurück:** `Snapshot, error`

Der Snapshot legt die Overlay-Entries des Owners über die üblichen Methoden offen und meldet die aktuelle Registry-Version aus `snap:version()`. Er hält zudem die Overlay-Generation im Moment des Öffnens fest, und genau das macht Schreibvorgänge sicher.

```lua
local snap, err = registry.overlay("data-sources:crm")
if err then return nil, err end

local changes = snap:changes()
changes:create({
    id = "data.crm:connection",
    kind = "registry.entry",
    meta = {},
    data = {endpoint = "https://crm.internal"}
})

local version, err = changes:apply()
```

`changes:apply()` auf einem Overlay-Snapshot schreibt das Overlay und gibt die aktuelle Registry-Version zurück. Es wird keine Historienversion erzeugt, die zurückgegebene Version ändert sich also nur, wenn nebenläufig eine dauerhafte Änderung stattgefunden hat.

### Nebenläufigkeit

Jedes Overlay trägt einen Generationszähler, der bei jedem erfolgreichen Anwenden steigt. `changes:apply()` gelingt nur, wenn die Generation noch der beim Öffnen des Snapshots festgehaltenen entspricht. Ein nebenläufiges Anwenden auf dasselbe Overlay schlägt mit `errors.CONFLICT` fehl, markiert als wiederholbar: Overlay erneut öffnen und das Changeset neu aufbauen.

```lua
local last_err
for _ = 1, 3 do
    local snap, err = registry.overlay("data-sources:crm")
    if err then return nil, err end

    local _, apply_err = snap:changes():delete("data.crm:connection"):apply()
    if not apply_err then return true end
    if not apply_err:retryable() then return nil, apply_err end
    last_err = apply_err
end
return nil, last_err
```

### Einschränkungen

- Der Owner-String ist erforderlich und darf nicht leer sein.
- Ein Changeset muss nicht-leer sein und darf denselben Entry nicht zweimal nennen.
- `create` schlägt fehl, wenn die ID bereits im dauerhaften Zustand oder in irgendeinem Overlay existiert.
- `update` und `delete` funktionieren nur auf Entries, die dieser Owner erstellt hat.
- Overlay-Entries können `dependency_root` oder andere Registry-eigene Metadaten nicht setzen.
- Overlay-Entries können keine Kinds verwenden, die einer Registry-Direktive gehören, etwa `ns.dependency`.
- Ein Delete, das einen Entry entfernt, von dem ein überlebender Entry abhängt, wird abgelehnt.
- Abhängigkeiten können keine Overlay-Owner-Grenzen überschreiten, und dauerhafte Entries können nicht von Overlay-Entries abhängen.

All das erscheint als `errors.CONFLICT` oder `errors.INVALID`, und keines davon ist wiederholbar: nur die Generations-Abweichung oben ist es.

**Berechtigungen:** `registry.overlay.get` auf dem Owner zum Öffnen und Lesen, `registry.overlay.apply` auf dem Owner zum Schreiben, und `registry.overlay.<create|update|delete>.<kind>` auf jeder Entry-ID im Changeset.

## Berechtigungen

| Berechtigung | Ressource | Beschreibung |
|------------|----------|-------------|
| `registry.get` | Entry-ID | Entry lesen (filtert auch find/entries-Ergebnisse) |
| `registry.apply` | - | Changeset anwenden |
| `registry.apply_version` | - | Version anwenden/zurückrollen |
| `registry.overlay.get` | Owner-ID | Overlay-Snapshot öffnen und lesen |
| `registry.overlay.apply` | Owner-ID | Overlay-Changeset anwenden |
| `registry.overlay.create.<kind>` | Entry-ID | Overlay-Entry dieser Art erstellen |
| `registry.overlay.update.<kind>` | Entry-ID | Overlay-Entry dieser Art aktualisieren |
| `registry.overlay.delete.<kind>` | Entry-ID | Overlay-Entry dieser Art löschen |

## Fehler

| Bedingung | Art |
|-----------|------|
| Entry nicht gefunden | `errors.NOT_FOUND` |
| Version nicht gefunden | `errors.NOT_FOUND` |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` |
| Ungültiger Parameter | `errors.INVALID` |
| Keine Änderungen anzuwenden | `errors.INVALID` |
| Overlay wurde während des Anwendens geändert | `errors.CONFLICT` (wiederholbar) |
| Overlay-Entry gehört woanders oder kollidiert mit dauerhaftem Zustand | `errors.CONFLICT` |
| Registry nicht verfügbar | `errors.INTERNAL` |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
