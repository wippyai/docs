---
title: "Host-Funktionen"
description: "WASM-Module greifen über Host-Funktions-Imports auf Runtime-Fähigkeiten zu. Jeder Import wird explizit pro Eintrag in der imports-Liste deklariert."
---

# Host-Funktionen

WASM-Module greifen über Host-Funktions-Imports auf Runtime-Fähigkeiten zu. Jeder Import wird explizit pro Eintrag in der `imports`-Liste deklariert.

## Import-Typen

| Import | Namespace | Modultyp | Beschreibung |
|--------|-----------|----------|-------------|
| `wasi:cli` | `wasi:cli/*` | component | Umgebung, Exit, stdin/stdout/stderr, Terminal |
| `wasi:io` | `wasi:io/error`, `wasi:io/streams` | component | Streams und Fehlerbehandlung |
| `wasi:poll` | `wasi:io/poll` | component | Asynchrones Polling / kooperatives Yielding |
| `wasi:clocks` | `wasi:clocks/*` | component | Wall Clock und Monotonic Clock |
| `wasi:filesystem` | `wasi:filesystem/*` | component | Dateisystemzugriff über gemountete Verzeichnisse |
| `wasi:random` | `wasi:random/*` | component | Kryptografisch sichere und unsichere Zufallszahlen |
| `wasi:sockets` | `wasi:sockets/*` | component | TCP/UDP-Netzwerk und DNS-Auflösung |
| `wasi:http` | `wasi:http/*` | component | Ausgehende HTTP-Client-Anfragen |
| `funcs` | `wippy:runtime/funcs@0.1.0` | component | Aufruf von Registry-Funktionen aus dem Guest |
| `wasi1` | `wasi_snapshot_preview1` | core | Kompatibilitäts-Imports für WASI Preview 1 |
| `socket` | `wippy:runtime/socket@0.1.0` | core | Instanzeigenes ausgehendes TCP über rein ganzzahlige Imports |

Die acht `wasi:*`-Profile und `funcs` sind ausschließlich für Komponenten: Wird eines davon auf einem Core-Modul deklariert, schlägt der Eintrag fehl. `wasi1` und `socket` stellen Core-Imports bereit.

Jedes Profil wird unter seinem Kurznamen, unter jedem der Interface-Namespaces, die es bereitstellt, und unter einem versionierten Namespace aufgelöst. Das Versionssuffix wird vor der Auflösung entfernt, sodass `wasi:io/poll`, `wasi:io/poll@0.2.3` und `wasi:poll` alle dasselbe Profil auswählen.

Ein Import, der zu keinem Profil aufgelöst wird, lässt den Eintrag mit `unsupported wasm host import: <id>` fehlschlagen; ein nur für Komponenten verfügbares Profil auf einem Core-Modul schlägt mit `wasm host import requires component module: <id>` fehl.

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

Deklarieren Sie nur die Imports, die Ihr Modul tatsächlich benötigt.

## WASI-Imports

Jeder `wasi:*`-Import aktiviert eine Gruppe verwandter WASI Preview 2 Schnittstellen.

### wasi:clocks

**Interfaces:** `wasi:clocks/wall-clock`, `wasi:clocks/monotonic-clock`

Wall Clock und Monotonic Clock für Zeitoperationen. Die Monotonic Clock integriert sich in den Wippy-Dispatcher für asynchrones Sleep.

### wasi:io

**Interfaces:** `wasi:io/error`, `wasi:io/streams`

Stream-Lese-/Schreiboperationen und Fehlerbehandlung. Die Schnittstelle `wasi:io/poll` wird separat vom Import `wasi:poll` bereitgestellt.

### wasi:poll

**Interfaces:** `wasi:io/poll`

Asynchrones Polling. Die Poll-Schnittstelle ermöglicht kooperatives Yielding über den Dispatcher.

### wasi:cli

**Interfaces:** `wasi:cli/environment`, `wasi:cli/exit`, `wasi:cli/stdin`, `wasi:cli/stdout`, `wasi:cli/stderr`, `wasi:cli/terminal-stdin`, `wasi:cli/terminal-stdout`, `wasi:cli/terminal-stderr`

Zugriff auf Umgebungsvariablen, Prozess-Exit-Codes und Standard-I/O-Streams. Umgebungsvariablen werden über die WASI-Konfiguration aus der Wippy-Umgebungs-Registry abgebildet.

### wasi:filesystem

**Interfaces:** `wasi:filesystem/types`, `wasi:filesystem/preopens`

Dateisystemzugriff über gemountete Verzeichnisse. Mounts werden pro Eintrag konfiguriert und bilden Wippy-Dateisystem-Einträge auf Guest-Pfade ab.

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

**Interfaces:** `wasi:sockets/instance-network`, `wasi:sockets/ip-name-lookup`, `wasi:sockets/tcp`, `wasi:sockets/tcp-create-socket`, `wasi:sockets/udp`, `wasi:sockets/udp-create-socket`

TCP- und UDP-Netzwerk mit DNS-Auflösung. Socket-Operationen suspendieren den Guest und laufen über den Dispatcher, der jeden Dial, jedes Bind und jeden Lookup auf dem [Netzwerkdienst](system/network.md) ausführt.

### wasi:http

**Interfaces:** `wasi:http/types`, `wasi:http/outgoing-handler`

Ausgehende HTTP-Client-Anfragen aus WASM-Modulen. Unterstützt Request/Response-Typen, die durch die WASI-HTTP-Spezifikation definiert sind.

## funcs

**Namespace:** `wippy:runtime/funcs@0.1.0`

Ruft Registry-Funktionen aus einem Komponenten-Guest auf. Zwei Einstiegspunkte werden bereitgestellt:

```wit
interface funcs {
  call-string: func(target: string, input: string) -> result<string, string>;
  call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

`target` ist eine Registry-ID in der Form `namespace:name`. Jeder Aufruf wird als `funcs.call` gegen dieses Ziel policy-geprüft, sodass ein Guest nur Funktionen erreichen kann, die der Scope des Aufrufers ohnehin erlaubt.

## wasi1

**Namespace:** `wasi_snapshot_preview1`

Deklariert, dass ein Core-Modul gegen WASI Preview 1 linkt. Das Profil wird auch unter `preview1` und `wasi-preview1` aufgelöst. Es registriert keine eigenen Hosts; Preview-1-Imports werden von der zugrunde liegenden WASM-Runtime bedient.

## socket

**Namespace:** `wippy:runtime/socket@0.1.0`

Ausgehendes TCP für Core-Module (Nicht-Komponenten). Der Host exportiert vier rein ganzzahlige Funktionen, sodass ein Guest kein Komponenten-Tooling benötigt, um ihn zu verwenden:

| Funktion | Signatur | Ergebnis |
|----------|----------|----------|
| `connect` | `(host_ptr: i32, host_len: i32, port: i32, timeout_ms: i32) -> i64` | `status << 32 \| handle` |
| `send` | `(handle: i32, buf_ptr: i32, buf_len: i32) -> i64` | `status << 32 \| written` |
| `recv` | `(handle: i32, out_ptr: i32, out_cap: i32) -> i64` | `status << 32 \| read` |
| `close` | `(handle: i32) -> i32` | `status` |

Die oberen 32 Bit des 64-Bit-Ergebnisses tragen den Status; die unteren 32 Bit tragen den Wert.

| Status | Wert | Bedeutung |
|--------|------|-----------|
| `OK` | 0 | Operation erfolgreich |
| `Invalid` | 1 | Falsche Argumente oder ein Speicherbereich außerhalb des gültigen Bereichs |
| `Denied` | 2 | Der Netzwerkdienst hat den Dial verweigert |
| `Failed` | 3 | Die Operation ist fehlgeschlagen |
| `UnknownHandle` | 4 | Das Handle ist keine offene Verbindung dieser Instanz |
| `Limit` | 5 | `max_open_sockets` erreicht |
| `Timeout` | 6 | Der Dial oder die Lese-/Schreib-Deadline ist abgelaufen |

`connect` liest den Hostnamen aus dem Guest-Speicher; `host_len` muss zwischen 1 und 253 Bytes liegen und `port` zwischen 1 und 65535. `timeout_ms` verengt die Dial-Deadline: Die effektive Deadline ist der kleinere Wert von `timeout_ms` und `socket_timeout_ms` des Eintrags. `send` und `recv` sind durch `socket_timeout_ms` begrenzt. `recv` meldet ein sauberes Stream-Ende als `OK` mit einer Lesezahl von 0.

Verbindungen gehören der Instanz, die sie geöffnet hat. Ein Handle ist für eine andere Instanz bedeutungslos, die Zahl der offenen Sockets wird pro Instanz gezählt, und jede Verbindung wird geschlossen, wenn die Instanz geschlossen oder der warme Worker recycelt wird.

## Netzwerkautorisierung

Keiner der beiden Socket-Hosts entscheidet selbst über den Zugriff. Jeder Dial, jedes Bind und jeder Lookup läuft über den Netzwerkdienst der Runtime, der die Berechtigungen `socket.connect`, `socket.listen` und `socket.resolve` prüft, die Private-IP-Policy anwendet und über ein [Overlay-Netzwerk](system/network.md) routet, wenn eines ausgewählt ist. `wasi:sockets` prüft zusätzlich `socket.resolve` vor einem DNS-Lookup und `socket.listen` vor einem UDP-Bind.

## Siehe auch

- [Übersicht](wasm/overview.md) - WebAssembly-Runtime-Übersicht
- [Funktionen](wasm/functions.md) - WASM-Funktionskonfiguration
- [Prozesse](wasm/processes.md) - WASM als Prozesse ausführen
- [Netzwerk-Overlays](system/network.md) - Overlay-Auswahl und Socket-Berechtigungen
