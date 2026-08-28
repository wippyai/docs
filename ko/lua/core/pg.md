---
title: "프로세스 그룹"
description: "클러스터 전체 프로세스 그룹, 멤버십, 브로드캐스트, 멤버십 구독을 관리합니다."
---

# 프로세스 그룹
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

프로세스 그룹은 동적 이름 아래에 프로세스를 구성하고 클러스터 전체의 그룹 멤버에게 메시지를 브로드캐스트합니다. 프로세스는 여러 그룹에 참여할 수 있으며 클러스터 전체 멤버십은 최종적으로 일관됩니다.

이 페이지는 API 참조입니다. 스니펫은 기존 `pg.scope`, 프로세스 컨텍스트로 실행되는 실행 가능 엔트리, 문서화된 작업을 허용하는 정책을 전제로 합니다. 블록은 독립 애플리케이션이 아니라 개별 호출 또는 부분 구독 흐름을 보여 줍니다.

scope 엔트리 종류와 구성은 [프로세스 그룹](system/process-groups.md)을 참고하세요. 더 넓은 클러스터링 모델은 [클러스터 가이드](guides/cluster.md)를 참고하세요.

## 로드

```lua
local pg = require("pg")
```

모듈을 요구하기 전에 실행 가능 엔트리의 `modules:` 목록에 `pg`를 추가하세요.

## Scope 열기

프로세스 그룹은 `pg.scope` 레지스트리 엔트리로 표현되는 **scope**에 속합니다. scope를 열어 그룹 작업용 인스턴스를 얻습니다:

```lua
local group, err = pg.open("app:pg")
if err then
    return nil, err
end
```

| 매개변수 | 타입 | 설명 |
|-----------|------|-------------|
| `id` | string | Scope 엔트리 ID(형식: `"namespace:name"`) |

**반환:** `pg.Instance, error`

**권한:** scope `id`에 대한 `pg.open`

인스턴스는 실행 프레임 정리 중 자동으로 해제됩니다. 더 일찍 해제하려면 `release()`를 호출하세요. 다른 작업은 인스턴스 메서드이며 `:` 구문을 사용합니다.

## 참여 및 탈퇴

아래 호출은 독립 형식입니다. 애플리케이션에 필요한 단일 또는 배치 참여를 선택하고 해당 탈퇴 작업과 짝지으세요.

```lua
local ok, err = group:join("workers")           -- single group
if err then return nil, err end
```

```lua
local ok, err = group:join({"workers", "all"})  -- batch
if err then return nil, err end
```

```lua
local ok, err = group:leave("workers")
if err then return nil, err end
```

| 매개변수 | 타입 | 설명 |
|-----------|------|-------------|
| `group` | string \| string[] | 그룹 이름 또는 배치 작업용 이름 목록 |

**반환:** `boolean, error`

프로세스는 같은 그룹에 여러 번 참여할 수 있으며 완전히 떠나려면 같은 횟수만큼 탈퇴해야 합니다. 배치에서 `leave`는 최선 노력 방식이며 프로세스가 지정한 그룹 중 어느 곳에도 속하지 않을 때만 오류를 반환합니다.

**권한:** 각 그룹 이름에 대한 `pg.join` / `pg.leave`

## 멤버 나열

```lua
local members, err = group:get_members("workers")        -- all nodes
if err then return nil, err end

local local_members, err = group:get_local_members("workers")  -- this node only
if err then return nil, err end
```

| 매개변수 | 타입 | 설명 |
|-----------|------|-------------|
| `group` | string | 그룹 이름 |

**반환:** `string[], error` — PID 문자열 배열(알 수 없는 그룹은 빈 배열)

**권한:** 그룹 이름에 대한 `pg.get_members` / `pg.get_local_members`

## 그룹 나열

```lua
local groups, err = group:which_groups()         -- all groups in the cluster
if err then return nil, err end

local local_groups, err = group:which_local_groups()  -- groups with a local member
if err then return nil, err end
```

**반환:** `string[], error` — 현재 멤버가 하나 이상 있는 그룹 이름

**권한:** `pg.which_groups` / `pg.which_local_groups`

## 브로드캐스트

브로드캐스트는 호출 프로세스에서 모든 그룹 멤버에게 `topic` 아래 메시지를 전송합니다. 멤버는 `process.listen(topic)`으로 수신합니다.

```lua
local ok, err = group:broadcast("workers", "task", {id = 42})   -- all nodes
if err then return nil, err end

ok, err = group:broadcast_local("workers", "task", {id = 42})  -- this node only
if err then return nil, err end
```

| 매개변수 | 타입 | 설명 |
|-----------|------|-------------|
| `group` | string | 대상 그룹 |
| `topic` | string | 메시지 토픽 |
| `...` | any | 0개 이상의 페이로드 값 |

**반환:** `boolean, error`

**권한:** 그룹 이름에 대한 `pg.broadcast` / `pg.broadcast_local`

## 그룹 모니터링

`monitor`는 그룹 하나의 참여 및 탈퇴 이벤트를 구독하고 현재 멤버의 원자적 스냅샷을 반환합니다. 스냅샷과 구독 설정 사이에서 발생한 멤버십 변경도 빠짐없이 관찰됩니다.

```lua
local sub, members, err = group:monitor("workers")
if err then
    return nil, err
end

for _, pid in ipairs(members) do
    -- current members at subscription time
end

local ch = sub:channel()
local event, open = ch:receive()  -- {kind = "member.joined" | "member.left", path = "workers", data = {...}}
if not open then
    return nil, errors.new("Process-group subscription closed")
end

sub:close()  -- unsubscribe; sub:close({flush = true}) drains queued events first
```

| 매개변수 | 타입 | 설명 |
|-----------|------|-------------|
| `group` | string | 감시할 그룹 |

**반환:** `pg.Subscription, string[], error` — 구독과 현재 멤버의 스냅샷

**권한:** 그룹 이름에 대한 `pg.monitor`

## 모든 그룹 감시

`events`는 scope의 모든 그룹에서 멤버십 변경을 구독하고 그룹을 멤버에 매핑한 스냅샷을 반환합니다.

```lua
local sub, snapshot, err = group:events()
if err then
    return nil, err
end
-- snapshot: { ["workers"] = {pid, ...}, ["all"] = {pid, ...} }

local event, open = sub:channel():receive()
if not open then
    return nil, errors.new("Process-group subscription closed")
end
sub:close()
```

**반환:** `pg.Subscription, table, error`

**권한:** `pg.events`

### 이벤트 필드

구독 채널로 전달되는 이벤트에는 다음 값이 있습니다:

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `system` | string | 항상 `"pg"` |
| `kind` | string | `"member.joined"` 또는 `"member.left"` |
| `path` | string | 그룹 이름 |
| `data` | table | `{Group = string, PIDs = string[]}` — 영향을 받은 멤버 |

구독 채널은 버퍼링되며 용량은 64입니다. 느린 소비자가 버퍼를 채우면 추가 이벤트는 순서대로 프로세스 메일박스에 유지되고 소비자가 채널을 비우면 전달됩니다. 즉, 구독은 이벤트를 버리지 않고 멈춥니다.

## 해제

```lua
group:release()
```

`release`는 인스턴스를 즉시 해제하며 멱등입니다. 해제 후 다른 모든 그룹 작업은 오류를 반환합니다. 실행 프레임이 끝날 때도 자동으로 정리됩니다.

**반환:** `boolean`

## 권한

| 권한 | 메서드 | 리소스 |
|------------|--------|----------|
| `pg.open` | `pg.open()` | scope ID |
| `pg.join` | `join()` | 그룹 이름 |
| `pg.leave` | `leave()` | 그룹 이름 |
| `pg.get_members` | `get_members()` | 그룹 이름 |
| `pg.get_local_members` | `get_local_members()` | 그룹 이름 |
| `pg.which_groups` | `which_groups()` | - |
| `pg.which_local_groups` | `which_local_groups()` | - |
| `pg.broadcast` | `broadcast()` | 그룹 이름 |
| `pg.broadcast_local` | `broadcast_local()` | 그룹 이름 |
| `pg.monitor` | `monitor()` | 그룹 이름 |
| `pg.events` | `events()` | - |

## 오류

| 조건 | 종류 |
|-----------|------|
| 권한 거부 | `errors.PERMISSION_DENIED` |
| 누락되거나 빈 인수 | `errors.INVALID` |
| Scope를 찾을 수 없음 | `errors.INTERNAL` |
| 멤버십이 없는 그룹 탈퇴 | `errors.NOT_FOUND` |
| 인스턴스 해제됨 | `errors.INVALID` |
| 그룹/멤버 또는 작업 큐 제한 도달 | `errors.RATE_LIMITED` (재시도 가능) |
| 서비스 중지, 백프레셔 또는 회로 열림 | `errors.UNAVAILABLE` |
| 브로드캐스트 시간 초과 | `errors.TIMEOUT` (재시도 가능) |

오류 작업 방법은 [오류 처리](lua/core/errors.md)를 참고하세요.

## 참고 항목

- [프로세스 그룹](system/process-groups.md) - Scope 엔트리 종류와 구성
- [클러스터](guides/cluster.md) - 멤버십, 명명, 클러스터링 모델
- [프로세스 관리](lua/core/process.md) - 개별 프로세스 생성 및 메시징
