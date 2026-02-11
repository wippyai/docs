# Rust auf Wippy ausfuehren

Erstellen Sie eine Rust-WebAssembly-Komponente und fuehren Sie sie als Funktionen, CLI-Befehle und HTTP-Endpunkte aus.

## Was wir bauen

Eine Rust-Komponente mit vier exportierten Funktionen:

- **greet** - Nimmt einen Namen entgegen, gibt eine Begruessung zurueck
- **add** - Addiert zwei Ganzzahlen
- **fibonacci** - Berechnet die n-te Fibonacci-Zahl
- **list-files** - Listet Dateien in einem gemounteten Verzeichnis auf

Wir stellen diese als aufrufbare Funktionen, CLI-Befehl und HTTP-Endpunkt bereit.

## Voraussetzungen

- [Rust-Toolchain](https://rustup.rs/) mit `wasm32-wasip1`-Target
- [cargo-component](https://github.com/bytecodealliance/cargo-component)

```bash
rustup target add wasm32-wasip1
cargo install cargo-component
```

## Projektstruktur

```
rust-wasm-demo/
├── demo/                    # Rust component
│   ├── Cargo.toml
│   ├── wit/
│   │   └── world.wit       # WIT interface
│   └── src/
│       └── lib.rs           # Implementation
└── app/                     # Wippy application
    ├── wippy.lock
    └── src/
        ├── _index.yaml      # Infrastructure
        └── demo/
            ├── _index.yaml  # CLI processes
            └── wasm/
                ├── _index.yaml          # WASM entries
                └── demo_component.wasm  # Compiled binary
```

## Schritt 1: WIT-Schnittstelle erstellen

WIT (WebAssembly Interface Types) definiert den Vertrag zwischen Host und Guest:

Erstellen Sie `demo/wit/world.wit`:

```wit
package component:demo;

world demo {
    export greet: func(name: string) -> string;
    export add: func(a: s32, b: s32) -> s32;
    export fibonacci: func(n: u32) -> u64;
    export list-files: func(path: string) -> string;
}
```

Jeder Export wird zu einer Funktion, die Wippy aufrufen kann.

## Schritt 2: In Rust implementieren

Erstellen Sie `demo/Cargo.toml`:

```toml
[package]
name = "demo"
version = "0.1.0"
edition = "2024"

[dependencies]
wit-bindgen-rt = { version = "0.44.0", features = ["bitflags"] }

[lib]
crate-type = ["cdylib"]

[profile.release]
opt-level = "s"
lto = true

[package.metadata.component]
package = "component:demo"
```

Erstellen Sie `demo/src/lib.rs`:

```rust
#[allow(warnings)]
mod bindings;

use bindings::Guest;

struct Component;

impl Guest for Component {
    fn greet(name: String) -> String {
        format!("Hello, {}!", name)
    }

    fn add(a: i32, b: i32) -> i32 {
        a + b
    }

    fn fibonacci(n: u32) -> u64 {
        if n <= 1 {
            return n as u64;
        }
        let (mut a, mut b) = (0u64, 1u64);
        for _ in 2..=n {
            let next = a + b;
            a = b;
            b = next;
        }
        b
    }

    fn list_files(path: String) -> String {
        let mut result = String::new();
        match std::fs::read_dir(&path) {
            Ok(entries) => {
                for entry in entries {
                    match entry {
                        Ok(e) => {
                            let name = e.file_name().to_string_lossy().to_string();
                            let meta = e.metadata();
                            let (kind, size) = match meta {
                                Ok(m) => {
                                    let kind = if m.is_dir() { "dir" } else { "file" };
                                    (kind, m.len())
                                }
                                Err(_) => ("?", 0),
                            };
                            let line = format!("{:<6} {:>8}  {}", kind, size, name);
                            println!("{}", line);
                            result.push_str(&line);
                            result.push('\n');
                        }
                        Err(e) => {
                            let line = format!("error: {}", e);
                            eprintln!("{}", line);
                            result.push_str(&line);
                            result.push('\n');
                        }
                    }
                }
            }
            Err(e) => {
                let line = format!("cannot read {}: {}", path, e);
                eprintln!("{}", line);
                result.push_str(&line);
                result.push('\n');
            }
        }
        result
    }
}

bindings::export!(Component with_types_in bindings);
```

Das `bindings`-Modul wird von `cargo-component` aus der WIT-Definition generiert.

## Schritt 3: Komponente bauen

```bash
cd demo
cargo component build --release
```

Dies erzeugt `target/wasm32-wasip1/release/demo.wasm`. Kopieren Sie es in Ihre Wippy-App:

```bash
mkdir -p ../app/src/demo/wasm
cp target/wasm32-wasip1/release/demo.wasm ../app/src/demo/wasm/demo_component.wasm
```

SHA-256-Hash fuer die Integritaetspruefung ermitteln:

```bash
sha256sum ../app/src/demo/wasm/demo_component.wasm
```

## Schritt 4: Wippy-Anwendung

### Infrastruktur

Erstellen Sie `app/src/_index.yaml`:

```yaml
version: "1.0"
namespace: demo

entries:
  - name: gateway
    kind: http.service
    meta:
      comment: HTTP server
    addr: ":8090"
    lifecycle:
      auto_start: true

  - name: api
    kind: http.router
    meta:
      comment: Public API router
    server: gateway
    prefix: /

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true
```

### WASM-Funktionen

Erstellen Sie `app/src/demo/wasm/_index.yaml`:

```yaml
version: "1.0"
namespace: demo.wasm

entries:
  - name: assets
    kind: fs.directory
    meta:
      comment: Filesystem with WASM binaries
    directory: ./src/demo/wasm

  - name: greet_function
    kind: function.wasm
    meta:
      comment: Greet function via payload transport
    fs: demo.wasm:assets
    path: /demo_component.wasm
    hash: sha256:YOUR_HASH_HERE
    method: greet
    pool:
      type: inline

  - name: add_function
    kind: function.wasm
    meta:
      comment: Add function via payload transport
    fs: demo.wasm:assets
    path: /demo_component.wasm
    hash: sha256:YOUR_HASH_HERE
    method: add
    pool:
      type: inline

  - name: fibonacci_function
    kind: function.wasm
    meta:
      comment: Fibonacci function via payload transport
    fs: demo.wasm:assets
    path: /demo_component.wasm
    hash: sha256:YOUR_HASH_HERE
    method: fibonacci
    pool:
      type: inline
```

Wichtige Punkte:
- Ein einzelner `fs.directory`-Eintrag stellt das WASM-Binary bereit
- Mehrere Funktionen referenzieren dasselbe Binary mit unterschiedlichen `method`-Werten
- Das `hash`-Feld verifiziert die Integritaet des Binaries beim Laden
- `inline`-Pool erstellt eine neue Instanz pro Aufruf

### Funktionen mit WASI

Die `list-files`-Funktion greift auf das Dateisystem zu und benoetigt daher WASI-Imports:

```yaml
  - name: list_files_function
    kind: function.wasm
    meta:
      comment: Filesystem listing with WASI mounts
    fs: demo.wasm:assets
    path: /demo_component.wasm
    hash: sha256:YOUR_HASH_HERE
    method: list-files
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
    wasi:
      mounts:
        - fs: demo.wasm:assets
          guest: /data
    pool:
      type: inline
```

Der Abschnitt `wasi.mounts` bildet einen Wippy-Dateisystem-Eintrag auf einen Guest-Pfad ab. Innerhalb des WASM-Moduls zeigt `/data` auf das Verzeichnis `demo.wasm:assets`.

### CLI-Befehle

Erstellen Sie `app/src/demo/_index.yaml`:

```yaml
version: "1.0"
namespace: demo.cli

entries:
  - name: greet
    kind: process.wasm
    meta:
      comment: Greet someone via WASM
      command:
        name: greet
        short: Greet someone via WASM
    fs: demo.wasm:assets
    path: /demo_component.wasm
    hash: sha256:YOUR_HASH_HERE
    method: greet

  - name: ls
    kind: process.wasm
    meta:
      comment: List files from mounted WASI filesystem
      command:
        name: ls
        short: List files from mounted directory
    fs: demo.wasm:assets
    path: /demo_component.wasm
    hash: sha256:YOUR_HASH_HERE
    method: list-files
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
    wasi:
      mounts:
        - fs: demo.wasm:assets
          guest: /data
```

Der `meta.command`-Block registriert den Prozess als benannten CLI-Befehl. Der `greet`-Befehl benoetigt keine WASI-Imports, da er nur String-Operationen verwendet. Der `ls`-Befehl benoetigt Dateisystemzugriff.

### HTTP-Endpunkt

Fuegen Sie zu `app/src/demo/wasm/_index.yaml` hinzu:

```yaml
  - name: http_greet
    kind: function.wasm
    meta:
      comment: Greet exposed via wasi-http transport
    fs: demo.wasm:assets
    path: /demo_component.wasm
    hash: sha256:YOUR_HASH_HERE
    method: greet
    transport: wasi-http
    pool:
      type: inline

  - name: http_greet_endpoint
    kind: http.endpoint
    meta:
      comment: HTTP POST endpoint for WASM greet
      router: demo:api
    method: POST
    path: /greet
    func: http_greet
```

Der `wasi-http`-Transport bildet HTTP-Request/Response-Kontext auf WASM-Argumente und -Ergebnisse ab.

## Schritt 5: Initialisieren und ausfuehren

```bash
cd app
wippy init
```

### CLI-Befehle ausfuehren

```bash
# List available commands
wippy run list
```

```
Available commands:
  greet    Greet someone via WASM
  ls       List files from mounted directory
```

```bash
# Run greet
wippy run greet
```

```bash
# Run ls to list mounted directory
wippy run ls
```

### Als Dienst ausfuehren

```bash
wippy run
```

Dies startet den HTTP-Server auf Port 8090. Testen Sie den Endpunkt:

```bash
curl -X POST http://localhost:8090/greet
```

### Aus Lua aufrufen

WASM-Funktionen werden auf dieselbe Weise wie Lua-Funktionen aufgerufen:

```lua
local funcs = require("funcs")

local greeting, err = funcs.call("demo.wasm:greet_function", "World")
-- greeting: "Hello, World!"

local sum, err = funcs.call("demo.wasm:add_function", 6, 7)
-- sum: 13

local fib, err = funcs.call("demo.wasm:fibonacci_function", 10)
-- fib: 55
```

## Drei Wege, WASM bereitzustellen

| Ansatz | Entry Kind | Anwendungsfall |
|--------|-----------|----------|
| Function | `function.wasm` | Aufruf aus Lua oder anderem WASM via `funcs.call()` |
| CLI Command | `process.wasm` + `meta.command` | Terminal-Befehle via `wippy run <name>` |
| HTTP Endpoint | `function.wasm` + `http.endpoint` | REST-API via `wasi-http`-Transport |

Alle drei verwenden dasselbe kompilierte `.wasm`-Binary und referenzieren dieselben Methoden.

## Fuer andere Sprachen bauen

Jede Sprache, die in das WebAssembly Component Model kompiliert, funktioniert mit Wippy. Definieren Sie Ihre WIT-Schnittstelle, implementieren Sie die Exports, kompilieren Sie zu `.wasm` und konfigurieren Sie Eintraege in `_index.yaml`.

## Siehe auch

- [WASM-Uebersicht](wasm/overview.md) - WebAssembly-Runtime-Uebersicht
- [WASM-Funktionen](wasm/functions.md) - Funktionskonfigurations-Referenz
- [WASM-Prozesse](wasm/processes.md) - Prozesskonfigurations-Referenz
- [Host-Funktionen](wasm/hosts.md) - Verfuegbare WASI-Imports
- [CLI-Referenz](guides/cli.md) - CLI-Befehlsdokumentation
