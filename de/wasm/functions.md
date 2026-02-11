# WASM-Funktionen

WASM-Funktionen sind Registry-Eintraege, die WebAssembly-Code ausfuehren. Zwei Entry Kinds stehen zur Verfuegung: `function.wat` fuer Inline-WAT-Quellcode und `function.wasm` fuer vorkompilierte Binaries.

## Inline-WAT-Funktionen

Definieren Sie kleine WASM-Funktionen direkt in Ihrer `_index.yaml` im WebAssembly-Text-Format:

```yaml
entries:
  - name: answer
    kind: function.wat
    source: |
      (module
        (func (export "answer") (result i32)
          i32.const 42
        )
      )
    wit: |
      answer: func() -> s32;
    method: answer
    pool:
      type: inline
```

Fuer groessere WAT-Quellen verwenden Sie eine Dateireferenz:

```yaml
  - name: answer
    kind: function.wat
    source: file://answer.wat
    wit: |
      answer: func() -> s32;
    method: answer
    pool:
      type: inline
```

### WAT-Konfigurationsfelder

| Field | Required | Beschreibung |
|-------|----------|-------------|
| `source` | Yes | Inline-WAT-Quellcode oder `file://`-Referenz |
| `method` | Yes | Name der exportierten Funktion, die aufgerufen wird |
| `wit` | No | WIT-Signatur fuer Raw/Core-Module |
| `pool` | No | Worker-Pool-Konfiguration |
| `transport` | No | Input/Output-Mapping (Standard: `payload`) |
| `imports` | No | Host-Imports zum Aktivieren (z.B. `wasi:cli`, `wasi:io`) |
| `wasi` | No | WASI-Konfiguration (args, env, mounts) |
| `limits` | No | Ausfuehrungslimits |

## Vorkompilierte WASM-Funktionen

Laden Sie kompilierte `.wasm`-Binaries aus einem Dateisystem-Eintrag:

```yaml
entries:
  - name: assets
    kind: fs.directory
    directory: ./wasm

  - name: compute
    kind: function.wasm
    fs: myns:assets
    path: /compute.wasm
    hash: sha256:292b796376f8b4cc360acf2ea6b82d1084871c3607a079f30b446da8e5c984a4
    method: compute
    pool:
      type: lazy
      max_size: 4
```

### WASM-Konfigurationsfelder

| Field | Required | Beschreibung |
|-------|----------|-------------|
| `fs` | Yes | Dateisystem-Entry-ID, die das Binary enthaelt |
| `path` | Yes | Pfad zur `.wasm`-Datei innerhalb des Dateisystems |
| `hash` | Yes | SHA-256-Hash zur Integritaetspruefung (`sha256:...`) |
| `method` | Yes | Name der exportierten Funktion, die aufgerufen wird |
| `wit` | No | WIT-Signatur fuer Raw/Core-Module |
| `pool` | No | Worker-Pool-Konfiguration |
| `transport` | No | Input/Output-Mapping (Standard: `payload`) |
| `imports` | No | Host-Imports zum Aktivieren |
| `wasi` | No | WASI-Konfiguration |
| `limits` | No | Ausfuehrungslimits |

## Worker-Pools

Jede WASM-Funktion verwendet einen Pool vorkompilierter Instanzen. Der Pool-Typ steuert Nebenlaeufigkeit und Ressourcenverbrauch.

| Type | Beschreibung |
|------|-------------|
| `inline` | Synchron, single-threaded. Neue Instanz pro Aufruf. |
| `lazy` | Keine Idle-Worker. Skaliert bei Bedarf bis `max_size`. |
| `static` | Feste Anzahl von Workern mit Request-Queue. |
| `adaptive` | Automatisch skalierende elastische Pools. |

### Pool-Konfiguration

```yaml
pool:
  type: static
  size: 4            # Total pool size
  workers: 2         # Worker threads
  buffer: 16         # Request queue buffer (default: workers * 64)
```

```yaml
pool:
  type: lazy
  max_size: 8        # Maximum concurrent instances
```

```yaml
pool:
  type: adaptive
  max_size: 16       # Upper scaling bound
  warm_start: true   # Pre-instantiate initial workers
```

Das Standard-Maximum fuer elastische Pools betraegt 100 Worker, wenn `max_size` nicht angegeben ist.

## Transports

Transports steuern, wie Input und Output zwischen der Runtime und dem WASM-Modul abgebildet werden.

| Transport | Beschreibung |
|-----------|-------------|
| `payload` | Bildet Runtime-Payloads direkt auf WASM-Aufrufargumente ab (Standard) |
| `wasi-http` | Bildet HTTP-Request/Response-Kontext auf WASM-Argumente und -Ergebnisse ab |

### Payload-Transport

Der Standard-Transport uebergibt Argumente direkt. Lua-Werte werden in Go-Typen transkodiert und dann in WIT-Typen abgesenkt:

```yaml
  - name: compute
    kind: function.wasm
    fs: myns:assets
    path: /compute.wasm
    hash: sha256:...
    method: compute
    pool:
      type: inline
```

```lua
-- Arguments passed directly as WASM function parameters
local result, err = funcs.call("myns:compute", 6, 7)
-- result: 42
```

### WASI-HTTP-Transport

Der `wasi-http`-Transport bildet HTTP-Requests auf WASM ab und schreibt Ergebnisse zurueck in die HTTP-Response. Verwenden Sie ihn, um WASM-Funktionen als HTTP-Endpunkte bereitzustellen:

```yaml
  - name: greet_wasm
    kind: function.wasm
    fs: myns:assets
    path: /greet.wasm
    hash: sha256:...
    method: greet
    transport: wasi-http
    pool:
      type: inline

  - name: greet_endpoint
    kind: http.endpoint
    method: POST
    path: /api/greet
    func: greet_wasm
```

## Ausfuehrungslimits

Legen Sie eine maximale Ausfuehrungszeit fuer eine Funktion fest:

```yaml
limits:
  max_execution_ms: 5000   # 5 second timeout
```

Wenn das Limit ueberschritten wird, wird die Ausfuehrung abgebrochen und ein Fehler zurueckgegeben.

## WASI-Konfiguration

Konfigurieren Sie WASI-Faehigkeiten fuer das Guest-Modul:

```yaml
wasi:
  args: ["--verbose"]
  cwd: "/app"
  env:
    - id: myns:api_key
      name: API_KEY
      required: true
    - id: myns:debug_mode
      name: DEBUG
  mounts:
    - fs: myns:data_files
      guest: /data
      read_only: true
    - fs: myns:output
      guest: /output
```

| Field | Beschreibung |
|-------|-------------|
| `args` | Kommandozeilenargumente, die an den Guest uebergeben werden |
| `cwd` | Arbeitsverzeichnis innerhalb des Guest (muss absolut sein) |
| `env` | Umgebungsvariablen, abgebildet aus Registry-Env-Eintraegen |
| `mounts` | Dateisystem-Mounts aus Registry-Dateisystem-Eintraegen |

Umgebungsvariablen werden zum Aufrufzeitpunkt aus der Umgebungs-Registry aufgeloest. Erforderliche Variablen verursachen einen Fehler, wenn sie nicht gefunden werden.

Mount-Pfade muessen absolut und eindeutig sein. Jeder Mount bildet einen Runtime-Dateisystem-Eintrag auf einen Guest-Verzeichnispfad ab.

## Beispiele

### Datentransformations-Pipeline

```yaml
entries:
  - name: wasm_binaries
    kind: fs.directory
    directory: ./wasm

  - name: transform_users
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /mapper.wasm
    hash: sha256:7304fc7d19778605458ae5804dae9a7343dcd3f5fc22bcc9415e98b5047192dd
    method: transform-users
    pool:
      type: lazy
      max_size: 4

  - name: filter_active
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /mapper.wasm
    hash: sha256:7304fc7d19778605458ae5804dae9a7343dcd3f5fc22bcc9415e98b5047192dd
    method: filter-active
    pool:
      type: lazy
      max_size: 4
```

```lua
local funcs = require("funcs")

local users = {
    {id = 1, name = "Alice", tags = {"admin", "dev"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
    {id = 3, name = "Carol", tags = {"dev"}, active = true},
}

-- Transform: adds display field and tag count
local transformed, err = funcs.call("myns:transform_users", users)

-- Filter: returns only active users
local active, err = funcs.call("myns:filter_active", users)
```

### Asynchrones Sleep mit WASI Clocks

WASM-Komponenten, die `wasi:clocks` und `wasi:io` importieren, koennen Clocks und Polling verwenden. Der asynchrone Yield-Mechanismus integriert sich in den Wippy-Dispatcher:

```yaml
  - name: sleep_ms
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /sleep_test.wasm
    hash: sha256:...
    method: "test-sleep#sleep-ms"
    imports:
      - wasi:io
      - wasi:clocks
    pool:
      type: inline
```

Der `#`-Separator im method-Feld referenziert eine Interface-Methode: `test-sleep#sleep-ms` ruft die Funktion `sleep-ms` aus dem Interface `test-sleep` auf.

## Siehe auch

- [Uebersicht](wasm/overview.md) - WebAssembly-Runtime-Uebersicht
- [Host-Funktionen](wasm/hosts.md) - Verfuegbare Host-Schnittstellen
- [Prozesse](wasm/processes.md) - WASM als Prozesse ausfuehren
- [Entry-Typen](guides/entry-kinds.md) - Alle Registry Entry Kinds
