# Key-Value-Speicher
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Schneller Key-Value-Speicher mit TTL-Unterstutzung. Ideal fur Caching, Sessions und temporare Zustande.

Fur Speicherkonfiguration siehe [Store](system-store.md).

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

**Gibt zuruck:** `Store, error`

## Werte speichern

Speichern Sie einen Wert mit optionaler TTL:

```lua
local cache = store.get("app:cache")

-- Einfaches Setzen
cache:set("user:123:name", "Alice")

-- Setzen mit TTL (lauft in 300 Sekunden ab)
cache:set("session:abc", {user_id = 123, role = "admin"}, 300)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Schlussel |
| `value` | any | Wert (Tables, Strings, Zahlen, Booleans) |
| `ttl` | number | TTL in Sekunden (optional, 0 = kein Ablauf) |

**Gibt zuruck:** `boolean, error`

## Werte abrufen

Holen Sie einen Wert anhand des Schlussels:

```lua
local user = cache:get("user:123")
if not user then
    -- Schlussel nicht gefunden oder abgelaufen
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Abzurufender Schlussel |

**Gibt zuruck:** `any, error`

Gibt `nil` zuruck, wenn der Schlussel nicht existiert.

## Existenz prufen

Prufen Sie, ob ein Schlussel existiert, ohne ihn abzurufen:

```lua
if cache:has("lock:" .. resource_id) then
    return nil, errors.new("CONFLICT", "Resource is locked")
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Zu prufender Schlussel |

**Gibt zuruck:** `boolean, error`

## Schlussel loschen

Entfernen Sie einen Schlussel aus dem Store:

```lua
cache:delete("session:" .. session_id)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Zu loschender Schlussel |

**Gibt zuruck:** `boolean, error`

Gibt `true` zuruck wenn geloscht, `false` wenn Schlussel nicht existierte.

## Store-Methoden

| Methode | Gibt zuruck | Beschreibung |
|--------|---------|-------------|
| `get(key)` | `any, error` | Wert nach Schlussel abrufen |
| `set(key, value, ttl?)` | `boolean, error` | Wert mit optionaler TTL speichern |
| `has(key)` | `boolean, error` | Prufen ob Schlussel existiert |
| `delete(key)` | `boolean, error` | Schlussel entfernen |
| `release()` | `boolean` | Store an Pool zuruckgeben |

## Berechtigungen

Store-Operationen unterliegen der Sicherheitsrichtlinienauswertung.

| Aktion | Ressource | Attribute | Beschreibung |
|--------|----------|------------|-------------|
| `store.get` | Store-ID | - | Store-Ressource abrufen |
| `store.key.get` | Store-ID | `key` | Schlusselwert lesen |
| `store.key.set` | Store-ID | `key` | Schlusselwert schreiben |
| `store.key.delete` | Store-ID | `key` | Schlussel loschen |
| `store.key.has` | Store-ID | `key` | Schlusselexistenz prufen |

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leere Ressourcen-ID | `errors.INVALID` | nein |
| Ressource nicht gefunden | `errors.NOT_FOUND` | nein |
| Store freigegeben | `errors.INVALID` | nein |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) fur die Arbeit mit Fehlern.
