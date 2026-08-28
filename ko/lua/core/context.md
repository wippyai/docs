---
title: "요청 컨텍스트"
description: "함수 및 프로세스 호출을 통해 전파되는 request-scoped value를 읽습니다."
---

# 요청 컨텍스트
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

`ctx` 모듈은 [함수 호출](lua/core/funcs.md) 또는 [프로세스 작업](lua/core/process.md)을 통해 전파된 request-scoped value를 읽습니다. 이 페이지는 API 레퍼런스이며 snippet은 실행 가능한 Lua 엔트리 안의 개별 호출을 보여 줍니다.

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

실행 context가 있지만 request value가 없으면 `ctx.all()`은 빈 table을 반환합니다. 실행 context가 없으면 `nil, errors.INTERNAL`을 반환합니다.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-----------|
| 빈 키 | `errors.INVALID` | 아니오 |
| 키를 찾을 수 없음 | `errors.NOT_FOUND` | 아니오 |
| 사용 가능한 실행 context 없음 | `errors.INTERNAL` | 아니오 |

error 처리는 [에러 처리](lua/core/errors.md)를 참조하십시오.
