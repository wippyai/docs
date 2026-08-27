---
title: "Terminal"
description: "Terminal-Hosts führen Lua-Skripte mit stdin/stdout/stderr-Zugriff aus."
---

# Terminal

Ein `terminal.host` führt Lua-Skripte mit Standard-Eingabe-, Standard-Ausgabe- und Standard-Fehlerströmen aus. Diese Seite ist eine Konfigurationsreferenz; das Lua-Beispiel ist ein Handler-Fragment, das die Ausführung über diesen Host voraussetzt.

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
| `hide_logs` | bool | false | Logs an den Event-Bus streamen und dabei die nachgelagerte Log-Weiterleitung unterdrücken |

## Terminal-Kontext

Skripte, die auf einem Terminal-Host laufen, erhalten einen Terminal-Kontext mit:

- **stdin** - Standard-Eingabe-Reader
- **stdout** - Standard-Ausgabe-Writer
- **stderr** - Standard-Fehler-Writer
- **args** - Kommandozeilenargumente

## Lua-API

Das [IO-Modul](../lua/system/io.md) bietet Terminal-Operationen:

```lua
local io = require("io")

local _, write_err = io.write("Enter name: ")
if write_err then return nil, write_err end

local name, read_err = io.readline()
if read_err then return nil, read_err end

local _, print_err = io.print("Hello, " .. name)
if print_err then return nil, print_err end

local args = io.args()
```

`io.write`, `io.print` und `io.readline` geben außerhalb eines Terminal-Kontexts Fehler zurück. `io.args()` gibt eine leere Tabelle zurück, wenn kein Terminal-Kontext verfügbar ist.

## Siehe auch

- [Terminal I/O](../lua/system/io.md) — stdin/stdout/stderr-Operationen
- [TTY](../lua/system/tty.md) — Rohe Eingabeereignisse, Styles und Layout
