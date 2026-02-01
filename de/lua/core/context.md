# Request-Kontext
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Zugriff auf request-spezifische Kontextwerte. Der Kontext wird uber [Funcs](lua-funcs.md) oder [Process](lua-process.md) gesetzt.

## Laden

```lua
local ctx = require("ctx")
```

## Kontextzugriff

### Wert abrufen

```lua
local value, err = ctx.get("key")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `key` | string | Kontextschlussel |

**Gibt zuruck:** `any, error`

### Alle Werte abrufen

```lua
local values, err = ctx.all()
```

**Gibt zuruck:** `table, error`

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leerer Schlussel | `errors.INVALID` | nein |
| Schlussel nicht gefunden | `errors.NOT_FOUND` | nein |
| Kein Kontext verfugbar | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) fur die Arbeit mit Fehlern.
