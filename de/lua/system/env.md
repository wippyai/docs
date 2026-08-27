---
title: "Umgebungsvariablen"
description: "Vom konfigurierten Umgebungssystem bereitgestellte Umgebungsvariablen lesen und aktualisieren."
---

# Umgebungsvariablen
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Das Modul `env` liest und aktualisiert von der Runtime bereitgestellte Umgebungsvariablen.

Diese Seite ist eine API-Referenz. Ihre Ausschnitte zeigen einzelne Operationen und setzen voraus, dass die genannten Variablen und Sicherheitsrichtlinien bereits vorhanden sind.

Variablen müssen im [Umgebungssystem](../../system/env.md) definiert sein, bevor darauf zugegriffen werden kann. Das System steuert, welche Speicher-Backends (OS, Datei, Speicher) Werte liefern und ob Variablen schreibgeschützt sind.

## Laden

```lua
local env = require("env")
```

## `get`

Holt einen Umgebungsvariablenwert.

```lua
-- Get database connection string
local db_url, db_err = env.get("DATABASE_URL")
if db_err then return nil, db_err end

-- Apply a fallback only to a missing variable. Permission and backend errors
-- still propagate to the caller.
local function get_or(key, fallback)
    local value, err = env.get(key)
    if not err then return value end
    if errors.is(err, errors.NOT_FOUND) then return fallback end
    return nil, err
end

local port, port_err = get_or("PORT", "8080")
if port_err then return nil, port_err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Variablenname |

**Gibt zurück:** `string, error`

Gibt `nil, error` zurück, wenn Variable nicht existiert.

## `set`

Setzt eine Umgebungsvariable.

```lua
-- Set runtime configuration
local updated, set_err = env.set("APP_MODE", "production")
if set_err then return nil, set_err end
return updated
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Variablenname |
| `value` | string | Zu setzender Wert |

**Gibt zurück:** `boolean, error`

## `get_all`

Holt alle zugänglichen Umgebungsvariablen.

```lua
local logger = require("logger")

local vars, vars_err = env.get_all()
if vars_err then return nil, vars_err end

-- Log names only. Values such as connection URLs may contain credentials even
-- when their keys do not include words like SECRET or KEY.
local accessible_keys = {}
for key in pairs(vars) do table.insert(accessible_keys, key) end
logger:debug("accessible environment variables", {keys = accessible_keys})

-- Check required variables
local required = {"DATABASE_URL", "REDIS_URL", "API_KEY"}
for _, key in ipairs(required) do
    if not vars[key] then
        return nil, errors.new({
            message = "Missing required env var: " .. key,
            kind = errors.INVALID
        })
    end
end
```

**Gibt zurück:** `table, error`

## Berechtigungen

Umgebungszugriff unterliegt der Sicherheitsrichtlinienauswertung.

### Sicherheitsaktionen

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `env.get` | Variablenname | Umgebungsvariable lesen |
| `env.set` | Variablenname | Umgebungsvariable schreiben |
`get_all` besitzt keine eigene Sicherheitsaktion. Es liefert nur Variablen, für die `env.get` erlaubt ist, und filtert jeden Variablennamen über `env.get`.

### Zugriff prüfen

```lua
local security = require("security")

if security.can("env.get", "DATABASE_URL") then
    local url = env.get("DATABASE_URL")
end
```

Siehe [Sicherheitsmodell](../../system/security.md) zur Richtlinienkonfiguration.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leerer Schlüssel | `errors.INVALID` | nein |
| Variable nicht gefunden | `errors.NOT_FOUND` | nein |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` | nein |

Siehe [Fehlerbehandlung](../core/errors.md) für die Arbeit mit Fehlern.

## Siehe auch

- [Umgebungssystem](../../system/env.md) – Speicher-Backends und Variablendefinitionen konfigurieren
