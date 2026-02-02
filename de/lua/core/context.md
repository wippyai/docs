# Request-Kontext
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Zugriff auf anfragespezifische Kontextwerte. Der Kontext wird über [Funcs](lua/core/funcs.md) oder [Process](lua/core/process.md) gesetzt.

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
| `key` | string | Kontextschlüssel |

**Gibt zurück:** `any, error`

### Alle Werte abrufen

```lua
local values, err = ctx.all()
```

**Gibt zurück:** `table, error`

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leerer Schlüssel | `errors.INVALID` | nein |
| Schlüssel nicht gefunden | `errors.NOT_FOUND` | nein |
| Kein Kontext verfügbar | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
