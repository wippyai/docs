# Terminal

Terminal-Hosts führen Lua-Skripte mit stdin/stdout/stderr-Zugriff aus.

<note>
Ein Terminal-Host führt genau einen Prozess gleichzeitig aus. Der Prozess selbst ist ein regulärer Lua-Prozess mit Zugriff auf Terminal-I/O-Kontext.
</note>

## Entry-Typ

| Kind | Beschreibung |
|------|--------------|
| `terminal.host` | Terminal-Sitzungs-Host |

## Konfiguration

```yaml
- name: cli_host
  kind: terminal.host
  hide_logs: false
  lifecycle:
    auto_start: true
```

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `hide_logs` | bool | false | Log-Ausgabe zum Event-Bus unterdrücken |

## Terminal-Kontext

Skripte, die auf einem Terminal-Host laufen, erhalten einen Terminal-Kontext mit:

- **stdin** - Standard-Eingabe-Reader
- **stdout** - Standard-Ausgabe-Writer
- **stderr** - Standard-Fehler-Writer
- **args** - Kommandozeilenargumente

## Lua-API

Das [IO-Modul](lua/system/io.md) bietet Terminal-Operationen:

```lua
local io = require("io")

io.write("Name eingeben: ")
local name = io.readline()
io.print("Hallo, " .. name)

local args = io.args()
```

Funktionen geben Fehler zurück wenn sie außerhalb eines Terminal-Kontexts aufgerufen werden.
