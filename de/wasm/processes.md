# WASM-Prozesse

WASM-Module koennen als Prozesse ueber den Entry Kind `process.wasm` ausgefuehrt werden. Prozesse laufen innerhalb des Wippy-Process-Hosts und unterstuetzen den vollstaendigen Prozesslebenszyklus: Starten, Ueberwachen und ueberwachtes Herunterfahren.

## Entry-Konfiguration

```yaml
entries:
  - name: wasm_binaries
    kind: fs.directory
    directory: ./wasm

  - name: compute_worker
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /worker.wasm
    hash: sha256:292b796376f8b4cc360acf2ea6b82d1084871c3607a079f30b446da8e5c984a4
    method: compute
```

### Konfigurationsfelder

| Field | Required | Beschreibung |
|-------|----------|-------------|
| `fs` | Yes | Dateisystem-Entry-ID, die das Binary enthaelt |
| `path` | Yes | Pfad zur `.wasm`-Datei innerhalb des Dateisystems |
| `hash` | Yes | SHA-256-Hash zur Integritaetspruefung |
| `method` | Yes | Name der exportierten Funktion zur Ausfuehrung |
| `imports` | No | Host-Imports zum Aktivieren |
| `wasi` | No | WASI-Konfiguration (args, env, mounts) |
| `limits` | No | Ausfuehrungslimits |

## CLI-Befehle

Registrieren Sie einen WASM-Prozess als benannten Befehl mit `meta.command`:

```yaml
  - name: greet
    kind: process.wasm
    meta:
      command:
        name: greet
        short: Greet someone via WASM
    fs: myns:wasm_binaries
    path: /component.wasm
    hash: sha256:...
    method: greet
```

Ausfuehren mit:

```bash
wippy run greet
```

Verfuegbare Befehle auflisten:

```bash
wippy run list
```

| Field | Required | Beschreibung |
|-------|----------|-------------|
| `name` | Yes | Befehlsname, verwendet mit `wippy run <name>` |
| `short` | No | Kurzbeschreibung, angezeigt in `wippy run list` |

Ein `terminal.host` und `process.host` muessen vorhanden sein, damit CLI-Befehle funktionieren.

## Prozesslebenszyklus

WASM-Prozesse folgen dem Init/Step/Close-Lebenszyklusmodell:

1. **Init** - Modul wird instanziiert, Eingabeargumente werden erfasst
2. **Step** - Ausfuehrung schreitet voran. Bei asynchronen Modulen steuert der Scheduler Yield/Resume-Zyklen. Bei synchronen Modulen wird die Ausfuehrung in einem einzigen Schritt abgeschlossen.
3. **Close** - Instanzressourcen werden freigegeben

## Starten aus Lua

Starten Sie einen WASM-Prozess und ueberwachen Sie ihn bis zum Abschluss:

```lua
local process = require("process")
local time = require("time")

-- Spawn with monitoring
local pid, err = process.spawn_monitored(
    "myns:compute_worker",   -- entry ID
    "myns:processes",        -- process group
    6, 7                     -- arguments passed to the WASM function
)

if err then
    error("spawn failed: " .. tostring(err))
end

-- Wait for the process to complete
local event = process.receive(time.seconds(10))
if event and event.type == "EXIT" then
    local result = event.value  -- return value from the WASM function
end
```

## Asynchrone Ausfuehrung

WASM-Prozesse, die WASI-Schnittstellen importieren, koennen asynchrone Operationen ausfuehren. Der Scheduler suspendiert den Prozess waehrend I/O und setzt ihn fort, wenn die Operation abgeschlossen ist:

```yaml
  - name: http_worker
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /http_worker.wasm
    hash: sha256:...
    method: run
    imports:
      - wasi:io
      - wasi:cli
      - wasi:http
    wasi:
      env:
        - id: myns:api_url
          name: API_URL
          required: true
```

Der Yield/Resume-Mechanismus ist fuer den WASM-Code transparent. Standard-blockierende Aufrufe im Guest (Sleep, Read, Write, HTTP-Anfragen) yielden automatisch an den Dispatcher.

## WASI-Konfiguration

Prozesse unterstuetzen dieselbe WASI-Konfiguration wie Funktionen:

```yaml
  - name: file_processor
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /processor.wasm
    hash: sha256:...
    method: process
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
    wasi:
      args: ["--input", "/data/input.csv"]
      cwd: "/app"
      env:
        - id: myns:output_format
          name: OUTPUT_FORMAT
      mounts:
        - fs: myns:input_data
          guest: /data
          read_only: true
        - fs: myns:output_dir
          guest: /output
```

## Siehe auch

- [Uebersicht](wasm/overview.md) - WebAssembly-Runtime-Uebersicht
- [Funktionen](wasm/functions.md) - WASM-Funktionskonfiguration
- [Host-Funktionen](wasm/hosts.md) - Verfuegbare Host-Schnittstellen
- [Prozessmodell](concepts/process-model.md) - Prozesslebenszyklus
- [Supervision](guides/supervision.md) - Prozess-Supervision-Baeume
