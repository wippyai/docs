# Запуск Rust на Wippy

Сборка Rust WebAssembly-компонента и его запуск как функций, CLI-команд и HTTP-эндпоинтов.

## Что мы создаем

Rust-компонент с четырьмя экспортируемыми функциями:

- **greet** - Принимает имя, возвращает приветствие
- **add** - Складывает два целых числа
- **fibonacci** - Вычисляет n-е число Фибоначчи
- **list-files** - Выводит список файлов в смонтированной директории

Мы представим их как вызываемые функции, CLI-команду и HTTP-эндпоинт.

## Предварительные требования

- [Rust toolchain](https://rustup.rs/) с целевой платформой `wasm32-wasip1`
- [cargo-component](https://github.com/bytecodealliance/cargo-component)

```bash
rustup target add wasm32-wasip1
cargo install cargo-component
```

## Структура проекта

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

## Шаг 1: Создание WIT-интерфейса

WIT (WebAssembly Interface Types) определяет контракт между хостом и гостем:

Создайте `demo/wit/world.wit`:

```wit
package component:demo;

world demo {
    export greet: func(name: string) -> string;
    export add: func(a: s32, b: s32) -> s32;
    export fibonacci: func(n: u32) -> u64;
    export list-files: func(path: string) -> string;
}
```

Каждый экспорт становится функцией, которую Wippy может вызвать.

## Шаг 2: Реализация на Rust

Создайте `demo/Cargo.toml`:

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

Создайте `demo/src/lib.rs`:

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

Модуль `bindings` генерируется `cargo-component` из WIT-определения.

## Шаг 3: Сборка компонента

```bash
cd demo
cargo component build --release
```

Результат -- `target/wasm32-wasip1/release/demo.wasm`. Скопируйте его в приложение Wippy:

```bash
mkdir -p ../app/src/demo/wasm
cp target/wasm32-wasip1/release/demo.wasm ../app/src/demo/wasm/demo_component.wasm
```

Получите SHA-256 хеш для проверки целостности:

```bash
sha256sum ../app/src/demo/wasm/demo_component.wasm
```

## Шаг 4: Приложение Wippy

### Инфраструктура

Создайте `app/src/_index.yaml`:

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

### Функции WASM

Создайте `app/src/demo/wasm/_index.yaml`:

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

Ключевые моменты:
- Одна запись `fs.directory` предоставляет WASM-бинарник
- Несколько функций ссылаются на один бинарник с разными значениями `method`
- Поле `hash` проверяет целостность бинарника при загрузке
- Пул `inline` создает новый экземпляр на каждый вызов

### Функции с WASI

Функция `list-files` обращается к файловой системе, поэтому ей нужны WASI-импорты:

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

Секция `wasi.mounts` связывает запись файловой системы Wippy с путем в госте. Внутри WASM-модуля `/data` указывает на директорию `demo.wasm:assets`.

### CLI-команды

Создайте `app/src/demo/_index.yaml`:

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

Блок `meta.command` регистрирует процесс как именованную CLI-команду. Команда `greet` не требует WASI-импортов, так как работает только со строками. Команда `ls` требует доступ к файловой системе.

### HTTP-эндпоинт

Добавьте в `app/src/demo/wasm/_index.yaml`:

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

Транспорт `wasi-http` преобразует контекст HTTP-запроса/ответа в аргументы и результаты WASM.

## Шаг 5: Инициализация и запуск

```bash
cd app
wippy init
```

### Запуск CLI-команд

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

### Запуск как сервис

```bash
wippy run
```

Это запускает HTTP-сервер на порту 8090. Проверка эндпоинта:

```bash
curl -X POST http://localhost:8090/greet
```

### Вызов из Lua

Функции WASM вызываются так же, как Lua-функции:

```lua
local funcs = require("funcs")

local greeting, err = funcs.call("demo.wasm:greet_function", "World")
-- greeting: "Hello, World!"

local sum, err = funcs.call("demo.wasm:add_function", 6, 7)
-- sum: 13

local fib, err = funcs.call("demo.wasm:fibonacci_function", 10)
-- fib: 55
```

## Три способа предоставления WASM

| Подход | Entry Kind | Вариант использования |
|--------|-----------|----------------------|
| Function | `function.wasm` | Вызов из Lua или другого WASM через `funcs.call()` |
| CLI Command | `process.wasm` + `meta.command` | Терминальные команды через `wippy run <name>` |
| HTTP Endpoint | `function.wasm` + `http.endpoint` | REST API через транспорт `wasi-http` |

Все три подхода используют один и тот же скомпилированный `.wasm`-бинарник и ссылаются на одни и те же методы.

## Сборка для других языков

Любой язык, компилируемый в WebAssembly Component Model, работает с Wippy. Определите WIT-интерфейс, реализуйте экспорты, скомпилируйте в `.wasm` и настройте записи в `_index.yaml`.

## См. также

- [Обзор WASM](wasm/overview.md) - Обзор среды выполнения WebAssembly
- [Функции WASM](wasm/functions.md) - Справочник по конфигурации функций
- [Процессы WASM](wasm/processes.md) - Справочник по конфигурации процессов
- [Хост-функции](wasm/hosts.md) - Доступные WASI-импорты
- [CLI-справочник](guides/cli.md) - Документация CLI-команд
