# Хост-функции

WASM-модули получают доступ к возможностям среды выполнения через импорт хост-функций. Каждый импорт объявляется явно для каждой записи в списке `imports`.

## Типы импортов

| Import | Описание |
|--------|----------|
| `funcs` | Вызов других функций Wippy (Lua или WASM) из WASM-модуля |
| `wasi:cli` | Окружение, выход, stdin/stdout/stderr, терминал |
| `wasi:io` | Потоки, обработка ошибок, опрос (polling) |
| `wasi:clocks` | Системные и монотонные часы |
| `wasi:filesystem` | Доступ к файловой системе через смонтированные директории |
| `wasi:random` | Криптографически стойкие случайные числа |
| `wasi:sockets` | TCP/UDP-сети и DNS-разрешение |
| `wasi:http` | Исходящие HTTP-запросы клиента |

Включите импорты в конфигурации записи:

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
      - funcs
    pool:
      type: inline
```

Объявляйте только те импорты, которые действительно нужны вашему модулю.

## Хост функций Wippy

**Namespace:** `wippy:runtime/funcs@0.1.0`

Позволяет WASM-модулям вызывать любые функции в реестре Wippy, включая Lua-функции и другие WASM-функции.

### Интерфейс

```wit
interface funcs {
    call-string: func(target: string, input: string) -> result<string, string>;
    call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

| Function | Описание |
|----------|----------|
| `call-string` | Вызов функции со строковым вводом и выводом |
| `call-bytes` | Вызов функции с бинарным вводом и выводом |

Параметр `target` использует формат ID реестра: `namespace:entry_name`.

### Пример

WASM-компонент, вызывающий Lua-функцию:

```yaml
  - name: orchestrator
    kind: function.wasm
    fs: myns:assets
    path: /orchestrator.wasm
    hash: sha256:...
    method: run
    imports:
      - funcs
    pool:
      type: lazy
      max_size: 4
```

## Импорты WASI

Каждый импорт `wasi:*` включает группу связанных интерфейсов WASI Preview 2.

### wasi:clocks

**Interfaces:** `wasi:clocks/wall-clock`, `wasi:clocks/monotonic-clock`

Системные и монотонные часы для операций со временем. Монотонные часы интегрируются с диспетчером Wippy для асинхронного sleep.

### wasi:io

**Interfaces:** `wasi:io/error`, `wasi:io/streams`, `wasi:io/poll`

Операции чтения/записи потоков и асинхронный опрос (polling). Интерфейс poll обеспечивает кооперативную передачу управления через диспетчер.

### wasi:cli

**Interfaces:** `wasi:cli/environment`, `wasi:cli/exit`, `wasi:cli/stdin`, `wasi:cli/stdout`, `wasi:cli/stderr`

Доступ к переменным окружения, кодам выхода процесса и стандартным потокам ввода/вывода. Переменные окружения привязываются из реестра окружения Wippy через конфигурацию WASI.

### wasi:filesystem

**Interfaces:** `wasi:filesystem/types`, `wasi:filesystem/preopens`

Доступ к файловой системе через смонтированные директории. Точки монтирования настраиваются для каждой записи и связывают записи файловой системы Wippy с путями в госте.

```yaml
wasi:
  mounts:
    - fs: myns:data
      guest: /data
      read_only: true
```

### wasi:random

**Interfaces:** `wasi:random/random`, `wasi:random/insecure`, `wasi:random/insecure-seed`

Криптографически стойкая и нестойкая генерация случайных чисел.

### wasi:sockets

**Interfaces:** `wasi:sockets/network`, `wasi:sockets/instance-network`, `wasi:sockets/ip-name-lookup`, `wasi:sockets/tcp`, `wasi:sockets/tcp-create-socket`, `wasi:sockets/udp`

TCP- и UDP-сети с DNS-разрешением. Операции с сокетами интегрируются с диспетчером для асинхронного I/O.

### wasi:http

**Interfaces:** `wasi:http/types`, `wasi:http/outgoing-handler`

Исходящие HTTP-запросы клиента из WASM-модулей. Поддерживает типы запросов/ответов, определенные спецификацией WASI HTTP.

## См. также

- [Обзор](wasm/overview.md) - Обзор среды выполнения WebAssembly
- [Функции](wasm/functions.md) - Конфигурация функций WASM
- [Процессы](wasm/processes.md) - Запуск WASM как процессов
