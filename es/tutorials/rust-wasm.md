# Ejecutar Rust en Wippy

Compila un componente WebAssembly en Rust y ejecutalo como funciones, comandos CLI y endpoints HTTP.

## Que Vamos a Construir

Un componente Rust con cuatro funciones exportadas:

- **greet** - Recibe un nombre, retorna un saludo
- **add** - Suma dos enteros
- **fibonacci** - Calcula el n-esimo numero de Fibonacci
- **list-files** - Lista archivos en un directorio montado

Expondremos estas como funciones invocables, un comando CLI y un endpoint HTTP.

## Prerequisitos

- [Rust toolchain](https://rustup.rs/) con el target `wasm32-wasip1`
- [cargo-component](https://github.com/bytecodealliance/cargo-component)

```bash
rustup target add wasm32-wasip1
cargo install cargo-component
```

## Estructura del Proyecto

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

## Paso 1: Crear la Interfaz WIT

WIT (WebAssembly Interface Types) define el contrato entre el host y el guest:

Crea `demo/wit/world.wit`:

```wit
package component:demo;

world demo {
    export greet: func(name: string) -> string;
    export add: func(a: s32, b: s32) -> s32;
    export fibonacci: func(n: u32) -> u64;
    export list-files: func(path: string) -> string;
}
```

Cada export se convierte en una funcion que Wippy puede invocar.

## Paso 2: Implementar en Rust

Crea `demo/Cargo.toml`:

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

Crea `demo/src/lib.rs`:

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

El modulo `bindings` es generado por `cargo-component` a partir de la definicion WIT.

## Paso 3: Compilar el Componente

```bash
cd demo
cargo component build --release
```

Esto produce `target/wasm32-wasip1/release/demo.wasm`. Copialo a tu aplicacion Wippy:

```bash
mkdir -p ../app/src/demo/wasm
cp target/wasm32-wasip1/release/demo.wasm ../app/src/demo/wasm/demo_component.wasm
```

Obtiene el hash SHA-256 para verificacion de integridad:

```bash
sha256sum ../app/src/demo/wasm/demo_component.wasm
```

## Paso 4: Aplicacion Wippy

### Infraestructura

Crea `app/src/_index.yaml`:

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

### Funciones WASM

Crea `app/src/demo/wasm/_index.yaml`:

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

Puntos clave:
- Una sola entrada `fs.directory` proporciona el binario WASM
- Multiples funciones referencian el mismo binario con diferentes valores de `method`
- El campo `hash` verifica la integridad del binario al momento de carga
- El pool `inline` crea una instancia nueva por llamada

### Funciones con WASI

La funcion `list-files` accede al sistema de archivos, por lo que necesita imports WASI:

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

La seccion `wasi.mounts` mapea una entrada del sistema de archivos de Wippy a una ruta del guest. Dentro del modulo WASM, `/data` apunta al directorio `demo.wasm:assets`.

### Comandos CLI

Crea `app/src/demo/_index.yaml`:

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

El bloque `meta.command` registra el proceso como un comando CLI con nombre. El comando `greet` no necesita imports WASI ya que solo usa operaciones de strings. El comando `ls` necesita acceso al sistema de archivos.

### Endpoint HTTP

Agrega a `app/src/demo/wasm/_index.yaml`:

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

El transporte `wasi-http` mapea el contexto de solicitud/respuesta HTTP a los argumentos y resultados WASM.

## Paso 5: Inicializar y Ejecutar

```bash
cd app
wippy init
```

### Ejecutar Comandos CLI

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

### Ejecutar como Servicio

```bash
wippy run
```

Esto inicia el servidor HTTP en el puerto 8090. Prueba el endpoint:

```bash
curl -X POST http://localhost:8090/greet
```

### Llamar desde Lua

Las funciones WASM se invocan de la misma manera que las funciones Lua:

```lua
local funcs = require("funcs")

local greeting, err = funcs.call("demo.wasm:greet_function", "World")
-- greeting: "Hello, World!"

local sum, err = funcs.call("demo.wasm:add_function", 6, 7)
-- sum: 13

local fib, err = funcs.call("demo.wasm:fibonacci_function", 10)
-- fib: 55
```

## Tres Formas de Exponer WASM

| Approach | Entry Kind | Use Case |
|----------|-----------|----------|
| Function | `function.wasm` | Invocada desde Lua u otro WASM via `funcs.call()` |
| CLI Command | `process.wasm` + `meta.command` | Comandos de terminal via `wippy run <name>` |
| HTTP Endpoint | `function.wasm` + `http.endpoint` | API REST via transporte `wasi-http` |

Las tres usan el mismo binario `.wasm` compilado y referencian los mismos metodos.

## Compilar para Otros Lenguajes

Cualquier lenguaje que compile al Modelo de Componentes de WebAssembly funciona con Wippy. Define tu interfaz WIT, implementa los exports, compila a `.wasm` y configura las entradas en `_index.yaml`.

## Ver Tambien

- [Descripcion General de WASM](wasm/overview.md) - Descripcion general del runtime WebAssembly
- [Funciones WASM](wasm/functions.md) - Referencia de configuracion de funciones
- [Procesos WASM](wasm/processes.md) - Referencia de configuracion de procesos
- [Funciones Host](wasm/hosts.md) - Imports WASI disponibles
- [Referencia CLI](guides/cli.md) - Documentacion de comandos CLI
