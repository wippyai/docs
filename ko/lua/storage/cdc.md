---
title: "CDC"
description: "PostgreSQL change data capture stream을 구독하고 row-level event를 받습니다."
---

# CDC
<secondary-label ref="storage"/>
<secondary-label ref="stream"/>
<secondary-label ref="nondeterministic"/>

`cdc` 모듈은 [`db.cdc.postgres`](../../system/cdc.md) source의 PostgreSQL change data capture stream을 구독합니다. 설정된 source를 나열하고 stream을 열며 channel을 통해 row-level change event를 전달합니다.

이 페이지는 부분 subscription recipe를 포함하는 API 참조입니다. 예제에는 설정되어 실행 중인 CDC source가 필요하며, delivery channel을 열려면 실행 중인 process context도 필요합니다. `handle_new_user` 같은 application callback은 호출자가 제공하는 placeholder입니다.

## 로딩

```lua
local cdc = require("cdc")
```

## `list_sources`

설정된 CDC source를 나열합니다.

```lua
local sources, err = cdc.list_sources()
if err then return nil, err end
for _, s in ipairs(sources) do
    print(s.name, s.slot, s.streaming)
end
```

각 source는 `name`, `slot`, `publication`, `tables`, `streaming`, `failover`, `temporary`, `snapshot` field를 가진 table입니다. [CDC source](../../system/cdc.md#source-정보)를 확인하십시오.

**반환값:** `table, error`

## `source`

레지스트리 엔트리 ID 또는 replication slot 이름으로 source 하나를 조회합니다.

```lua
local info, err = cdc.source("app:pg_cdc")
if err then return nil, err end
if info == nil then
    -- no such source
end
```

**반환값:** `table, error`(source info, 찾지 못하면 `nil`)

## `stream`

source에서 change stream을 엽니다. 반환된 `cdc.Stream`은 change event를 전달하는 channel을 제공합니다.

```lua
local stream, err = cdc.stream("app:pg_cdc", {
    tables = { "public.users", "public.orders" },
    ops    = { "insert", "update" },
    buffer = 128,
})
if err then return nil, err end

-- The caller owns stream until close(), release(), or task cleanup.
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | source 레지스트리 ID 또는 replication slot 이름 |
| `opts.tables` | []string | 해당 table만 필터링(설정된 모든 table은 생략) |
| `opts.ops` | []string | 해당 작업만 필터링: `insert`, `update`, `delete`, `truncate`, `snapshot` |
| `opts.buffer` | int | source subscription buffer 크기(1-65536, 기본값: 128) |

**반환값:** `Stream, error`

Lua delivery channel은 별도로 64의 고정 capacity를 가집니다. `buffer` option은 이 channel이 아니라 PostgreSQL source subscription을 제어합니다.

## Stream method

### `channel`

change event를 받는 channel을 반환합니다. 첫 호출은 source를 구독하고 yield하며, 이후 호출은 같은 channel을 반환합니다. 첫 호출은 subscription error를 반환할 수 있습니다. Channel `:receive()`는 change에 대해 `value, true`, stream이 끝나면 `nil, false`를 반환합니다.

```lua
local stream, stream_err = cdc.stream("app:pg_cdc")
if stream_err then return nil, stream_err end
local ch, subscribe_err = stream:channel()
if subscribe_err then
    stream:close()
    return nil, subscribe_err
end

while true do
    local change, ok = ch:receive()
    if not ok then break end

    if change.op == "insert" then
        handle_new_user(change.table, change.after)
    elseif change.op == "update" then
        handle_update(change.table, change.before, change.after)
    elseif change.op == "delete" then
        handle_delete(change.table, change.before)
    end
end

local _, close_err = stream:close()
if close_err then return nil, close_err end
```

`receive`는 `channel`의 alias입니다.

### `close`

subscription을 중지하고 stream을 release합니다. 이 method는 idempotent이며 런타임도 task scope가 끝날 때 stream을 닫습니다. `release`는 `close`의 alias입니다.

```lua
local _, err = stream:close()
if err then return nil, err end
```

## Change event

channel에서 받은 각 message는 change table입니다.

| Field | Description |
|-------|-------------|
| `op` | 작업: `insert`, `update`, `delete`, `truncate`, `snapshot` |
| `schema` | table schema |
| `table` | table 이름 |
| `relation` | `schema.table` |
| `before` | 변경 전 row 상태(`update`, `delete`; `insert`에는 없음) |
| `after` | 변경 후 row 상태(`insert`, `update`, `snapshot`; `delete`에는 없음) |
| `source` | source 이름 |
| `lsn` | 변경의 log sequence number |
| `commit_lsn` | commit transaction의 LSN(해당하는 경우) |
| `xid` | transaction ID(해당하는 경우) |

`before`와 `after`는 column 이름을 key로 하는 row map입니다.

## 오류

| Condition | Kind |
|-----------|------|
| stream 생성 시 Lua context 없음 | `errors.INTERNAL` |
| 첫 subscription 시 process PID 없음 | raised Lua error |
| source 이름 필요 | `errors.INVALID` |
| 잘못된 buffer 크기 | `errors.INVALID` |
| 첫 `channel()` / `receive()` 호출에서 source를 찾지 못함 | `errors.NOT_FOUND` |
| `list_sources()` / `source()`에서 source inspector를 사용할 수 없음 | `errors.INTERNAL` |
| subscription 이후 process binding을 사용할 수 없음 | `errors.INTERNAL` |
| 첫 `channel()` / `receive()` 호출에서 source subscription 실패 | source-dependent structured error |

오류 사용법은 [오류 처리](../core/errors.md)를 확인하십시오.

## 관련 문서

- [Change Data Capture](../../system/cdc.md) - `db.cdc.postgres` source 설정
- [Channel](../core/channel.md) - Channel semantics
- [데이터베이스](../../system/database.md) - SQL 데이터베이스 서비스
