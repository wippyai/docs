---
title: "CLI-Anwendungen"
description: "Bauen Sie Kommandozeilen-Tools, die Eingaben lesen, Ausgaben schreiben und mit Benutzern interagieren."
---

# CLI-Anwendungen

Bauen Sie einen Kommandozeilenprozess, der in das Terminal schreibt, und erweitern Sie ihn anschließend um Eingabe, Farbe, Systeminformationen und benannte Befehle.

**Klassifizierung:** Ausführbares Tutorial. Die Begrüßungsanwendung ist vollständig.
Die späteren Abschnitte sind optionale Ersetzungen für `src/cli.lua` oder den Eintrag
`app:cli`, wie jeweils angegeben.

## Was wir bauen

Ein CLI-Prozess, der eine Begrüßung ausgibt:

```
$ wippy run -x app:cli
Hello from CLI!
```

## Voraussetzungen

- Die Wippy-Runtime `v0.3.32a` ist als `wippy` verfügbar. Prüfen Sie dies mit
  `wippy version --short`.
- Ein interaktives Terminal. Die Eingabebeispiele benötigen stdin, und die
  Farbbeispiele benötigen ein Terminal, das ANSI-Escape-Sequenzen darstellen kann.

## Projektstruktur

```
cli-app/
├── wippy.lock
└── src/
    ├── _index.yaml
    └── cli.lua
```

## Schritt 1: Projekt erstellen

```bash
mkdir cli-app && cd cli-app
mkdir src
```

## Schritt 2: Entry-Definitionen

Erstellen Sie `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # Terminal host connects processes to stdin/stdout
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # CLI process
  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
```

<tip>
Der <code>terminal.host</code> verbindet Ihren Lua-Prozess mit dem Terminal. Ohne ihn hat <code>io.print()</code> kein Ausgabeziel.
</tip>

## Schritt 3: CLI-Code

Erstellen Sie `src/cli.lua`:

```lua
local io = require("io")

local function main()
    io.print("Hello from CLI!")
    return 0
end

return { main = main }
```

## Schritt 4: Ausführen

```bash
wippy init
wippy run -x app:cli
```

Erwartete Ausgabe:
```
Hello from CLI!
```

<note>
Das Flag <code>-x</code> führt den Prozess als Befehl aus. Es erkennt den einzigen
<code>terminal.host</code> in der Registry automatisch; verwenden Sie <code>--host</code>,
wenn mehrere Terminal Hosts vorhanden sind. Ohne Logging-Flag unterdrückt der
Befehlsmodus Runtime-Logs, damit die Prozessausgabe lesbar bleibt.
</note>

## Benutzereingaben lesen

Ersetzen Sie `src/cli.lua` durch diese Version. Sie meldet Fehler beim Lesen und
Schreiben im Terminal, statt sie als leere Eingabe zu behandeln:

```lua
local io = require("io")

local function main()
    local _, write_err = io.write("Enter your name: ")
    if write_err then
        io.eprint("Cannot write prompt:", write_err)
        return 1
    end

    local _, flush_err = io.flush()
    if flush_err then
        io.eprint("Cannot flush prompt:", flush_err)
        return 1
    end

    local name, read_err = io.readline()
    if read_err then
        io.eprint("Cannot read input:", read_err)
        return 1
    end

    if name and #name > 0 then
        io.print("Hello, " .. name .. "!")
    else
        io.print("Hello, stranger!")
    end

    return 0
end

return { main = main }
```

## Farbige Ausgabe

Ersetzen Sie `src/cli.lua` durch diese Version, um ANSI-Escape-Codes für Farben zu verwenden:

```lua
local io = require("io")

local reset = "\027[0m"
local function red(s) return "\027[31m" .. s .. reset end
local function green(s) return "\027[32m" .. s .. reset end
local function yellow(s) return "\027[33m" .. s .. reset end
local function cyan(s) return "\027[36m" .. s .. reset end
local function bold(s) return "\027[1m" .. s .. reset end

local function main()
    io.print(bold(cyan("Welcome!")))
    local _, write_err = io.write(yellow("Enter a number: "))
    if write_err then
        io.eprint("Cannot write prompt:", write_err)
        return 1
    end

    local _, flush_err = io.flush()
    if flush_err then
        io.eprint("Cannot flush prompt:", flush_err)
        return 1
    end

    local input, read_err = io.readline()
    if read_err then
        io.eprint("Cannot read input:", read_err)
        return 1
    end
    local n = tonumber(input)

    if n then
        io.print("Squared: " .. green(tostring(n * n)))
        return 0
    else
        io.print(red("Error: ") .. "not a number")
        return 1
    end
end

return { main = main }
```

## Systeminformationen

Systemabfragen sind geschützte Operationen. Fügen Sie diese Policy hinzu und ersetzen
Sie den Eintrag `app:cli`, damit der Befehl einen Actor, die Policy und das Modul
`system` erhält:

```yaml
  - name: cli-system-read
    kind: security.policy
    policy:
      actions:
        - system.read
      resources: "*"
      effect: allow

  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
      - system
    security:
      actor:
        id: app:cli
      policies:
        - app:cli-system-read
```

Ersetzen Sie anschließend `src/cli.lua`:

```lua
local io = require("io")
local system = require("system")

local function main()
    local hostname, hostname_err = system.process.hostname()
    if hostname_err then
        io.eprint("Cannot read hostname:", hostname_err)
        return 1
    end

    local cpu_count, cpu_err = system.runtime.cpu_count()
    if cpu_err then
        io.eprint("Cannot read CPU count:", cpu_err)
        return 1
    end

    local goroutines, goroutine_err = system.runtime.goroutines()
    if goroutine_err then
        io.eprint("Cannot read goroutine count:", goroutine_err)
        return 1
    end

    local mem, memory_err = system.memory.stats()
    if memory_err then
        io.eprint("Cannot read memory stats:", memory_err)
        return 1
    end

    io.print("Host: " .. hostname)
    io.print("CPUs: " .. cpu_count)
    io.print("Goroutines: " .. goroutines)
    io.print("Memory: " .. string.format("%.1f MB", mem.heap_alloc / 1024 / 1024))

    return 0
end

return { main = main }
```

## Benannte Befehle

Um den Prozess nach Namen statt mit `-x app:cli` aufzurufen, fügen Sie Command-Metadaten hinzu:

Ersetzen Sie den Eintrag `app:cli` durch diese Version. Behalten Sie den Eintrag
`terminal.host` aus dem Basisprojekt bei.

```yaml
  - name: cli
    kind: process.lua
    meta:
      command:
        name: greet
        short: Greet the user
    source: file://cli.lua
    method: main
    modules:
      - io
```

Führen Sie den benannten Befehl aus:

```bash
wippy run greet
```

Listen Sie alle verfügbaren Befehle auf:

```bash
wippy run list
```

```
Available commands:

  greet  Greet the user  (app:cli)

Run with: wippy run <command>
```

## Exit-Codes

Geben Sie aus `main()` eine Zahl zurück, um den Exit-Code festzulegen:

```lua
local function main()
    if error_occurred then
        return 1  -- Error
    end
    return 0      -- Success
end
```

## I/O-Referenz

| Funktion | Rückgabe | Beschreibung |
|----------|----------|--------------|
| `io.print(...)` | `boolean` oder ohne Terminal-Kontext `nil, error` | Mit Tabs und abschließendem Zeilenumbruch nach stdout schreiben |
| `io.write(...)` | `boolean, error` | Ohne Trennzeichen oder Zeilenumbruch nach stdout schreiben |
| `io.eprint(...)` | `boolean` oder ohne Terminal-Kontext `nil, error` | Mit Tabs und abschließendem Zeilenumbruch nach stderr schreiben |
| `io.readline()` | `string, error` | Eine Zeile ohne abschließenden Zeilenumbruch lesen; EOF ohne Daten ist ein Fehler |
| `io.flush()` | `boolean, error` | stdout leeren, wenn der Stream dies unterstützt |

## CLI-Flags

| Flag | Beschreibung |
|------|--------------|
| `wippy run -x app:cli` | CLI-Prozess ausführen (erkennt terminal.host automatisch) |
| `wippy run -x app:cli --host app:terminal` | Expliziter Terminal Host |
| `wippy run -x app:cli -v` | Mit ausführlichem Logging |

## Fehlerbehebung und Bereinigung

- `no terminal host found` bedeutet, dass die Registry keinen `terminal.host`
  enthält; verwenden Sie den Eintrag aus Schritt 2. Wenn mehrere Hosts vorhanden
  sind, übergeben Sie `--host app:terminal`.
- `no terminal context` bedeutet, dass der Prozess nicht über einen Terminal Host
  gestartet wurde. Verwenden Sie `wippy run -x app:cli` statt eines im Hintergrund
  laufenden `process.service`.
- Eingabefehler bei EOF sind zu erwarten, wenn stdin geschlossen ist. Führen Sie
  die Eingabebeispiele in einem interaktiven Terminal aus.
- Wenn ANSI-Sequenzen als Zeichen angezeigt werden, verwenden Sie das Beispiel ohne
  Farben oder ein Terminal mit ANSI-Unterstützung.
- Der Befehl endet, wenn `main()` zurückkehrt. Löschen Sie nach dem Verlassen des
  Verzeichnisses `cli-app/`, wenn es nur eine vorübergehende Übung war.

## Nächste Schritte

- [I/O-Modul](lua/system/io.md) — Referenz der I/O-API
- [Systemmodul](lua/system/system.md) — Runtime- und Systeminformationen
- [Echo-Service](tutorials/echo-service.md) — Eine Anwendung mit mehreren Prozessen bauen
