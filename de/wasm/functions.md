---
title: "WASM-Funktionen"
description: "Inline-WAT-Funktionen und vorkompilierte WASM-Funktionen als Registry-Einträge konfigurieren."
---

# WASM-Funktionen

Verwenden Sie `function.wat` für Inline-Quellcode im WebAssembly-Textformat und `function.wasm` für vorkompilierte Binärdateien.

**Klassifizierung: Referenz zur Funktionskonfiguration.** WAT-Blöcke sind kleine
Registry-Beispiele. Vorkompilierte Beispiele setzen einen externen Komponenten-Build,
einen Dateisystemeintrag, zum Gast-WIT passende exportierte Methoden und einen aus
der exakten Binärdatei berechneten SHA-256-Digest voraus. Realistisch aussehende Beispiel-Hashes dienen nur zur Veranschaulichung.

## Inline-WAT-Funktionen

Definieren Sie eine WAT-Funktion direkt in `_index.yaml`:

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

Verwenden Sie für größere WAT-Quellen eine Dateireferenz:

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

| Feld | Erforderlich | Beschreibung |
|------|--------------|--------------|
| `source` | Ja | Inline-WAT-Quelle oder `file://`-Referenz |
| `method` | Ja | Name der aufzurufenden exportierten Funktion |
| `wit` | Nein | WIT-Signatur für Raw/Core-Module |
| `pool` | Nein | Worker-Pool-Konfiguration |
| `transport` | Nein | Ein-/Ausgabeabbildung (Standard: `payload`) |
| `imports` | Nein | Zu aktivierende Host-Imports (z. B. `wasi:cli`, `wasi:io`) |
| `wasi` | Nein | WASI-Konfiguration (args, env, mounts) |
| `limits` | Nein | Ausführungslimits |

## Vorkompilierte WASM-Funktionen

Laden Sie kompilierte `.wasm`-Binärdateien aus einem Dateisystemeintrag:

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

| Feld | Erforderlich | Beschreibung |
|------|--------------|--------------|
| `fs` | Ja | ID des Dateisystemeintrags mit der Binärdatei |
| `path` | Ja | Pfad zur `.wasm`-Datei innerhalb des Dateisystems |
| `hash` | Ja | SHA-256-Hash für die Integritätsprüfung (`sha256:...`) |
| `method` | Ja | Name der aufzurufenden exportierten Funktion |
| `wit` | Nein | WIT-Signatur für Raw/Core-Module |
| `pool` | Nein | Worker-Pool-Konfiguration |
| `transport` | Nein | Ein-/Ausgabeabbildung (Standard: `payload`) |
| `imports` | Nein | Zu aktivierende Host-Imports |
| `wasi` | Nein | WASI-Konfiguration |
| `limits` | Nein | Ausführungslimits |

## Worker-Pools

Jede WASM-Funktion verwendet einen Pool vorkompilierter Instanzen. Der Pool-Typ steuert Parallelität und Ressourcenverbrauch.

| Typ | Beschreibung |
|-----|--------------|
| `inline` | Durch Mutex serialisiert. Synchrone und asyncifizierte Aufrufe verwenden eine warme Instanz erneut; die Richtlinie für beibehaltenen Speicher oder ein Ausführungsfehler kann einen Austausch auslösen. |
| `lazy` | Keine inaktiven Worker. Skaliert bei Bedarf bis `max_size`. |
| `static` | Feste Anzahl von Workern mit Request-Queue. |
| `adaptive` | Automatisch skalierender elastischer Pool. |

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
```

Der Standard von 100 Workern gilt nur fuer den implizit gewaehlten Pool (wenn kein `type` gesetzt ist). Wird `type: lazy` oder `type: adaptive` explizit ohne `max_size` gesetzt, betraegt das Standard-Maximum 16 Worker.

### Worker-Klassen und Core-Affinität

Mit `pool.worker_class` wird die Funktion an einen dedizierten Pool aus an OS-Threads gebundenen Workern statt an die oben beschriebenen gemeinsam genutzten Pool-Typen geleitet (`type` wird dann ignoriert; konventioneller Name: `wasm`):

```yaml
pool:
  worker_class: wasm
  workers: 8         # optional; defaults to reserved cores, else min(NumCPU, 4)
```

Die Core-Isolation wird pro Runtime in `.wippy.yaml` aktiviert:

```yaml
scheduler:
  wasm_isolation:
    enabled: true      # default: false
    reserved_cores: 2  # cores reserved for WASM pools (default: 1)
```

Bei aktivierter Isolation laufen der Actor-Scheduler und die gebundenen WASM-Pools auf getrennten CPU-Mengen (`sched_setaffinity`, nur Linux — auf anderen Plattformen werden die Pools dimensioniert, die Threads jedoch nicht gebunden). Langlebige WASM-Aufrufe können das Actor-Scheduling dann nicht aushungern.

## Transports

Transports steuern, wie Ein- und Ausgaben zwischen der Runtime und dem WASM-Modul abgebildet werden.

| Transport | Beschreibung |
|-----------|--------------|
| `payload` | Bildet Runtime-Payloads direkt auf WASM-Aufrufargumente ab (Standard) |
| `wasi-http` | Bildet HTTP-Request-/Response-Kontext auf WASM-Argumente und -Ergebnisse ab |

### Payload-Transport

Der Standard-Transport übergibt Argumente direkt. Lua-Werte werden in Go-Typen transkodiert und anschließend in WIT-Typen abgesenkt:

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
if err then return nil, err end
-- result: 42
```

### WASI-HTTP-Transport

Der Transport `wasi-http` bildet HTTP-Anfragen auf WASM ab und schreibt die Ergebnisse in die HTTP-Response. Verwenden Sie ihn, um WASM-Funktionen als HTTP-Endpunkte bereitzustellen:

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
    meta:
      router: myns:api
    method: POST
    path: /api/greet
    func: greet_wasm
```

## Ausführungslimits

Der Block `options.limits` begrenzt die Ausfuehrungszeit einer Funktion, den Speicher ihres warmen Workers und die Sockets, die sie oeffnen darf:

```yaml
options:
  limits:
    max_execution_ms: 5000
    max_retained_memory_bytes: 134217728
    retained_memory_check_interval: 32
    max_open_sockets: 8
    socket_timeout_ms: 5000
```

| Feld | Standard | Beschreibung |
|------|----------|--------------|
| `max_execution_ms` | unbegrenzt | Wanduhr-Budget fuer einen Aufruf. Bei Ueberschreitung wird die Ausfuehrung abgebrochen und ein Fehler zurueckgegeben. |
| `max_retained_memory_bytes` | `67108864` (64 MiB) | Ausloeser fuer das Recycling nach einem Aufruf. Ein warmer Worker, dessen linearer Speicher diesen Wert ueberschreitet, wird nach dem Aufruf ausgemustert statt wiederverwendet. Eine explizite `0` schaltet das Speicher-Recycling ab. |
| `retained_memory_check_interval` | `16` beim eingebauten Limit, jeder Aufruf bei einem expliziten Limit | Anzahl der Aufrufe zwischen den Speicherpruefungen nach einem Aufruf. |
| `max_open_sockets` | `16` | Gleichzeitig offene Verbindungen pro Instanz fuer den `socket`-Host. |
| `socket_timeout_ms` | `30000` | Deadline fuer einen `socket`-Verbindungsaufbau und fuer jedes Senden/Empfangen. |

Negative Werte werden beim Boot abgelehnt.

## WASI-Konfiguration

Konfigurieren Sie die WASI-Fähigkeiten des Gastmoduls:

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

| Feld | Beschreibung |
|------|--------------|
| `args` | Befehlszeilenargumente für den Gast |
| `cwd` | Arbeitsverzeichnis im Gast (muss absolut sein) |
| `env` | Umgebungsvariablen, die aus Registry-Env-Einträgen abgebildet werden |
| `mounts` | Dateisystem-Mounts aus Registry-Dateisystemeinträgen |

Umgebungsvariablen werden zum Aufrufzeitpunkt aus der Umgebungs-Registry aufgelöst. Wenn eine erforderliche Variable nicht gefunden wird, entsteht ein Fehler.

Mount-Pfade müssen absolut und eindeutig sein. Jeder Mount bildet einen Runtime-Dateisystemeintrag auf einen Gast-Verzeichnispfad ab.

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
if err then return nil, err end

-- Filter: returns only active users
local active, filter_err = funcs.call("myns:filter_active", users)
if filter_err then return nil, filter_err end
```

### Asynchrones Sleep mit WASI Clocks

WASM-Komponenten, die `wasi:clocks`, `wasi:io` und `wasi:poll` importieren, koennen Clocks und Polling verwenden. Der asynchrone Yield-Mechanismus integriert sich in den Wippy-Dispatcher:

```yaml
  - name: sleep_ms
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /sleep_test.wasm
    hash: sha256:...
    method: "test-sleep#sleep-ms"
    imports:
      - wasi:io
      - wasi:poll
      - wasi:clocks
    pool:
      type: inline
```

Das Trennzeichen `#` im Methodenfeld verweist auf eine Schnittstellenmethode: `test-sleep#sleep-ms` ruft die Funktion `sleep-ms` der Schnittstelle `test-sleep` auf.

## Siehe auch

- [Übersicht](wasm/overview.md) - Übersicht über die WebAssembly-Runtime
- [Host-Funktionen](wasm/hosts.md) - Verfügbare Host-Schnittstellen
- [Prozesse](wasm/processes.md) - WASM als Prozesse ausführen
- [Eintragsarten](guides/entry-kinds.md) - Alle Arten von Registry-Einträgen
