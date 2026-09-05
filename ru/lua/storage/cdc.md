---
title: "CDC"
description: "<secondary-label ref='storage'/ <secondary-label ref='stream'/ <secondary-label ref='nondeterministic'/"
---

# CDC
<secondary-label ref="storage"/>
<secondary-label ref="stream"/>
<secondary-label ref="nondeterministic"/>

Подписка на потоки Change Data Capture из источников [`db.cdc.postgres`](system/cdc.md) и [`db.cdc.sqlite`](system/cdc.md). Позволяет перечислить настроенные источники, открыть поток и получать события изменений на уровне строк через канал. API нейтрален к драйверу: оба вида возвращают одну и ту же информацию об источнике и одни и те же события изменений, различаясь только [возможностями](system/cdc.md#capabilities), которые они публикуют.

## Загрузка

```lua
local cdc = require("cdc")
```

## list_sources

Перечислить настроенные источники CDC, которые вызывающей стороне разрешено видеть:

```lua
local sources, err = cdc.list_sources()
for _, s in ipairs(sources) do
    print(s.id, s.kind, s.state, s.capabilities.before_images)
end
```

Источники, на которые у вызывающей стороны нет `cdc.source`, пропускаются, а не приводят к ошибке.

**Возвращает:** `table, error`

## source

Получить один источник по имени (его ID записи):

```lua
local info, err = cdc.source("app:pg_cdc")
if info == nil then
    -- такого источника нет
end
```

**Возвращает:** `table, error` (информация об источнике либо `nil`, если не найден)

## stream

Открыть поток изменений на источнике. Возвращает `cdc.Stream`, чей канал доставляет события изменений:

```lua
local stream, err = cdc.stream("app:pg_cdc", {
    tables = { "public.users", "public.orders" },
    ops    = { "insert", "update" },
    buffer = 128,
})
```

| Параметр | Тип | По умолчанию | Описание |
|-----------|------|---------|-------------|
| `name` | string | обязателен | Имя источника (ID записи) |
| `opts.tables` | []string | - | Ограничить этими таблицами (опустите для всех захватываемых таблиц) |
| `opts.ops` | []string | - | Ограничить этими операциями: `insert`, `update`, `delete`, `truncate` |
| `opts.buffer` | int | 64 | Ёмкость очереди в элементах (1-65536) |
| `opts.max_bytes` | int | 1048576 | Бюджет очереди в байтах для этого подписчика (1 МиБ) |
| `opts.snapshot` | bool | значение записи | Запросить для этого потока снимок с переходом в живой режим |
| `opts.after` | string | - | Непрозрачный курсор возобновления из поля `cursor` предыдущего события |

Неизвестные ключи опций отклоняются с `errors.INVALID`. Имена таблиц сопоставляются без учёта регистра как с полным именем отношения, так и с голым именем таблицы. Строки снимка фильтруются только по `tables`; `ops` применяется к живым изменениям.

Поток получает снимок, если либо `opts.snapshot` равно true, либо в записи источника задано поле `snapshot`; строки снимка приходят первыми с `op = "snapshot"`, затем поток без разрыва продолжается живыми изменениями. `opts.after` учитывается только драйверами, у которых установлена возможность `capture_resume` — все поставляемые сегодня драйверы возвращают на него `errors.INVALID` ("cdc operation is not supported by this source").

Фильтры лишь сужают доставку. Доступ к источнику даёт разрешение `cdc.subscribe`, а не фильтр.

**Возвращает:** `Stream, error`

## Методы Stream

### channel

Вернуть канал, принимающий события изменений. Первый вызов оформляет подписку на источник (уступает управление); последующие вызовы возвращают тот же канал. `:receive()` блокируется до прихода следующего изменения либо возвращает `nil`, когда поток завершается:

```lua
local stream = cdc.stream("app:pg_cdc")
local ch = stream:channel()

while true do
    local change = ch:receive()
    if change == nil then break end   -- поток закрыт

    if change.op == "snapshot" then
        seed_row(change.table, change.after)
    elseif change.op == "insert" then
        handle_new_user(change.table, change.after)
    elseif change.op == "update" then
        handle_update(change.table, change.before, change.after)
    elseif change.op == "delete" then
        handle_delete(change.table, change.before)
    end
end
```

Поток ленивый: сначала создайте его, затем вызовите `channel()` до генерации записей, которые он должен наблюдать. Это живое наблюдение, а не воспроизведение изменений, сделанных до подписки.

Когда источник завершает поток с ошибкой, канал доставляет значение ошибки перед закрытием. `receive` — псевдоним для `channel`.

### close

Остановить подписку и освободить поток. Идемпотентно; также закрывается автоматически по завершении задачи. `release` — псевдоним для `close`.

```lua
stream:close()
```

## Событие изменения

Каждое сообщение, полученное в канале, — это таблица изменения:

| Поле | Описание |
|-------|-------------|
| `op` | Операция: `insert`, `update`, `delete`, `snapshot` или `truncate` |
| `schema` | Схема таблицы |
| `table` | Имя таблицы |
| `relation` | Полное имя отношения |
| `before` | Состояние строки до изменения (`update`, `delete`; требует возможности `before_images`) |
| `after` | Состояние строки после изменения (`insert`, `update`, `snapshot`; отсутствует для `delete`) |
| `source` | ID записи источника |
| `source_id` | ID записи источника в виде ID реестра |
| `generation` | Поколение источника, породившее событие |
| `cursor` | Непрозрачная позиция события внутри источника |
| `transaction` | Идентификатор транзакции, когда драйвер его сообщает |
| `lsn` | Номер последовательности журнала для изменения (`db.cdc.postgres`) |
| `commit_lsn` | LSN фиксирующей транзакции (когда применимо) |
| `xid` | ID транзакции (когда применимо) |
| `unchanged` | Колонки, значение которых не передавалось (неизменённые значения TOAST) |
| `error` | Описание ошибки, сообщённое драйвером и переданное в событии |

`before` и `after` — это отображения строки с ключами по именам колонок.

## Информация об источнике

`cdc.source` и каждый элемент `cdc.list_sources` возвращают одну и ту же запись:

| Поле | Описание |
|-------|-------------|
| `id` | ID записи |
| `kind` | `db.cdc.postgres` или `db.cdc.sqlite` |
| `name` | Имя источника (ID записи) |
| `state` | `unknown`, `starting`, `running`, `faulted` или `stopped` |
| `generation` | Текущее поколение источника |
| `epoch` | То же значение, что и `generation` |
| `engine` | Имя движка, когда драйвер его сообщает |
| `db_resource` | ID записи наблюдаемого SQL-ресурса (`db.cdc.sqlite`) |
| `slot` | Имя слота репликации (`db.cdc.postgres`) |
| `publication` | Публикация Postgres, когда настроена |
| `tables` | Захватываемые таблицы, когда настроены |
| `streaming` | Работает ли источник в данный момент |
| `failover` | Режим слота отказоустойчивости (`db.cdc.postgres`) |
| `temporary` | Временный слот (`db.cdc.postgres`) |
| `snapshot` | Значение снимка по умолчанию на уровне записи |
| `faulted` | Находится ли источник в состоянии `faulted` |
| `error` | Последняя ошибка источника, если она записана |
| `admission` | `active`, `snapshots`, `reserved_bytes`, `rejected` |
| `capabilities` | `snapshot`, `capture_resume`, `replayable`, `captures_external_writes`, `before_images`, `coalesced` |

Ветвитесь по `capabilities`, а не по `kind`:

```lua
local info = cdc.source("app:changes")
if not info.capabilities.before_images then
    -- события удаления не несут образа строки; храните собственное последнее известное состояние
end
```

Семантику полей см. в [источниках CDC](system/cdc.md#source-info).

## Разрешения

| Действие | Ресурс | Описание |
|--------|----------|-------------|
| `cdc.source` | ID записи источника | `cdc.source`; также фильтрует `cdc.list_sources` |
| `cdc.subscribe` | ID записи источника | `cdc.stream`, проверяется повторно при установлении подписки |

Запрещённое действие возвращает `errors.PERMISSION_DENIED`.

## Ошибки

| Условие | Вид |
|-----------|------|
| Нет контекста / нет PID процесса | `errors.INTERNAL` |
| Требуется имя источника | `errors.INVALID` |
| Некорректная или неизвестная опция потока | `errors.INVALID` |
| `after` на источнике без `capture_resume` | `errors.INVALID` |
| Источник не зарегистрирован | `errors.NOT_FOUND` |
| Источник не запущен или заменяется | `errors.UNAVAILABLE` |
| Исчерпана ёмкость подписок | `errors.UNAVAILABLE` |
| Доступ запрещён | `errors.PERMISSION_DENIED` |

О работе с ошибками см. [Обработка ошибок](lua/core/errors.md).

## См. также

- [Change Data Capture](system/cdc.md) - Настройка источников и возможности
- [Channel](lua/core/channel.md) - Семантика каналов
- [Database](system/database.md) - Сервисы SQL-баз данных
