---
title: "Key-Value-Speicher"
---

# Key-Value-Speicher
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Schneller Key-Value-Speicher mit TTL-Unterstützung. Ideal für Caching, Sessions und temporäre Zustände.

Für Speicherkonfiguration siehe [Store](system/store.md).

## Laden

```lua
local store = require("store")
```

## Store abrufen

Holen Sie eine Store-Ressource anhand der Registry-ID:

```lua
local cache, err = store.get("app:cache")
if err then
    return nil, err
end

cache:set("user:123", {name = "Alice"}, 3600)
local user = cache:get("user:123")

cache:release()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Store-Ressourcen-ID |

**Gibt zurück:** `Store, error`

## Werte speichern

Speichern Sie einen Wert mit optionaler TTL:

```lua
local cache = store.get("app:cache")

-- Einfaches Setzen
cache:set("user:123:name", "Alice")

-- Setzen mit TTL (läuft in 300 Sekunden ab)
cache:set("session:abc", {user_id = 123, role = "admin"}, 300)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Schlüssel |
| `value` | any | Wert (Tables, Strings, Zahlen, Booleans) |
| `ttl` | number | TTL in Sekunden (optional, 0 = kein Ablauf) |

**Gibt zurück:** `boolean, error`

## Werte abrufen

Holen Sie einen Wert anhand des Schlüssels:

```lua
local user = cache:get("user:123")
if not user then
    -- Schlüssel nicht gefunden oder abgelaufen
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Abzurufender Schlüssel |

**Gibt zurück:** `any, error`

Gibt `nil` zurück, wenn der Schlüssel nicht existiert.

## Existenz prüfen

Prüfen Sie, ob ein Schlüssel existiert, ohne ihn abzurufen:

```lua
if cache:has("lock:" .. resource_id) then
    return nil, errors.new("CONFLICT", "Resource is locked")
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Zu prüfender Schlüssel |

**Gibt zurück:** `boolean, error`

## Schlüssel löschen

Entfernen Sie einen Schlüssel aus dem Store:

```lua
cache:delete("session:" .. session_id)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Zu löschender Schlüssel |

**Gibt zurück:** `boolean, error`

Gibt `true` zurück wenn gelöscht, `false` wenn Schlüssel nicht existierte.

## Eintrags-Metadaten lesen

`entry` gibt den Wert zusammen mit seiner `version` zurück — einer opaken Zeichenkette, die für optimistische Nebenläufigkeit verwendet wird:

```lua
local e, err = cache:entry("user:123")
if e then
    print(e.key, e.value, e.version)
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Zu lesender Schlüssel |

**Gibt zurück:** `Entry, error` — `{key: string, value: any, version: string}`

## Schlüssel auflisten

Einträge in deterministischer Schlüsselreihenfolge auflisten, mit Paging:

```lua
local page, err = cache:list({ prefix = "session:", limit = 100 })
for _, e in ipairs(page.items) do
    print(e.key, e.value)
end

-- nächste Seite
if page.has_more then
    page = cache:list({ prefix = "session:", after = page.cursor })
end
```

| Option | Typ | Beschreibung |
|--------|------|-------------|
| `prefix` | string | Nur Schlüssel mit diesem Präfix |
| `after` | string | Nach diesem Cursor fortsetzen (aus einer vorherigen Seite) |
| `limit` | integer | Maximale Anzahl an Elementen pro Seite |

**Gibt zurück:** `Page, error` — `{items: Entry[], cursor: string, has_more: boolean}`

## Bedingte Schreibvorgänge

`put` schreibt einen Wert und gibt seinen neuen `Entry` zurück. Optionen ermöglichen optimistische Nebenläufigkeit:

```lua
-- nur erstellen, wenn der Schlüssel nicht existiert
local e, err = cache:put("lock:job-1", owner, { only_if_absent = true })
if err and err:kind() == "ALREADY_EXISTS" then
    -- jemand anderes hält ihn
end

-- compare-and-set: nur schreiben, wenn die Version noch übereinstimmt
local cur = cache:entry("config")
local e2, err2 = cache:put("config", new_value, { if_version = cur.version })
if err2 and err2:kind() == "CONFLICT" then
    -- ein gleichzeitiger Schreiber hat ihn geändert; erneut lesen und wiederholen
end
```

| Option | Typ | Beschreibung |
|--------|------|-------------|
| `ttl` | number | TTL in Sekunden |
| `only_if_absent` | boolean | Nur schreiben, wenn der Schlüssel nicht existiert |
| `if_version` | string | Nur schreiben, wenn die aktuelle Version übereinstimmt |

`only_if_absent` und `if_version` schließen sich gegenseitig aus.

**Gibt zurück:** `Entry, error`

<warning>
Bedingte Schreibvorgänge erfordern einen Store, dessen <code>info().conditional_put</code> true ist (die Stores Memory und <code>store.kv.raft</code>). Bei <code>store.kv.crdt</code> und <code>store.sql</code> geben sie einen <code>errors.INVALID</code>-Fehler zurück — verwenden Sie <code>store.kv.raft</code>, wenn Sie bedingte Schreibvorgänge benötigen.
</warning>

## Store-Fähigkeiten

`info` meldet das Backend und was es unterstützt, sodass Code sich an den jeweils gebundenen Store anpassen kann:

```lua
local info = cache:info()
-- info.backend      -> einer von store.backend.* (z. B. "kv.raft")
-- info.consistency  -> einer von store.consistency.* (z. B. "linearizable")
-- info.durable / info.list / info.versioned / info.conditional_put / info.ttl  (booleans)
```

**Gibt zurück:** `Info, error` — `{id, backend, consistency, durable, list, versioned, conditional_put, ttl}`

### Konstanten

| Konstante | Werte |
|----------|--------|
| `store.backend` | `MEMORY`, `SQL`, `KV_RAFT`, `KV_CRDT`, `UNKNOWN` |
| `store.consistency` | `LINEARIZABLE`, `EVENTUAL`, `LOCAL`, `UNKNOWN` |

```lua
if cache:info().consistency == store.consistency.LINEARIZABLE then
    -- sicher, compare-and-set zu verwenden
end
```

## Store-Methoden

| Methode | Gibt zurück | Beschreibung |
|--------|---------|-------------|
| `get(key)` | `any, error` | Wert nach Schlüssel abrufen |
| `entry(key)` | `Entry, error` | Wert mit Versions-Metadaten abrufen |
| `set(key, value, ttl?)` | `boolean, error` | Wert mit optionaler TTL speichern |
| `put(key, value, opts?)` | `Entry, error` | Bedingter/versionierter Schreibvorgang, gibt den neuen Eintrag zurück |
| `list(opts?)` | `Page, error` | Paginierte Auflistung in Schlüsselreihenfolge |
| `has(key)` | `boolean, error` | Prüfen ob Schlüssel existiert |
| `delete(key)` | `boolean, error` | Schlüssel entfernen |
| `info()` | `Info, error` | Backend, Konsistenz und Fähigkeits-Flags |
| `release()` | `boolean` | Store an Pool zurückgeben |

## Berechtigungen

Store-Operationen unterliegen der Sicherheitsrichtlinienauswertung.

| Aktion | Ressource | Attribute | Beschreibung |
|--------|----------|------------|-------------|
| `store.get` | Store-ID | - | Store-Ressource abrufen |
| `store.key.get` | Store-ID | `key` | Schlüsselwert lesen |
| `store.key.set` | Store-ID | `key` | Schlüsselwert schreiben |
| `store.key.delete` | Store-ID | `key` | Schlüssel löschen |
| `store.key.has` | Store-ID | `key` | Schlüsselexistenz prüfen |

## Fehler

`store.get()` und alle Methoden des Store-Handles (`get`, `set`, `has`, `delete`) geben strukturierte Fehler zurück (verwenden Sie `err:kind()`).

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leere Ressourcen-ID | `errors.INVALID` | nein |
| Ressource nicht gefunden | `errors.NOT_FOUND` | nein |
| Store freigegeben | `errors.INVALID` | nein |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` | nein |
| `only_if_absent` und Schlüssel existiert | `errors.ALREADY_EXISTS` | nein |
| `if_version`-Abweichung | `errors.CONFLICT` | ja |
| Bedingter Schreibvorgang auf einem Store ohne Unterstützung | `errors.INVALID` | nein |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
