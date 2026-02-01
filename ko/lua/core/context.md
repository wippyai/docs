# 요청 컨텍스트
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

요청 범위 컨텍스트 값에 접근합니다. 컨텍스트는 [Funcs](lua-funcs.md) 또는 [Process](lua-process.md)를 통해 설정됩니다.

## 로딩

```lua
local ctx = require("ctx")
```

## 컨텍스트 접근

### 값 가져오기

```lua
local value, err = ctx.get("key")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 컨텍스트 키 |

**반환:** `any, error`

### 모든 값 가져오기

```lua
local values, err = ctx.all()
```

**반환:** `table, error`

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-----------|
| 빈 키 | `errors.INVALID` | 아니오 |
| 키를 찾을 수 없음 | `errors.NOT_FOUND` | 아니오 |
| 컨텍스트 없음 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
