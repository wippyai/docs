# Key-Value-Speicher
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Schneller Key-Value-Speicher mit TTL-Unterstützung. Ideal für Caching, Sessions und temporäre Zustände.

Für Speicherkonfiguration siehe [Store](system-store.md).

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

## Store-Methoden

| Methode | Gibt zurück | Beschreibung |
|--------|---------|-------------|
| `get(key)` | `any, error` | Wert nach Schlüssel abrufen |
| `set(key, value, ttl?)` | `boolean, error` | Wert mit optionaler TTL speichern |
| `has(key)` | `boolean, error` | Prüfen ob Schlüssel existiert |
| `delete(key)` | `boolean, error` | Schlüssel entfernen |
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

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leere Ressourcen-ID | `errors.INVALID` | nein |
| Ressource nicht gefunden | `errors.NOT_FOUND` | nein |
| Store freigegeben | `errors.INVALID` | nein |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.
