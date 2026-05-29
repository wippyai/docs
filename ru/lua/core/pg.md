# Группы процессов
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Объединение процессов в именованные группы и широковещательная рассылка каждому члену в кластере. Смоделировано по образцу Erlang/OTP `pg`: группы динамические, процесс может принадлежать многим группам, а членство отслеживается по всему кластеру и является eventually consistent.

Тип записи scope и его конфигурацию см. в [Группах процессов](system/process-groups.md). Общую модель кластеризации см. в [Руководстве по кластеру](guides/cluster.md).

## Загрузка

```lua
local pg = require("pg")
```

## Открытие области

Группа процессов живёт внутри **области (scope)** — записи реестра `pg.scope`. Откройте её, чтобы получить экземпляр для работы:

```lua
local group, err = pg.open("app:pg")
if err then
    return nil, err
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | string | ID записи scope (формат: `"namespace:name"`) |

**Возвращает:** `pg.Instance, error`

**Разрешение:** `pg.open` на `id` области

Экземпляр освобождается автоматически при выходе процесса; вызовите `release()` для досрочного освобождения. Все остальные операции — методы экземпляра, вызываемые через `:`.

## Вступление и выход

```lua
local ok, err = group:join("workers")           -- одна группа
local ok, err = group:join({"workers", "all"})  -- пакетно
local ok, err = group:leave("workers")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `group` | string \| string[] | Имя группы или список имён для пакетной операции |

**Возвращает:** `boolean, error`

Процесс может вступать в одну группу несколько раз; для полного выхода нужно покинуть группу столько же раз (семантика multi-join). `leave` при пакетной операции best-effort и возвращает ошибку только если процесс не является членом ни одной из указанных групп.

**Разрешения:** `pg.join` / `pg.leave` на каждое имя группы

## Список членов

```lua
local members, err = group:get_members("workers")        -- все ноды
local local_members, err = group:get_local_members("workers")  -- только эта нода
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `group` | string | Имя группы |

**Возвращает:** `string[], error` — массив строк PID (пустой для неизвестной группы)

**Разрешения:** `pg.get_members` / `pg.get_local_members` на имя группы

## Список групп

```lua
local groups, err = group:which_groups()         -- все группы в кластере
local local_groups, err = group:which_local_groups()  -- группы с локальным членом
```

**Возвращает:** `string[], error` — имена групп, имеющих хотя бы одного члена

**Разрешения:** `pg.which_groups` / `pg.which_local_groups`

## Широковещательная рассылка

Отправить сообщение каждому члену группы. Каждый член получает его под `topic` от вызывающего процесса — обрабатывайте через `process.listen(topic)`.

```lua
local ok, err = group:broadcast("workers", "task", {id = 42})   -- все ноды
local ok, err = group:broadcast_local("workers", "task", {id = 42})  -- только эта нода
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `group` | string | Целевая группа |
| `topic` | string | Топик сообщения |
| `...` | any | Ноль или более значений payload |

**Возвращает:** `boolean, error`

**Разрешения:** `pg.broadcast` / `pg.broadcast_local` на имя группы

## Мониторинг группы

`monitor` подписывается на события вступления/выхода для одной группы и атомарно возвращает текущих членов — ни одно изменение членства не может проскользнуть между снимком и подпиской.

```lua
local sub, members, err = group:monitor("workers")
if err then
    return nil, err
end

for _, pid in ipairs(members) do
    -- текущие члены на момент подписки
end

local ch = sub:channel()
local event = ch:receive()  -- {kind = "member.joined" | "member.left", path = "workers", data = {...}}

sub:close()  -- отписаться; sub:close({flush = true}) сначала сбрасывает очередь событий
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `group` | string | Группа для наблюдения |

**Возвращает:** `pg.Subscription, string[], error` — подписка и снимок текущих членов

**Разрешение:** `pg.monitor` на имя группы

## Наблюдение за всеми группами

`events` подписывается на изменения членства во всех группах области и возвращает снимок всех групп с их членами.

```lua
local sub, snapshot, err = group:events()
-- snapshot: { ["workers"] = {pid, ...}, ["all"] = {pid, ...} }

local event = sub:channel():receive()
sub:close()
```

**Возвращает:** `pg.Subscription, table, error`

**Разрешение:** `pg.events`

### Поля событий

События, доставляемые по каналу подписки:

| Поле | Тип | Описание |
|------|-----|----------|
| `system` | string | Всегда `"pg"` |
| `kind` | string | `"member.joined"` или `"member.left"` |
| `path` | string | Имя группы |
| `data` | table | `{Group = string, PIDs = string[]}` — затронутые члены |

Каналы подписки буферизованы (ёмкость 64); при заполнении буфера медленным потребителем дальнейшие события для этой подписки отбрасываются.

## Освобождение

```lua
group:release()
```

Немедленно освобождает экземпляр. Идемпотентно; после освобождения каждый метод возвращает ошибку. Очистка также выполняется автоматически при выходе процесса.

**Возвращает:** `boolean`

## Разрешения

| Разрешение | Метод | Ресурс |
|------------|-------|--------|
| `pg.open` | `pg.open()` | id области |
| `pg.join` | `join()` | имя группы |
| `pg.leave` | `leave()` | имя группы |
| `pg.get_members` | `get_members()` | имя группы |
| `pg.get_local_members` | `get_local_members()` | имя группы |
| `pg.which_groups` | `which_groups()` | (область) |
| `pg.which_local_groups` | `which_local_groups()` | (область) |
| `pg.broadcast` | `broadcast()` | имя группы |
| `pg.broadcast_local` | `broadcast_local()` | имя группы |
| `pg.monitor` | `monitor()` | имя группы |
| `pg.events` | `events()` | (область) |

## Ошибки

| Условие | Kind |
|---------|------|
| Разрешение отклонено | `errors.PERMISSION_DENIED` |
| Отсутствует или пустой аргумент | `errors.INVALID` |
| Область не найдена | `errors.NOT_FOUND` |
| Выход из группы без членства | `errors.INVALID` |
| Экземпляр освобождён | `errors.INVALID` |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.

## См. также

- [Группы процессов](system/process-groups.md) — тип записи scope и конфигурация
- [Кластер](guides/cluster.md) — membership и модель кластеризации
- [Управление процессами](lua/core/process.md) — создание и обмен сообщениями с отдельными процессами
