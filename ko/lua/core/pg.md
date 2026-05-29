# 프로세스 그룹
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

프로세스를 명명된 그룹에 참여시키고 클러스터 전체의 모든 멤버에게 브로드캐스트합니다. Erlang/OTP `pg`를 모델로 합니다: 그룹은 동적이고, 프로세스는 여러 그룹에 속할 수 있으며, 멤버십은 클러스터 전체에서 추적되며 결과적으로 일관성이 있습니다.

범위 엔트리 종류와 설정은 [프로세스 그룹](system/process-groups.md)을 참조하세요. 더 넓은 클러스터링 모델은 [클러스터 가이드](guides/cluster.md)를 참조하세요.

## 로딩

```lua
local pg = require("pg")
```

## 범위 열기

프로세스 그룹은 **범위** — `pg.scope` 레지스트리 엔트리 — 안에 존재합니다. 범위를 열어 작업할 인스턴스를 가져옵니다:

```lua
local group, err = pg.open("app:pg")
if err then
    return nil, err
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 범위 엔트리 ID (형식: `"namespace:name"`) |

**반환:** `pg.Instance, error`

**권한:** 범위 `id`에 대한 `pg.open`

프로세스가 종료되면 인스턴스가 자동으로 해제됩니다; 더 일찍 해제하려면 `release()`를 호출하세요. 다른 모든 작업은 인스턴스의 메서드이며, `:`로 호출됩니다.

## 참여 및 탈퇴

```lua
local ok, err = group:join("workers")           -- 단일 그룹
local ok, err = group:join({"workers", "all"})  -- 배치
local ok, err = group:leave("workers")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `group` | string \| string[] | 그룹 이름, 또는 배치 작업을 위한 이름 목록 |

**반환:** `boolean, error`

프로세스는 동일한 그룹에 여러 번 참여할 수 있으며, 완전히 탈퇴하려면 같은 횟수만큼 탈퇴해야 합니다(다중 참여 시맨틱). `leave`는 배치에서 최선 노력 방식이며, 프로세스가 명명된 그룹 중 어느 것의 멤버도 아닌 경우에만 오류를 반환합니다.

**권한:** 각 그룹 이름에 대한 `pg.join` / `pg.leave`

## 멤버 목록 조회

```lua
local members, err = group:get_members("workers")        -- 모든 노드
local local_members, err = group:get_local_members("workers")  -- 이 노드만
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `group` | string | 그룹 이름 |

**반환:** `string[], error` — PID 문자열 배열 (알 수 없는 그룹의 경우 빈 배열)

**권한:** 그룹 이름에 대한 `pg.get_members` / `pg.get_local_members`

## 그룹 목록 조회

```lua
local groups, err = group:which_groups()         -- 클러스터의 모든 그룹
local local_groups, err = group:which_local_groups()  -- 로컬 멤버가 있는 그룹
```

**반환:** `string[], error` — 현재 멤버가 하나 이상 있는 그룹 이름

**권한:** `pg.which_groups` / `pg.which_local_groups`

## 브로드캐스트

그룹의 모든 멤버에게 메시지를 전송합니다. 각 멤버는 호출 프로세스로부터 `topic` 아래에서 수신합니다 — `process.listen(topic)`으로 처리하세요.

```lua
local ok, err = group:broadcast("workers", "task", {id = 42})   -- 모든 노드
local ok, err = group:broadcast_local("workers", "task", {id = 42})  -- 이 노드만
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `group` | string | 대상 그룹 |
| `topic` | string | 메시지 토픽 |
| `...` | any | 0개 이상의 페이로드 값 |

**반환:** `boolean, error`

**권한:** 그룹 이름에 대한 `pg.broadcast` / `pg.broadcast_local`

## 그룹 모니터링

`monitor`는 하나의 그룹에 대한 참여/탈퇴 이벤트를 구독하고 현재 멤버를 원자적으로 반환합니다 — 스냅샷과 구독 사이에서 멤버십 변경이 누락될 수 없습니다.

```lua
local sub, members, err = group:monitor("workers")
if err then
    return nil, err
end

for _, pid in ipairs(members) do
    -- 구독 시점의 현재 멤버
end

local ch = sub:channel()
local event = ch:receive()  -- {kind = "member.joined" | "member.left", path = "workers", data = {...}}

sub:close()  -- 구독 해제; sub:close({flush = true})는 먼저 대기 중인 이벤트를 소진
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `group` | string | 감시할 그룹 |

**반환:** `pg.Subscription, string[], error` — 구독과 현재 멤버의 스냅샷

**권한:** 그룹 이름에 대한 `pg.monitor`

## 모든 그룹 감시

`events`는 범위의 모든 그룹에 걸쳐 멤버십 변경을 구독하고 모든 그룹의 멤버에 대한 스냅샷을 반환합니다.

```lua
local sub, snapshot, err = group:events()
-- snapshot: { ["workers"] = {pid, ...}, ["all"] = {pid, ...} }

local event = sub:channel():receive()
sub:close()
```

**반환:** `pg.Subscription, table, error`

**권한:** `pg.events`

### 이벤트 필드

구독 채널에서 전달되는 이벤트는 다음을 포함합니다:

| 필드 | 타입 | 설명 |
|-------|------|------|
| `system` | string | 항상 `"pg"` |
| `kind` | string | `"member.joined"` 또는 `"member.left"` |
| `path` | string | 그룹 이름 |
| `data` | table | `{Group = string, PIDs = string[]}` — 영향받는 멤버 |

구독 채널은 버퍼링됩니다(용량 64); 느린 소비자가 버퍼를 가득 채우면 해당 구독에 대한 추가 이벤트는 삭제됩니다.

## 해제

```lua
group:release()
```

인스턴스를 즉시 해제합니다. 멱등합니다; 해제 후 모든 메서드는 오류를 반환합니다. 프로세스 종료 시 정리도 자동으로 실행됩니다.

**반환:** `boolean`

## 권한

| 권한 | 메서드 | 리소스 |
|------------|--------|----------|
| `pg.open` | `pg.open()` | 범위 id |
| `pg.join` | `join()` | 그룹 이름 |
| `pg.leave` | `leave()` | 그룹 이름 |
| `pg.get_members` | `get_members()` | 그룹 이름 |
| `pg.get_local_members` | `get_local_members()` | 그룹 이름 |
| `pg.which_groups` | `which_groups()` | (범위) |
| `pg.which_local_groups` | `which_local_groups()` | (범위) |
| `pg.broadcast` | `broadcast()` | 그룹 이름 |
| `pg.broadcast_local` | `broadcast_local()` | 그룹 이름 |
| `pg.monitor` | `monitor()` | 그룹 이름 |
| `pg.events` | `events()` | (범위) |

## 에러

| 조건 | 종류 |
|-----------|------|
| 권한 거부됨 | `errors.PERMISSION_DENIED` |
| 인수 누락 또는 빈 인수 | `errors.INVALID` |
| 범위 찾을 수 없음 | `errors.NOT_FOUND` |
| 멤버십 없는 그룹 탈퇴 | `errors.INVALID` |
| 인스턴스 해제됨 | `errors.INVALID` |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.

## 참고

- [프로세스 그룹](system/process-groups.md) - 범위 엔트리 종류와 설정
- [클러스터](guides/cluster.md) - 멤버십과 클러스터링 모델
- [프로세스 관리](lua/core/process.md) - 개별 프로세스 스폰 및 메시징
