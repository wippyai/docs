---
title: "Terminal"
description: "Terminal-Hosts führen Lua-Skripte mit stdin/stdout/stderr-Zugriff aus."
---

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

## Komponierbare Terminals

Das Terminal, das ein Prozess sieht, ist ein Port, kein Gerät. Damit wird die Terminal-Zugehörigkeit komponierbar.

Ein Prozess auf einem Terminal-Host hält den physischen Port. Er ruft `tty.surface()` auf, um die Präsentations-Lease des Ports zu übernehmen, und veröffentlicht vollständige Frames — er besitzt den gesamten Bildschirm.

Ein Shell-Prozess hostet andere Prozesse, indem er mit `tty.viewport()` virtuelle Terminals erstellt. Er übergibt `viewport:grant()` über die Spawn-Option `terminal` an einen Kindprozess; der Kindprozess löst diesen Grant in einen gewöhnlichen Terminal-Port auf und läuft unverändert, ohne zu wissen, dass er nicht an einem Gerät hängt. Die Shell liest die Frames des Kindprozesses mit `viewport:snapshot()`, platziert sie beliebig in ihrem eigenen Layout und übersetzt Eingaben mit `viewport:send()` in die Koordinaten des Kindprozesses.

```lua
local view = assert(tty.viewport({width = 78, height = 20}))
local child = assert(process.with_options({terminal = assert(view:grant())})
    :spawn_monitored("app:child", "app:workers"))
```

Ein Grant ist einmalig: Die Prozesszulassung verbraucht ihn, ein abgelehnter Start lässt ihn unaufgelöst, und ein Host, der keine Terminals anhängen kann, lehnt den Spawn ab, statt die Option zu verwerfen.

Byte-orientierte Programme fügen sich über `exec` in dasselbe Modell ein. Ein Kindprozess allokiert einen PTY-Prozess und ruft `process:attach_terminal()` auf; dieser Adapter übernimmt PTY-Emulation, Eingabekodierung, Größenänderung und Beendigung und präsentiert auf dem Port, den der Kindprozess hält — physisch oder virtuell.

```text
physisches Terminal -> Shell-Surface -> Viewport -> Kindprozess -> PTY-Proxy
```

## Lua-API

Das [IO-Modul](lua/system/io.md) bietet zeilenorientierte Terminal-Operationen:

```lua
local io = require("io")

io.write("Name eingeben: ")
local name = io.readline()
io.print("Hallo, " .. name)

local args = io.args()
```

Funktionen geben Fehler zurück wenn sie außerhalb eines Terminal-Kontexts aufgerufen werden.

Für rohe Eingabeereignisse, gestaltetes Rendering, Surfaces und Viewports siehe [TTY](lua/system/tty.md). Für PTY-Prozesse und Terminal-Sessions siehe [Kommandoausführung](lua/dynamic/exec.md).

## Siehe auch

- [Terminal I/O](lua/system/io.md) — stdin/stdout/stderr-Operationen
- [TTY](lua/system/tty.md) — Eingabeereignisse, Surfaces, Canvases und Viewports
- [Kommandoausführung](lua/dynamic/exec.md) — PTY-Prozesse und Terminal-Sessions
- [Terminal-UI](tutorials/tty.md) — eine Shell bauen, die einen Kindprozess in einem Viewport hostet
