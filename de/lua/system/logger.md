# Protokollierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
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
| `fields` | table? | Kontextuelle Schlussel-Wert-Paare |

### Info

```lua
logger:info("message", {key = "value"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `message` | string | Log-Nachricht |
| `fields` | table? | Kontextuelle Schlussel-Wert-Paare |

### Warn

```lua
logger:warn("message", {key = "value"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `message` | string | Log-Nachricht |
| `fields` | table? | Kontextuelle Schlussel-Wert-Paare |

### Error

```lua
logger:error("message", {key = "value"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `message` | string | Log-Nachricht |
| `fields` | table? | Kontextuelle Schlussel-Wert-Paare |

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

**Gibt zuruck:** `Logger`

### Benannter Logger

Erstellt einen benannten Child-Logger.

```lua
local named = logger:named("auth")
named:info("message")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Logger-Name |

**Gibt zuruck:** `Logger`

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leerer Name-String | `errors.INVALID` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) fur die Arbeit mit Fehlern.
