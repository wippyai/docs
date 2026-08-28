---
title: "Key-Value-Speicher"
description: "Werte mit optionaler Ablaufzeit und bedingten Schreibvorgängen speichern und abrufen."
---

# Key-Value-Speicher
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Das Modul `store` stellt Key-Value-Speicher mit optionalen TTLs bereit. Es eignet sich für Cache-Daten, Sitzungen und andere temporäre Zustände.

Diese Seite ist eine API-Referenz. Ihre Ausschnitte setzen einen konfigurierten Store, die unten aufgeführten Berechtigungen und von der Anwendung bereitgestellte Werte wie `owner` oder `new_value` voraus. Ausschnitte nach dem Abrufen verwenden ein bereits vorhandenes, aktives `cache`-Handle und sind keine eigenständigen Funktionen.

Informationen zur Store-Konfiguration finden Sie unter [Store](system/store.md).

## Laden

```lua
local store = require("store")
```

## Store abrufen

Rufen Sie eine Store-Ressource anhand ihrer Registry-ID ab:

```lua
local cache, err = store.get("app:cache")
if err then
    return nil, err
end

local _, set_err = cache:set("user:123", {name = "Alice"}, 3600)
if set_err then
    cache:release()
    return nil, set_err
end

local user, get_err = cache:get("user:123")

cache:release()
if get_err then return nil, get_err end
return user
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Store-Ressourcen-ID |

**Gibt zurück:** `Store, error`

## Werte speichern

Speichern Sie einen Wert mit optionaler TTL:

```lua
-- Simple set
local _, err = cache:set("user:123:name", "Alice")
if err then return nil, err end

-- Set with TTL (expires in 300 seconds)
local ok, ttl_err = cache:set("session:abc", {user_id = 123, role = "admin"}, 300)
if ttl_err then return nil, ttl_err end
return ok
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
local errors = require("errors")

local user, err = cache:get("user:123")
if err then
    if err:kind() == errors.NOT_FOUND then
        return nil -- key missing or expired
    end
    return nil, err
end
return user
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Abzurufender Schlüssel |

**Gibt zurück:** `any, error`

Wenn der Schlüssel nicht existiert oder abgelaufen ist, gibt die Methode `nil` und einen Fehler vom Typ `errors.NOT_FOUND` zurück.

## Existenz prüfen

Prüfen Sie, ob ein Schlüssel existiert, ohne ihn abzurufen:

```lua
local errors = require("errors")

local exists, err = cache:has("lock:" .. resource_id)
if err then return nil, err end
if exists then
    return nil, errors.new({
        message = "Resource is locked",
        kind = errors.CONFLICT
    })
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Zu prüfender Schlüssel |

**Gibt zurück:** `boolean, error`

## Schlüssel löschen

Entfernen Sie einen Schlüssel aus dem Store:

```lua
local deleted, err = cache:delete("session:" .. session_id)
if err then return nil, err end
return deleted
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Zu löschender Schlüssel |

**Gibt zurück:** `boolean, error`

Die Methode gibt `true` zurück, wenn sie den Schlüssel löscht, und `false`, wenn der Schlüssel nicht existiert.

## Eintrags-Metadaten lesen

`entry` gibt den Wert zusammen mit seiner `version` zurück — einer opaken Zeichenkette, die für optimistische Nebenläufigkeit verwendet wird:

```lua
local e, err = cache:entry("user:123")
if err then return nil, err end
if e then
    print(e.key, e.value, e.version)
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Zu lesender Schlüssel |

**Gibt zurück:** `Entry, error` — `{key: string, value: any, version: string}`

## Schlüssel auflisten

Listen Sie Einträge in deterministischer Schlüsselreihenfolge mit Seitennavigation auf:

```lua
local page, err = cache:list({ prefix = "session:", limit = 100 })
if err then return nil, err end
for _, e in ipairs(page.items) do
    print(e.key, e.value)
end

-- next page
if page.has_more then
    local next_page, next_err = cache:list({ prefix = "session:", after = page.cursor })
    if next_err then return nil, next_err end
    page = next_page
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
local errors = require("errors")

-- create only if the key does not exist
local e, err = cache:put("lock:job-1", owner, { only_if_absent = true })
if err and err:kind() == errors.ALREADY_EXISTS then
    -- someone else holds it
elseif err then
    return nil, err
end

-- compare-and-set: write only if the version still matches
local cur, read_err = cache:entry("config")
if read_err then return nil, read_err end
local e2, err2 = cache:put("config", new_value, { if_version = cur.version })
if err2 and err2:kind() == errors.CONFLICT then
    -- a concurrent writer changed it; re-read and retry
elseif err2 then
    return nil, err2
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
local info, err = cache:info()
if err then return nil, err end
-- info.backend      -> one of store.backend.* (e.g. "kv.raft")
-- info.consistency  -> one of store.consistency.* (e.g. "linearizable")
-- info.durable / info.list / info.versioned / info.conditional_put / info.ttl  (booleans)
```

**Gibt zurück:** `Info, error` — `{id, backend, consistency, durable, list, versioned, conditional_put, ttl}`

### Konstanten

| Konstante | Werte |
|----------|--------|
| `store.backend` | `MEMORY`, `SQL`, `KV_RAFT`, `KV_CRDT`, `UNKNOWN` |
| `store.consistency` | `LINEARIZABLE`, `EVENTUAL`, `LOCAL`, `UNKNOWN` |

```lua
local info, err = cache:info()
if err then return nil, err end
if info.consistency == store.consistency.LINEARIZABLE then
    -- safe to use compare-and-set
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

Store-Operationen unterliegen der Auswertung der Sicherheitsrichtlinien.

| Aktion | Ressource | Attribute | Beschreibung |
|--------|----------|------------|-------------|
| `store.get` | Store-ID | - | Store-Ressource abrufen |
| `store.info` | Store-ID | - | Store-Fähigkeiten abfragen |
| `store.key.get` | Store-ID | `key` | Schlüsselwert lesen (gilt auch für `entry`) |
| `store.key.set` | Store-ID | `key` | Schlüsselwert schreiben (gilt auch für `put`) |
| `store.key.delete` | Store-ID | `key` | Schlüssel löschen |
| `store.key.has` | Store-ID | `key` | Schlüsselexistenz prüfen |
| `store.key.list` | Store-ID | `prefix` | Einträge auflisten |

Berechtigungsverweigerungen durch `store.get`, `get`, `set`, `delete` und `has` lösen einen Lua-Fehler aus. Die Methoden `info`, `entry`, `list` und `put` geben dagegen einen Fehler vom Typ `errors.PERMISSION_DENIED` zurück. Erteilen Sie die erforderlichen Aktionen, bevor Sie Code aufrufen, der einen ausgelösten Berechtigungsfehler nicht verarbeiten kann.

## Fehler

Fehler bei Eingaben, Suche, Backend und Fähigkeiten werden als strukturierte Fehler zurückgegeben (verwenden Sie `err:kind()`). Für Berechtigungsverweigerungen gilt das oben beschriebene geteilte Verhalten.

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leere Ressourcen-ID | `errors.INVALID` | nein |
| Ressourcen-Registry nicht verfügbar | `errors.NOT_FOUND` | nein |
| Abruf der Store-Ressource fehlgeschlagen, einschließlich einer fehlenden Ressource | `errors.INTERNAL` | nein |
| Store freigegeben | `errors.INVALID` | nein |
| Berechtigung durch `info`, `entry`, `list` oder `put` verweigert | `errors.PERMISSION_DENIED` | nein |
| Berechtigung durch `store.get`, `get`, `set`, `delete` oder `has` verweigert | ausgelöster Lua-Fehler | nicht anwendbar |
| `only_if_absent` und Schlüssel existiert | `errors.ALREADY_EXISTS` | nein |
| `if_version`-Abweichung | `errors.CONFLICT` | ja |
| Bedingter Schreibvorgang auf einem Store ohne Unterstützung | `errors.INVALID` | nein |

Informationen zum Umgang mit Fehlern finden Sie unter [Fehlerbehandlung](lua/core/errors.md).
