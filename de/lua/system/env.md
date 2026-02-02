# Umgebungsvariablen
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Zugriff auf Umgebungsvariablen für Konfigurationswerte, Secrets und Laufzeiteinstellungen.

Variablen müssen im [Umgebungssystem](system/env.md) definiert werden, bevor auf sie zugegriffen werden kann. Das System steuert, welche Speicher-Backends (OS, Datei, Speicher) Werte liefern und ob Variablen schreibgeschützt sind.

## Laden

```lua
local env = require("env")
```

## get

Holt einen Umgebungsvariablenwert.

```lua
-- Datenbankverbindungsstring holen
local db_url = env.get("DATABASE_URL")
if not db_url then
    return nil, errors.new("INVALID", "DATABASE_URL not configured")
end

-- Mit Fallback holen
local port = env.get("PORT") or "8080"
local host = env.get("HOST") or "localhost"

-- Secrets holen
local api_key = env.get("API_SECRET_KEY")
local jwt_secret = env.get("JWT_SECRET")

-- Konfiguration
local log_level = env.get("LOG_LEVEL") or "info"
local debug_mode = env.get("DEBUG") == "true"
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Variablenname |

**Gibt zurück:** `string, error`

Gibt `nil, error` zurück, wenn Variable nicht existiert.

## set

Setzt eine Umgebungsvariable.

```lua
-- Laufzeitkonfiguration setzen
env.set("APP_MODE", "production")

-- Für Tests überschreiben
env.set("API_URL", "http://localhost:8080")

-- Basierend auf Bedingungen setzen
if is_development then
    env.set("LOG_LEVEL", "debug")
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Variablenname |
| `value` | string | Zu setzender Wert |

**Gibt zurück:** `boolean, error`

## get_all

Holt alle zugänglichen Umgebungsvariablen.

```lua
local vars = env.get_all()

-- Konfiguration protokollieren (achten Sie darauf, keine Secrets zu protokollieren)
for key, value in pairs(vars) do
    if not key:match("SECRET") and not key:match("KEY") then
        logger.debug("env", {[key] = value})
    end
end

-- Erforderliche Variablen prüfen
local required = {"DATABASE_URL", "REDIS_URL", "API_KEY"}
for _, key in ipairs(required) do
    if not vars[key] then
        return nil, errors.new("INVALID", "Missing required env var: " .. key)
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
| `env.get_all` | `*` | Alle Variablen auflisten |

### Zugriff prüfen

```lua
local security = require("security")

if security.can("env.get", "DATABASE_URL") then
    local url = env.get("DATABASE_URL")
end
```

Siehe [Sicherheitsmodell](system/security.md) für Richtlinienkonfiguration.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leerer Schlüssel | `errors.INVALID` | nein |
| Variable nicht gefunden | `errors.NOT_FOUND` | nein |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` | nein |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.

## Siehe auch

- [Umgebungssystem](system/env.md) - Speicher-Backends und Variablendefinitionen konfigurieren
