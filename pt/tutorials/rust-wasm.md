# Executando Rust no Wippy

Compile um componente Rust WebAssembly e execute-o como funcoes, comandos CLI e endpoints HTTP.

## O Que Vamos Construir

Um componente Rust com quatro funcoes exportadas:

- **greet** - Recebe um nome, retorna uma saudacao
- **add** - Soma dois inteiros
- **fibonacci** - Calcula o n-esimo numero de Fibonacci
- **list-files** - Lista arquivos em um diretorio montado

Vamos expor essas funcoes como funcoes chamaveis, um comando CLI e um endpoint HTTP.

## Pre-requisitos

- [Rust toolchain](https://rustup.rs/) com target `wasm32-wasip1`
- [cargo-component](https://github.com/bytecodealliance/cargo-component)

```bash
rustup target add wasm32-wasip1
cargo install cargo-component
```

## Estrutura do Projeto

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

## Passo 1: Criar a Interface WIT

WIT (WebAssembly Interface Types) define o contrato entre host e guest:

Crie `demo/wit/world.wit`:

```wit
package component:demo;

world demo {
    export greet: func(name: string) -> string;
    export add: func(a: s32, b: s32) -> s32;
    export fibonacci: func(n: u32) -> u64;
    export list-files: func(path: string) -> string;
}
```

Cada export se torna uma funcao que o Wippy pode chamar.

## Passo 2: Implementar em Rust

Crie `demo/Cargo.toml`:

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

Crie `demo/src/lib.rs`:

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

O modulo `bindings` e gerado pelo `cargo-component` a partir da definicao WIT.

## Passo 3: Compilar o Componente

```bash
cd demo
cargo component build --release
```

Isso produz `target/wasm32-wasip1/release/demo.wasm`. Copie para sua aplicacao Wippy:

```bash
mkdir -p ../app/src/demo/wasm
cp target/wasm32-wasip1/release/demo.wasm ../app/src/demo/wasm/demo_component.wasm
```

Obtenha o hash SHA-256 para verificacao de integridade:

```bash
sha256sum ../app/src/demo/wasm/demo_component.wasm
```

## Passo 4: Aplicacao Wippy

### Infraestrutura

Crie `app/src/_index.yaml`:

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

### Funcoes WASM

Crie `app/src/demo/wasm/_index.yaml`:

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

Pontos-chave:
- Uma unica entrada `fs.directory` fornece o binario WASM
- Multiplas funcoes referenciam o mesmo binario com valores de `method` diferentes
- O campo `hash` verifica a integridade do binario no carregamento
- Pool `inline` cria uma nova instancia por chamada

### Funcoes com WASI

A funcao `list-files` acessa o sistema de arquivos, entao precisa de imports WASI:

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

A secao `wasi.mounts` mapeia uma entrada de sistema de arquivos do Wippy para um caminho do guest. Dentro do modulo WASM, `/data` aponta para o diretorio `demo.wasm:assets`.

### Comandos CLI

Crie `app/src/demo/_index.yaml`:

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

O bloco `meta.command` registra o processo como um comando CLI nomeado. O comando `greet` nao precisa de imports WASI ja que usa apenas operacoes com strings. O comando `ls` precisa de acesso ao sistema de arquivos.

### Endpoint HTTP

Adicione ao `app/src/demo/wasm/_index.yaml`:

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

O transporte `wasi-http` mapeia o contexto de requisicao/resposta HTTP para argumentos e resultados WASM.

## Passo 5: Inicializar e Executar

```bash
cd app
wippy init
```

### Executar Comandos CLI

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

### Executar como Servico

```bash
wippy run
```

Isso inicia o servidor HTTP na porta 8090. Teste o endpoint:

```bash
curl -X POST http://localhost:8090/greet
```

### Chamar a partir de Lua

Funcoes WASM sao chamadas da mesma forma que funcoes Lua:

```lua
local funcs = require("funcs")

local greeting, err = funcs.call("demo.wasm:greet_function", "World")
-- greeting: "Hello, World!"

local sum, err = funcs.call("demo.wasm:add_function", 6, 7)
-- sum: 13

local fib, err = funcs.call("demo.wasm:fibonacci_function", 10)
-- fib: 55
```

## Tres Formas de Expor WASM

| Abordagem | Tipo de Entrada | Caso de Uso |
|-----------|----------------|-------------|
| Funcao | `function.wasm` | Chamada de Lua ou outro WASM via `funcs.call()` |
| Comando CLI | `process.wasm` + `meta.command` | Comandos de terminal via `wippy run <name>` |
| Endpoint HTTP | `function.wasm` + `http.endpoint` | API REST via transporte `wasi-http` |

Todas as tres abordagens usam o mesmo binario `.wasm` compilado e referenciam os mesmos metodos.

## Compilando para Outras Linguagens

Qualquer linguagem que compila para o WebAssembly Component Model funciona com o Wippy. Defina sua interface WIT, implemente os exports, compile para `.wasm` e configure as entradas em `_index.yaml`.

## Veja Tambem

- [Visao Geral WASM](wasm/overview.md) - Visao geral do runtime WebAssembly
- [Funcoes WASM](wasm/functions.md) - Referencia de configuracao de funcoes
- [Processos WASM](wasm/processes.md) - Referencia de configuracao de processos
- [Funcoes Host](wasm/hosts.md) - Imports WASI disponiveis
- [Referencia CLI](guides/cli.md) - Documentacao de comandos CLI
