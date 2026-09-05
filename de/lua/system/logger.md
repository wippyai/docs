---
title: "Protokollierung"
description: "Strukturierte Protokollierung mit debug, info, warn und error Levels."
---

# Protokollierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Strukturierte Protokollierung mit debug, info, warn und error Levels.

## Laden

```lua
local logger = require("logger")
```

## Log-Levels

### Debug

```lua
logger:debug("message", {key = "value"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `message` | string | Log-Nachricht |
| `fields` | table? | Kontextuelle Schlüssel-Wert-Paare |

### Info

```lua
logger:info("message", {key = "value"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `message` | string | Log-Nachricht |
| `fields` | table? | Kontextuelle Schlüssel-Wert-Paare |

### Warn

```lua
logger:warn("message", {key = "value"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `message` | string | Log-Nachricht |
| `fields` | table? | Kontextuelle Schlüssel-Wert-Paare |

### Error

```lua
logger:error("message", {key = "value"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `message` | string | Log-Nachricht |
| `fields` | table? | Kontextuelle Schlüssel-Wert-Paare |

## Logger-Anpassung

### Mit Feldern

Erstellt einen Child-Logger mit persistenten Feldern.

```lua
local child = logger:with({request_id = id})
child:info("message")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `fields` | table | Felder, die an alle Logs angehangt werden |

**Gibt zurück:** `Logger`

### Benannter Logger

Erstellt einen benannten Child-Logger.

```lua
local named = logger:named("auth")
named:info("message")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Logger-Name |

**Gibt zurück:** `Logger`

## Fehler

`logger:named("")` löst einen Lua-Argumentfehler aus (`name cannot be empty`), statt einen Fehlerwert zurückzugeben. Logging-Methoden geben nichts zurück.

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
