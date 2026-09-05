---
title: "Хост-функции"
description: "WASM-модули получают доступ к возможностям среды выполнения через импорт хост-функций. Каждый импорт объявляется явно для каждой записи в списке imports."
---

# Хост-функции

WASM-модули получают доступ к возможностям среды выполнения через импорт хост-функций. Каждый импорт объявляется явно для каждой записи в списке `imports`.

## Типы импортов

| Import | Пространство имён | Тип модуля | Описание |
|--------|-------------------|------------|----------|
| `wasi:cli` | `wasi:cli/*` | component | Окружение, выход, stdin/stdout/stderr, терминал |
| `wasi:io` | `wasi:io/error`, `wasi:io/streams` | component | Потоки и обработка ошибок |
| `wasi:poll` | `wasi:io/poll` | component | Асинхронный опрос / кооперативная передача управления |
| `wasi:clocks` | `wasi:clocks/*` | component | Системные и монотонные часы |
| `wasi:filesystem` | `wasi:filesystem/*` | component | Доступ к файловой системе через смонтированные директории |
| `wasi:random` | `wasi:random/*` | component | Криптографически стойкая и нестойкая генерация случайных чисел |
| `wasi:sockets` | `wasi:sockets/*` | component | TCP/UDP-сети и DNS-разрешение |
| `wasi:http` | `wasi:http/*` | component | Исходящие HTTP-запросы клиента |
| `funcs` | `wippy:runtime/funcs@0.1.0` | component | Вызов функций реестра из госта |
| `wasi1` | `wasi_snapshot_preview1` | core | Импорты совместимости с WASI Preview 1 |
| `socket` | `wippy:runtime/socket@0.1.0` | core | Исходящий TCP, принадлежащий инстансу, через целочисленные импорты |

Восемь профилей `wasi:*` и `funcs` доступны только для компонентов: объявление любого из них на core-модуле делает запись невалидной. `wasi1` и `socket` предоставляют core-импорты.

Каждый профиль разрешается по своему короткому имени, по любому из предоставляемых им пространств имён интерфейсов и по версионированному пространству имён. Суффикс версии отбрасывается перед поиском, поэтому `wasi:io/poll`, `wasi:io/poll@0.2.3` и `wasi:poll` выбирают один и тот же профиль.

Импорт, не разрешающийся ни в один профиль, делает запись невалидной с ошибкой `unsupported wasm host import: <id>`; профиль только для компонентов на core-модуле даёт ошибку `wasm host import requires component module: <id>`.

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
    pool:
      type: inline
```

Объявляйте только те импорты, которые действительно нужны вашему модулю.

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

**Interfaces:** `wasi:sockets/instance-network`, `wasi:sockets/ip-name-lookup`, `wasi:sockets/tcp`, `wasi:sockets/tcp-create-socket`, `wasi:sockets/udp`, `wasi:sockets/udp-create-socket`

TCP- и UDP-сети с DNS-разрешением. Операции с сокетами приостанавливают гост и проходят через диспетчер, который выполняет каждый dial, bind и lookup на [сетевом сервисе](system/network.md).

### wasi:http

**Interfaces:** `wasi:http/types`, `wasi:http/outgoing-handler`

Исходящие HTTP-запросы клиента из WASM-модулей. Поддерживает типы запросов/ответов, определенные спецификацией WASI HTTP.

## funcs

**Namespace:** `wippy:runtime/funcs@0.1.0`

Вызывает функции реестра из госта-компонента. Доступны две точки входа:

```wit
interface funcs {
  call-string: func(target: string, input: string) -> result<string, string>;
  call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

`target` — это Registry ID в форме `namespace:name`. Каждый вызов проверяется политикой как `funcs.call` для этой цели, поэтому гост может дотянуться только до функций, уже разрешённых областью вызывающей стороны.

## wasi1

**Namespace:** `wasi_snapshot_preview1`

Объявляет, что core-модуль линкуется с WASI Preview 1. Профиль также разрешается по именам `preview1` и `wasi-preview1`. Собственных хостов он не регистрирует; импорты Preview 1 удовлетворяются нижележащей средой выполнения WASM.

## socket

**Namespace:** `wippy:runtime/socket@0.1.0`

Исходящий TCP для core-модулей (не компонентов). Хост экспортирует четыре целочисленные функции, поэтому госту не нужен инструментарий компонентов:

| Функция | Сигнатура | Результат |
|---------|-----------|-----------|
| `connect` | `(host_ptr: i32, host_len: i32, port: i32, timeout_ms: i32) -> i64` | `status << 32 \| handle` |
| `send` | `(handle: i32, buf_ptr: i32, buf_len: i32) -> i64` | `status << 32 \| written` |
| `recv` | `(handle: i32, out_ptr: i32, out_cap: i32) -> i64` | `status << 32 \| read` |
| `close` | `(handle: i32) -> i32` | `status` |

Старшие 32 бита 64-битного результата несут статус; младшие 32 бита — значение.

| Статус | Значение | Смысл |
|--------|----------|-------|
| `OK` | 0 | Операция успешна |
| `Invalid` | 1 | Неверные аргументы или область памяти вне диапазона |
| `Denied` | 2 | Сетевой сервис отказал в dial |
| `Failed` | 3 | Операция завершилась неудачей |
| `UnknownHandle` | 4 | Handle не является открытым соединением этого инстанса |
| `Limit` | 5 | Достигнут `max_open_sockets` |
| `Timeout` | 6 | Истёк дедлайн dial или чтения/записи |

`connect` читает имя хоста из памяти госта; `host_len` должен быть от 1 до 253 байт, а `port` — от 1 до 65535. `timeout_ms` сужает дедлайн dial: эффективный дедлайн — меньшее из `timeout_ms` и `socket_timeout_ms` записи. `send` и `recv` ограничены `socket_timeout_ms`. Чистый конец потока `recv` сообщает как `OK` с количеством прочитанных байт 0.

Соединения принадлежат инстансу, который их открыл. Handle бессмыслен для другого инстанса, число открытых сокетов считается по инстансам, и все соединения закрываются при закрытии инстанса или переработке тёплого воркера.

## Авторизация сети

Ни один из сокет-хостов не решает вопрос доступа сам. Каждый dial, bind и lookup проходит через сетевой сервис среды выполнения, который проверяет разрешения `socket.connect`, `socket.listen` и `socket.resolve`, применяет политику приватных IP и маршрутизирует через [оверлейную сеть](system/network.md), если она выбрана. `wasi:sockets` дополнительно предварительно проверяет `socket.resolve` перед DNS-запросом и `socket.listen` перед bind UDP.

## См. также

- [Обзор](wasm/overview.md) - Обзор среды выполнения WebAssembly
- [Функции](wasm/functions.md) - Конфигурация функций WASM
- [Процессы](wasm/processes.md) - Запуск WASM как процессов
- [Сетевые оверлеи](system/network.md) - Выбор оверлея и разрешения сокетов
