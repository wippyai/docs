# Host-Funktionen

WASM-Module greifen ueber Host-Funktions-Imports auf Runtime-Faehigkeiten zu. Jeder Import wird explizit pro Eintrag in der `imports`-Liste deklariert.

## Import-Typen

| Import | Beschreibung |
|--------|-------------|
| `wasi:cli` | Umgebung, Exit, stdin/stdout/stderr, Terminal |
| `wasi:io` | Streams, Fehlerbehandlung, Polling |
| `wasi:clocks` | Wall Clock und Monotonic Clock |
| `wasi:filesystem` | Dateisystemzugriff ueber gemountete Verzeichnisse |
| `wasi:random` | Kryptografisch sichere Zufallszahlen |
| `wasi:sockets` | TCP/UDP-Netzwerk und DNS-Aufloesung |
| `wasi:http` | Ausgehende HTTP-Client-Anfragen |

Aktivieren Sie Imports in Ihrer Entry-Konfiguration:

```yaml
  - name: my_function
    kind: function.wasm
    fs: myns:assets
    path: /module.wasm
    hash: sha256:...
    method: run
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
    pool:
      type: inline
```

Deklarieren Sie nur die Imports, die Ihr Modul tatsaechlich benoetigt.

## WASI-Imports

Jeder `wasi:*`-Import aktiviert eine Gruppe verwandter WASI Preview 2 Schnittstellen.

### wasi:clocks

**Interfaces:** `wasi:clocks/wall-clock`, `wasi:clocks/monotonic-clock`

Wall Clock und Monotonic Clock fuer Zeitoperationen. Die Monotonic Clock integriert sich in den Wippy-Dispatcher fuer asynchrones Sleep.

### wasi:io

**Interfaces:** `wasi:io/error`, `wasi:io/streams`, `wasi:io/poll`

Stream-Lese-/Schreiboperationen und asynchrones Polling. Die Poll-Schnittstelle ermoeglicht kooperatives Yielding ueber den Dispatcher.

### wasi:cli

**Interfaces:** `wasi:cli/environment`, `wasi:cli/exit`, `wasi:cli/stdin`, `wasi:cli/stdout`, `wasi:cli/stderr`

Zugriff auf Umgebungsvariablen, Prozess-Exit-Codes und Standard-I/O-Streams. Umgebungsvariablen werden ueber die WASI-Konfiguration aus der Wippy-Umgebungs-Registry abgebildet.

### wasi:filesystem

**Interfaces:** `wasi:filesystem/types`, `wasi:filesystem/preopens`

Dateisystemzugriff ueber gemountete Verzeichnisse. Mounts werden pro Eintrag konfiguriert und bilden Wippy-Dateisystem-Eintraege auf Guest-Pfade ab.

```yaml
wasi:
  mounts:
    - fs: myns:data
      guest: /data
      read_only: true
```

### wasi:random

**Interfaces:** `wasi:random/random`, `wasi:random/insecure`, `wasi:random/insecure-seed`

Kryptografisch sichere und unsichere Zufallszahlengenerierung.

### wasi:sockets

**Interfaces:** `wasi:sockets/network`, `wasi:sockets/instance-network`, `wasi:sockets/ip-name-lookup`, `wasi:sockets/tcp`, `wasi:sockets/tcp-create-socket`, `wasi:sockets/udp`

TCP- und UDP-Netzwerk mit DNS-Aufloesung. Socket-Operationen integrieren sich in den Dispatcher fuer asynchrone I/O.

### wasi:http

**Interfaces:** `wasi:http/types`, `wasi:http/outgoing-handler`

Ausgehende HTTP-Client-Anfragen aus WASM-Modulen. Unterstuetzt Request/Response-Typen, die durch die WASI-HTTP-Spezifikation definiert sind.

## Siehe auch

- [Uebersicht](wasm/overview.md) - WebAssembly-Runtime-Uebersicht
- [Funktionen](wasm/functions.md) - WASM-Funktionskonfiguration
- [Prozesse](wasm/processes.md) - WASM als Prozesse ausfuehren
