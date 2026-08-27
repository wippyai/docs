---
title: "Host-Funktionen"
description: "Wippy-Funktionsaufrufe, WASI-Preview-1-Kompatibilität oder ausgewählte WASI-Preview-2-Schnittstellen über Eintrags-Imports aktivieren."
---

# Host-Funktionen

Jeder Eintrag aktiviert die unten aufgeführten Host-Schnittstellen über sein Feld `imports`.

**Klassifizierung: Referenz der Host-Schnittstellen.** Der YAML-Block ist ein Teileintrag:
Ersetzen Sie Dateisystem-ID, Pfad, Methode und Hash durch die Werte eines kompilierten
Moduls. Der Digest muss dem tatsächlichen SHA-256-Wert des Moduls entsprechen.

## Import-Typen

| Import | Beschreibung |
|--------|--------------|
| `funcs` | Wippy-Registry-Funktionen aus einem Component-Model-Modul aufrufen |
| `wasi1` | WASI-Preview-1-Kompatibilität für Raw/Core-Module |
| `wasi:cli` | Umgebung, Exit, stdin/stdout/stderr, Terminal |
| `wasi:io` | Streams und Fehlerbehandlung |
| `wasi:poll` | Asynchrones Polling / kooperatives Yielding (Schnittstelle `wasi:io/poll`) |
| `wasi:clocks` | Wall Clock und Monotonic Clock |
| `wasi:filesystem` | Dateisystemzugriff über eingehängte Verzeichnisse |
| `wasi:random` | Kryptografisch sichere Zufallszahlen |
| `wasi:sockets` | TCP/UDP-Netzwerk und DNS-Auflösung |
| `wasi:http` | Ausgehende HTTP-Client-Anfragen |

Aktivieren Sie Imports in Ihrer Eintragskonfiguration:

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

`funcs` und die folgenden `wasi:*`-Profile erfordern ein Component-Model-Modul. Verwenden Sie `wasi1` für ein Raw/Core-Modul, das `wasi_snapshot_preview1` importiert; die Aliasse `wasi-preview1`, `preview1` und `wasi_snapshot_preview1` werden auf dasselbe Profil aufgelöst. Nicht unterstützte Imports oder Component-Model-exklusive Profile auf einem Core-Modul führen bei der Modulvorbereitung zu einem Fehler.

## Wippy-Funktionsaufrufe

Das Profil `funcs` registriert die Schnittstelle `wippy:runtime/funcs@0.1.0` für Component-Model-Module:

```wit
interface funcs {
  call-string: func(target: string, input: string) -> result<string, string>;
  call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

Beide Methoden rufen das Ziel über Wippys Funktions-Registry auf. Der Aufruf erbt den Sicherheitskontext der Ausführung und benötigt die Berechtigung `funcs.call` für die Registry-ID des Ziels.

## WASI-Imports

Jeder `wasi:*`-Import aktiviert eine Gruppe zusammengehöriger WASI-Preview-2-Schnittstellen.

### wasi:clocks

**Schnittstellen:** `wasi:clocks/wall-clock`, `wasi:clocks/monotonic-clock`

Wall Clock und Monotonic Clock für Zeitoperationen. Die Monotonic Clock integriert sich für asynchrones Sleep in den Wippy-Dispatcher.

### wasi:io

**Schnittstellen:** `wasi:io/error`, `wasi:io/streams`

Stream-Lese- und -Schreiboperationen sowie Fehlerbehandlung. Die Schnittstelle `wasi:io/poll` wird separat durch den Import `wasi:poll` bereitgestellt.

### wasi:poll

**Schnittstellen:** `wasi:io/poll`

Asynchrones Polling. Die Poll-Schnittstelle ermöglicht kooperatives Yielding über den Dispatcher.

### wasi:cli

**Schnittstellen:** `wasi:cli/environment`, `wasi:cli/exit`, `wasi:cli/stdin`, `wasi:cli/stdout`, `wasi:cli/stderr`, `wasi:cli/terminal-stdin`, `wasi:cli/terminal-stdout`, `wasi:cli/terminal-stderr`

Zugriff auf Umgebungsvariablen, Prozess-Exit-Codes und Standard-I/O-Streams. Umgebungsvariablen werden über die WASI-Konfiguration aus der Wippy-Umgebungs-Registry abgebildet.

### wasi:filesystem

**Schnittstellen:** `wasi:filesystem/types`, `wasi:filesystem/preopens`

Dateisystemzugriff über eingehängte Verzeichnisse. Mounts werden pro Eintrag konfiguriert und bilden Wippy-Dateisystemeinträge auf Gastpfade ab.

```yaml
wasi:
  mounts:
    - fs: myns:data
      guest: /data
      read_only: true
```

### wasi:random

**Schnittstellen:** `wasi:random/random`, `wasi:random/insecure`, `wasi:random/insecure-seed`

Kryptografisch sichere und unsichere Erzeugung von Zufallszahlen.

### wasi:sockets

**Schnittstellen:** `wasi:sockets/instance-network`, `wasi:sockets/ip-name-lookup`, `wasi:sockets/tcp`, `wasi:sockets/tcp-create-socket`, `wasi:sockets/udp`, `wasi:sockets/udp-create-socket`

TCP- und UDP-Netzwerkzugriff mit DNS-Auflösung. Socket-Operationen integrieren sich für asynchrones I/O in den Dispatcher.

### wasi:http

**Schnittstellen:** `wasi:http/types`, `wasi:http/outgoing-handler`

Ausgehende HTTP-Client-Anfragen aus WASM-Modulen. Unterstützt die von der WASI-HTTP-Spezifikation definierten Request- und Response-Typen.

Ausgehende Anfragen benötigen die Berechtigung `http_client.request` für die URL. Anfragen an private IP-Adressen benötigen außerdem `http_client.private_ip` für die aufgelöste Adresse.

## Socket-Berechtigungen

Das Aktivieren von `wasi:sockets` stellt die Schnittstellen bereit, autorisiert aber keinen Netzwerkzugriff. DNS-Auflösung benötigt `socket.resolve` für den Namen, ausgehende TCP-Verbindungen benötigen `socket.connect` für die Adresse und das Binden von TCP oder UDP benötigt `socket.listen` für die Adresse.

## Siehe auch

- [Übersicht](./overview.md) - Übersicht über die WebAssembly-Runtime
- [Funktionen](./functions.md) - Konfiguration von WASM-Funktionen
- [Prozesse](./processes.md) - WASM als Prozesse ausführen
