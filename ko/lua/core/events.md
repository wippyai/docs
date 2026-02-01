# 이벤트 버스
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

이벤트 기반 아키텍처를 위해 애플리케이션 전체에서 이벤트를 발행하고 구독합니다.

## 로딩

```lua
local events = require("events")
```

## 이벤트 구독

이벤트 버스에서 이벤트를 구독합니다:

```lua
-- 모든 주문 이벤트 구독
local sub, err = events.subscribe("orders.*")
if err then
    return nil, err
end

-- 특정 이벤트 종류 구독
local sub = events.subscribe("users", "user.created")

-- 시스템의 모든 이벤트 구독
local sub = events.subscribe("payments")

-- 이벤트 처리
local ch = sub:channel()
while true do
    local evt, ok = ch:receive()
    if not ok then break end

    logger:info("Received event", {
        system = evt.system,
        kind = evt.kind,
        path = evt.path
    })
    handle_event(evt)
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `system` | string | 시스템 패턴 ("test.*"와 같은 와일드카드 지원) |
| `kind` | string | 이벤트 종류 필터 (선택적) |

**반환:** `Subscription, error`

## 이벤트 전송

이벤트 버스에 이벤트를 전송합니다:

```lua
-- 주문 생성 이벤트 전송
local ok, err = events.send("orders", "order.created", "/orders/123", {
    order_id = "123",
    customer_id = "456",
    total = 99.99
})
if err then
    return nil, err
end

-- 사용자 이벤트 전송
events.send("users", "user.registered", "/users/" .. user.id, {
    user_id = user.id,
    email = user.email,
    created_at = time.now():format("2006-01-02T15:04:05Z07:00")
})

-- 결제 이벤트 전송
events.send("payments", "payment.completed", "/payments/" .. payment.id, {
    payment_id = payment.id,
    order_id = payment.order_id,
    amount = payment.amount,
    method = payment.method
})

-- 데이터 없이 전송
events.send("system", "heartbeat", "/health")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `system` | string | 시스템 식별자 |
| `kind` | string | 이벤트 종류/타입 |
| `path` | string | 라우팅을 위한 이벤트 경로 |
| `data` | any | 이벤트 페이로드 (선택적) |

**반환:** `boolean, error`

## 구독 메서드

### 채널 가져오기

이벤트를 받기 위한 채널 가져오기:

```lua
local ch = sub:channel()

local evt, ok = ch:receive()
if ok then
    print("System:", evt.system)
    print("Kind:", evt.kind)
    print("Path:", evt.path)
    print("Data:", json.encode(evt.data))
end
```

이벤트 필드: `system`, `kind`, `path`, `data`

### 구독 닫기

구독 해제하고 채널을 닫습니다:

```lua
sub:close()
```

## 권한

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `events.subscribe` | system | 시스템에서 이벤트 구독 |
| `events.send` | system | 시스템에 이벤트 전송 |

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-----------|
| 빈 system | `errors.INVALID` | 아니오 |
| 빈 kind | `errors.INVALID` | 아니오 |
| 빈 path | `errors.INVALID` | 아니오 |
| 정책 거부됨 | `errors.INVALID` | 아니오 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
