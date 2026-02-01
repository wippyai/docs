# CLI-Anwendungen

Bauen Sie Kommandozeilen-Tools, die Eingaben lesen, Ausgaben schreiben und mit Benutzern interagieren.

## Was wir bauen

Ein einfaches CLI, das den Benutzer begrüßt:

```
$ wippy run -x app:cli
Hello from CLI!
```

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
  # Terminal-Host verbindet Prozesse mit stdin/stdout
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # CLI-Prozess
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

Ausgabe:
```
Hello from CLI!
```

<note>
Das <code>-x</code>-Flag erkennt automatisch Ihren <code>terminal.host</code> und läuft im stillen Modus für saubere Ausgabe.
</note>

## Benutzereingaben lesen

```lua
local io = require("io")

local function main()
    io.write("Geben Sie Ihren Namen ein: ")
    local name = io.readline()

    if name and #name > 0 then
        io.print("Hallo, " .. name .. "!")
    else
        io.print("Hallo, Fremder!")
    end

    return 0
end

return { main = main }
```

## Farbige Ausgabe

Verwenden Sie ANSI-Escape-Codes für Farben:

```lua
local io = require("io")

local reset = "\027[0m"
local function red(s) return "\027[31m" .. s .. reset end
local function green(s) return "\027[32m" .. s .. reset end
local function yellow(s) return "\027[33m" .. s .. reset end
local function cyan(s) return "\027[36m" .. s .. reset end
local function bold(s) return "\027[1m" .. s .. reset end

local function main()
    io.print(bold(cyan("Willkommen!")))
    io.write(yellow("Geben Sie eine Zahl ein: "))

    local input = io.readline()
    local n = tonumber(input)

    if n then
        io.print("Quadriert: " .. green(tostring(n * n)))
        return 0
    else
        io.print(red("Fehler: ") .. "keine Zahl")
        return 1
    end
end

return { main = main }
```

## Systeminformationen

Zugriff auf Runtime-Statistiken mit dem `system`-Modul:

```yaml
# Zu Entry-Definition hinzufügen
modules:
  - io
  - system
```

```lua
local io = require("io")
local system = require("system")

local function main()
    io.print("Host: " .. system.process.hostname())
    io.print("CPUs: " .. system.runtime.cpu_count())
    io.print("Goroutines: " .. system.runtime.goroutines())

    local mem = system.memory.stats()
    io.print("Speicher: " .. string.format("%.1f MB", mem.heap_alloc / 1024 / 1024))

    return 0
end

return { main = main }
```

## Exit-Codes

Von `main()` zurückgeben um den Exit-Code zu setzen:

```lua
local function main()
    if error_occurred then
        return 1  -- Fehler
    end
    return 0      -- Erfolg
end
```

## I/O-Referenz

| Funktion | Beschreibung |
|----------|--------------|
| `io.print(...)` | Auf stdout schreiben mit Zeilenumbruch |
| `io.write(...)` | Auf stdout schreiben ohne Zeilenumbruch |
| `io.eprint(...)` | Auf stderr schreiben mit Zeilenumbruch |
| `io.readline()` | Zeile von stdin lesen |
| `io.flush()` | Ausgabepuffer leeren |

## CLI-Flags

| Flag | Beschreibung |
|------|--------------|
| `wippy run -x app:cli` | CLI-Prozess ausführen (erkennt terminal.host automatisch) |
| `wippy run -x app:cli --host app:term` | Expliziter Terminal-Host |
| `wippy run -x app:cli -v` | Mit ausführlichem Logging |

## Nächste Schritte

- [I/O-Modul](lua-io.md) - Vollständige I/O-Referenz
- [System-Modul](lua-system.md) - Runtime- und Systeminformationen
- [Echo-Service](echo-service.md) - Multi-Prozess-Anwendungen
