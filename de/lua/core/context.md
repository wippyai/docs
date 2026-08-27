---
title: "Request-Kontext"
description: "Anfragebezogene Werte lesen, die über Funktions- und Prozessaufrufe weitergegeben werden."
---

# Request-Kontext
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Das Modul `ctx` liest anfragebezogene Werte, die über [Funktionsaufrufe](./funcs.md) oder [Prozessoperationen](./process.md) weitergegeben werden. Diese Seite ist eine API-Referenz; die Ausschnitte zeigen einzelne Aufrufe innerhalb eines ausführbaren Lua-Entrys.

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

`ctx.all()` gibt eine leere Tabelle zurück, wenn ein Ausführungskontext vorhanden ist, aber keine Anfragewerte enthält. Fehlt der Ausführungskontext, werden `nil, errors.INTERNAL` zurückgegeben.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leerer Schlüssel | `errors.INVALID` | nein |
| Schlüssel nicht gefunden | `errors.NOT_FOUND` | nein |
| Kein Ausführungskontext verfügbar | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](./errors.md) für den Umgang mit Fehlern.
