---
title: "Protokollierung"
description: "Strukturierte Log-Nachrichten schreiben und Child-Logger mit persistentem Kontext erstellen."
---

# Protokollierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

Das Modul `logger` schreibt strukturierte Nachrichten auf den Stufen Debug, Info, Warn und Error.

Diese Seite ist eine API-Referenz. Jeder Ausschnitt ist eine einzelne Logging-Operation und setzt einen Ausführungskontext mit der gewünschten Logger-Konfiguration voraus.

Log-Aufrufe geben keine Werte zurück. Sofern der Ausführungskontext sie bereitstellt, ergänzt jeder Aufruf außerdem die Prozess-`pid` und die aus dem aktuellen Frame abgeleitete `location`.

## Laden

```lua
local logger = require("logger")
```

## Log-Levels

### `logger:debug`

Schreibt eine Nachricht der Stufe Debug.

```lua
logger:debug("message", {key = "value"})
```

### `logger:info`

Schreibt eine Nachricht der Stufe Info.

```lua
logger:info("message", {key = "value"})
```

### `logger:warn`

Schreibt eine Nachricht der Stufe Warn.

```lua
logger:warn("message", {key = "value"})
```

### `logger:error`

Schreibt eine Nachricht der Stufe Error.

```lua
logger:error("message", {key = "value"})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `message` | string | Log-Nachricht |
| `fields` | table? | Kontextuelle Schlüssel-Wert-Paare |

Alle vier Log-Methoden akzeptieren dieselben Parameter. Nur Zeichenkettenschlüssel werden zu Feldnamen. Zeichenketten, Zahlen, Ganzzahlen, boolesche Werte, Fehler und strukturierte Lua-Werte werden in Log-Felder konvertiert; andere Schlüssel werden ignoriert.

Bei `logger:error` wird ein Feld namens `error` als Fehlerfeld ausgegeben und aus der übergebenen Tabelle entfernt, bevor die übrigen Felder verarbeitet werden. Verwenden Sie diese Tabelle nicht erneut, wenn der Eintrag `error` erhalten bleiben muss.

## Logger-Anpassung

### `logger:with`

Erstellt einen Child-Logger mit persistenten Feldern.

```lua
local function request_logger(request_id)
    return logger:with({request_id = request_id})
end

request_logger("req-123"):info("message")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `fields` | table | Felder, die an alle Logs angehangt werden |

**Gibt zurück:** `Logger`

Der ursprüngliche Logger bleibt unverändert. Child-Logger können mit weiteren Aufrufen von `with` und `named` verkettet werden.

### `logger:named`

Erstellt einen benannten Child-Logger.

```lua
local named = logger:named("auth")
named:info("message")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Logger-Name |

**Gibt zurück:** `Logger`

Ein leerer Name löst einen Lua-Argumentfehler aus; er wird nicht als strukturierter Wert `errors.INVALID` zurückgegeben.

Die Logging-Methoden geben keine strukturierten Fehler zurück. Ungültige Argumenttypen lösen Lua-Argumentfehler aus. Ist dem Ausführungskontext kein Logger zugeordnet, verwirft ein No-op-Logger die Nachricht.
