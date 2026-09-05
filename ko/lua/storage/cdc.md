---
title: "CDC"
description: "<secondary-label ref='storage'/ <secondary-label ref='stream'/ <secondary-label ref='nondeterministic'/"
---

# CDC
<secondary-label ref="storage"/>
<secondary-label ref="stream"/>
<secondary-label ref="nondeterministic"/>

[`db.cdc.postgres`](system/cdc.md)와 [`db.cdc.sqlite`](system/cdc.md) 소스의 변경 데이터 캡처(Change Data Capture) 스트림을 구독합니다. 구성된 소스를 나열하고, 스트림을 열고, 행 수준 변경 이벤트를 채널로 수신합니다. API는 드라이버 중립적입니다. 두 kind 모두 동일한 소스 정보와 동일한 변경 이벤트를 반환하며, 게시하는 [기능](system/cdc.md#capabilities)에서만 차이가 납니다.

## 로딩

```lua
local cdc = require("cdc")
```

## list_sources

호출자가 볼 수 있는 구성된 CDC 소스를 나열합니다:

```lua
local sources, err = cdc.list_sources()
for _, s in ipairs(sources) do
    print(s.id, s.kind, s.state, s.capabilities.before_images)
end
```

호출자가 `cdc.source` 권한을 갖지 못한 소스는 오류로 보고되지 않고 목록에서 생략됩니다.

**반환:** `table, error`

## source

이름(항목 ID)으로 소스 하나를 가져옵니다:

```lua
local info, err = cdc.source("app:pg_cdc")
if info == nil then
    -- 해당 소스 없음
end
```

**반환:** `table, error` (소스 정보, 찾지 못하면 `nil`)

## stream

소스에 변경 스트림을 엽니다. 채널이 변경 이벤트를 전달하는 `cdc.Stream`을 반환합니다:

```lua
local stream, err = cdc.stream("app:pg_cdc", {
    tables = { "public.users", "public.orders" },
    ops    = { "insert", "update" },
    buffer = 128,
})
```

| 매개변수 | 타입 | 기본값 | 설명 |
|-----------|------|---------|-------------|
| `name` | string | 필수 | 소스 이름 (항목 ID) |
| `opts.tables` | []string | - | 이 테이블들로 필터링 (모든 캡처 테이블을 원하면 생략) |
| `opts.ops` | []string | - | 이 작업들로 필터링: `insert`, `update`, `delete`, `truncate` |
| `opts.buffer` | int | 64 | 백로그 항목 용량 (1-65536) |
| `opts.max_bytes` | int | 1048576 | 이 구독자의 백로그 바이트 예산 (1 MiB) |
| `opts.snapshot` | bool | 항목 기본값 | 이 스트림에 대해 스냅샷/라이브 인계를 요청 |
| `opts.after` | string | - | 이전 이벤트의 `cursor`에서 얻은 불투명 재개 커서 |

알 수 없는 옵션 키는 `errors.INVALID`로 거부됩니다. 테이블 이름은 정규화된 릴레이션과 순수 테이블 이름 양쪽에 대해 대소문자를 구분하지 않고 매칭됩니다. 스냅샷 행은 `tables`로만 필터링되며, `ops`는 라이브 변경에 적용됩니다.

`opts.snapshot`이 true이거나 소스 항목의 `snapshot` 필드가 설정된 경우 스트림은 스냅샷을 받습니다. 스냅샷 행이 `op = "snapshot"`으로 먼저 도착한 다음, 스트림은 빈틈 없이 라이브 변경으로 이어집니다. `opts.after`는 `capture_resume` 기능이 설정된 드라이버만 존중합니다. 현재 제공되는 모든 드라이버는 이에 대해 `errors.INVALID`("cdc operation is not supported by this source")를 반환합니다.

필터는 전달 범위를 좁힐 뿐입니다. 소스에 대한 접근은 `cdc.subscribe` 권한이 부여하는 것이지, 필터가 부여하지 않습니다.

**반환:** `Stream, error`

## Stream 메서드

### channel

변경 이벤트를 수신하는 채널을 반환합니다. 첫 호출이 소스를 구독하며(양보합니다), 이후 호출은 동일한 채널을 반환합니다. `:receive()`는 다음 변경이 도착할 때까지 블로킹하거나, 스트림이 끝나면 `nil`을 반환합니다:

```lua
local stream = cdc.stream("app:pg_cdc")
local ch = stream:channel()

while true do
    local change = ch:receive()
    if change == nil then break end   -- 스트림 닫힘

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

스트림은 지연 방식입니다. 먼저 생성한 다음, 관찰해야 할 쓰기를 발생시키기 전에 `channel()`을 호출하십시오. 이는 라이브 관찰이며, 구독 이전에 발생한 변경의 재생이 아닙니다.

소스가 실패로 스트림을 종료하면, 채널은 닫히기 전에 오류 값을 전달합니다. `receive`는 `channel`의 별칭입니다.

### close

구독을 중단하고 스트림을 해제합니다. 멱등하며, 태스크 스코프에서 자동으로도 닫힙니다. `release`는 `close`의 별칭입니다.

```lua
stream:close()
```

## 변경 이벤트

채널에서 수신하는 각 메시지는 변경 테이블입니다:

| 필드 | 설명 |
|-------|-------------|
| `op` | 작업: `insert`, `update`, `delete`, `snapshot` 또는 `truncate` |
| `schema` | 테이블 스키마 |
| `table` | 테이블 이름 |
| `relation` | 정규화된 릴레이션 이름 |
| `before` | 변경 이전 행 상태 (`update`, `delete`, `before_images` 기능 필요) |
| `after` | 변경 이후 행 상태 (`insert`, `update`, `snapshot`, `delete`에는 없음) |
| `source` | 소스 항목 ID |
| `source_id` | 레지스트리 ID 형태의 소스 항목 ID |
| `generation` | 이벤트를 생성한 소스 세대 |
| `cursor` | 소스 내 이벤트별 불투명 위치 |
| `transaction` | 드라이버가 보고하는 경우의 트랜잭션 식별자 |
| `lsn` | 변경의 로그 시퀀스 번호 (`db.cdc.postgres`) |
| `commit_lsn` | 커밋 트랜잭션의 LSN (해당하는 경우) |
| `xid` | 트랜잭션 ID (해당하는 경우) |
| `unchanged` | 값이 전송되지 않은 컬럼 (변경되지 않은 TOAST 값) |
| `error` | 이벤트에 실린 드라이버 보고 오류 설명 |

`before`와 `after`는 컬럼 이름을 키로 하는 행 맵입니다.

## 소스 정보

`cdc.source`와 `cdc.list_sources`의 각 항목은 동일한 레코드를 반환합니다:

| 필드 | 설명 |
|-------|-------------|
| `id` | 항목 ID |
| `kind` | `db.cdc.postgres` 또는 `db.cdc.sqlite` |
| `name` | 소스 이름 (항목 ID) |
| `state` | `unknown`, `starting`, `running`, `faulted` 또는 `stopped` |
| `generation` | 현재 소스 세대 |
| `epoch` | `generation`과 동일한 값 |
| `engine` | 드라이버가 보고하는 경우의 엔진 이름 |
| `db_resource` | 관찰 대상 SQL 리소스 항목 ID (`db.cdc.sqlite`) |
| `slot` | 복제 슬롯 이름 (`db.cdc.postgres`) |
| `publication` | 구성된 경우 Postgres publication |
| `tables` | 구성된 경우 캡처 대상 테이블 |
| `streaming` | 소스가 현재 실행 중인지 여부 |
| `failover` | 페일오버 슬롯 모드 (`db.cdc.postgres`) |
| `temporary` | 임시 슬롯 (`db.cdc.postgres`) |
| `snapshot` | 항목 수준 스냅샷 기본값 |
| `faulted` | 소스가 `faulted` 상태인지 여부 |
| `error` | 기록된 경우 마지막 소스 오류 |
| `admission` | `active`, `snapshots`, `reserved_bytes`, `rejected` |
| `capabilities` | `snapshot`, `capture_resume`, `replayable`, `captures_external_writes`, `before_images`, `coalesced` |

`kind`가 아니라 `capabilities`로 분기하십시오:

```lua
local info = cdc.source("app:changes")
if not info.capabilities.before_images then
    -- delete 이벤트에는 행 이미지가 없으므로 마지막으로 알려진 상태를 직접 유지
end
```

필드 의미는 [CDC 소스](system/cdc.md#source-info)를 참조하십시오.

## 권한

| 작업 | 리소스 | 설명 |
|--------|----------|-------------|
| `cdc.source` | 소스 항목 ID | `cdc.source`, `cdc.list_sources`도 필터링 |
| `cdc.subscribe` | 소스 항목 ID | `cdc.stream`, 구독이 확립될 때 다시 확인 |

거부된 작업은 `errors.PERMISSION_DENIED`를 반환합니다.

## 오류

| 조건 | 종류 |
|-----------|------|
| 컨텍스트 없음 / 프로세스 PID 없음 | `errors.INTERNAL` |
| 소스 이름이 필요함 | `errors.INVALID` |
| 유효하지 않거나 알 수 없는 스트림 옵션 | `errors.INVALID` |
| `capture_resume`이 없는 소스에 `after` 사용 | `errors.INVALID` |
| 소스가 등록되지 않음 | `errors.NOT_FOUND` |
| 소스가 시작되지 않았거나 교체 중 | `errors.UNAVAILABLE` |
| 구독 용량 소진 | `errors.UNAVAILABLE` |
| 권한 거부 | `errors.PERMISSION_DENIED` |

오류를 다루는 방법은 [오류 처리](lua/core/errors.md)를 참조하십시오.

## 참고

- [변경 데이터 캡처](system/cdc.md) - 소스 구성과 기능
- [채널](lua/core/channel.md) - 채널 의미론
- [데이터베이스](system/database.md) - SQL 데이터베이스 서비스
