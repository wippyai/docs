---
title: "사용량 추적"
description: "wippy/usage 모듈은 LLM 토큰 소비를 기록하고 시간 간격, 모델 또는 사용자별로 그룹화된 집계 쿼리를 제공합니다. 이 모듈은 wippy.llm:usagetracker 컨트랙트에 바인딩되므로, LLM 모듈을 통해 호출하는 모든 코드가 자동으로 사용량 레코드를…"
---

# 사용량 추적

`wippy/usage` 모듈은 LLM 토큰 소비를 기록하고 시간 간격, 모델 또는 사용자별로 그룹화된 집계 쿼리를 제공합니다. 이 모듈은 `wippy.llm:usage_tracker` 컨트랙트에 바인딩되므로, LLM 모듈을 통해 호출하는 모든 코드가 자동으로 사용량 레코드를 생성합니다.

## 설정

프로젝트에 모듈을 추가합니다:

```bash
wippy add wippy/usage
wippy install
```

의존성을 선언하고 `target_db` 요구사항을 사용량 레코드가 저장될 데이터베이스에 연결합니다:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    path: ./data/app.db

  - name: dep.usage
    kind: ns.dependency
    component: wippy/usage
    version: "*"

  - name: target_db
    kind: registry.entry
    meta:
      wippy.usage.target_db: app:app_db
```

애플리케이션이 시작되면 `wippy/migration`이 모듈의 `01_create_token_usage_table` 마이그레이션을 실행하여 `user_id`, `context_id`, `model_id`, `timestamp`에 대한 인덱스와 함께 `token_usage` 테이블을 생성합니다.

## 스키마

```
token_usage
├── usage_id           text primary key (uuid v7)
├── user_id            text not null
├── context_id         text
├── model_id           text not null
├── prompt_tokens      integer
├── completion_tokens  integer
├── thinking_tokens    integer default 0
├── cache_read_tokens  integer default 0
├── cache_write_tokens integer default 0
├── timestamp          timestamp
└── meta               text (JSON)
```

## 자동 추적

`wippy/llm`은 각 생성 전에 `wippy.llm:usage_tracker` 컨트랙트를 해석합니다. `wippy/usage`는 자신의 구현을 기본값으로 바인딩합니다:

```yaml
contracts:
  - contract: wippy.llm:usage_tracker
    default: true
    methods:
      track_usage: wippy.usage:usage_tracker
```

성공적인 모든 LLM 호출은 모델 id, 토큰 수, 선택적 `context_id`와 함께 `track_usage`를 호출합니다. `user_id`는 활성 보안 액터에서 가져옵니다; 사용자 컨텍스트 외부의 호출은 `"system"`으로 기록됩니다.

## 트래커 API

LLM 흐름 외부에서 사용량을 기록해야 할 때 트래커를 직접 임포트합니다:

```yaml
imports:
  usage_tracker: wippy.usage:usage_tracker
```

```lua
local tracker = require("usage_tracker")

local usage_id, err = tracker.track_usage(
    "openai:gpt-4o",
    prompt_tokens,
    completion_tokens,
    thinking_tokens,
    cache_read_tokens,
    cache_write_tokens,
    { context_id = "chat-42", metadata = { feature = "summary" } }
)
```

| 파라미터 | 타입 | 설명 |
|-----------|------|-------------|
| `model_id` | string | 정규 모델 id |
| `prompt_tokens` | number | 입력 토큰 |
| `completion_tokens` | number | 출력 토큰 |
| `thinking_tokens` | number | 추론 토큰 (보고되지 않은 경우 0) |
| `cache_read_tokens` | number | 프롬프트 캐시 히트 |
| `cache_write_tokens` | number | 프롬프트 캐시 쓰기 |
| `options.context_id` | string | 자유 형식 태그; `ctx.get("context_id")`로 폴백됨 |
| `options.timestamp` | number | Unix 타임스탬프; 기본값은 지금 (UTC) |
| `options.metadata` | table | 레코드와 함께 저장되는 임의의 JSON 메타데이터 |

`usage_id` 또는 `nil, err`를 반환합니다.

## 리포지토리 API

`wippy.usage:token_usage_repo`는 집계 쿼리를 제공합니다:

```yaml
imports:
  usage: wippy.usage:token_usage_repo
```

```lua
local usage = require("usage")

local summary  = usage.get_summary(start_unix, end_unix)
local by_time  = usage.get_usage_by_time(start_unix, end_unix, usage.INTERVAL.DAY)
local by_model = usage.get_usage_by_model(start_unix, end_unix)
local by_user  = usage.get_usage_by_user(start_unix, end_unix)
```

### 함수

| 함수 | 반환 |
|----------|---------|
| `get_summary(start, end)` | 범위 전체의 합계: prompt/completion/thinking/cache 토큰, 요청 수, `total_tokens` (prompt + completion + thinking) |
| `get_usage_by_time(start, end, interval)` | 간격당 하나씩 버킷 배열; 누락된 버킷은 0을 반환 |
| `get_usage_by_model(start, end)` | 모델별 합계, `total_tokens` 내림차순 정렬 |
| `get_usage_by_user(start, end)` | 사용자별 합계, `total_tokens` 내림차순 정렬 |
| `create(user_id, model_id, prompt, completion, options)` | 트래커가 사용하는 저수준 삽입 |

### 간격

```lua
usage.INTERVAL.HOUR   -- "hour"
usage.INTERVAL.DAY    -- "day"
usage.INTERVAL.WEEK   -- "week"
usage.INTERVAL.MONTH  -- "month"
```

`get_usage_by_time`은 구성된 간격에 버킷을 정렬합니다. PostgreSQL에서는 간격 산술과 함께 `generate_series`를 사용합니다; SQLite에서는 UNIX 타임스탬프에 대한 재귀적 CTE를 사용합니다. 각 버킷의 `total_tokens`는 캐시 토큰을 제외합니다.

### 시간 범위

트래커와 리포지토리 모두 공개 API 경계에서 UNIX 타임스탬프를 받습니다. 내부적으로 리포지토리는 저장 및 쿼리를 위해 RFC3339 문자열로 변환합니다. 포맷된 문자열이 아닌 `os.time()` 또는 `time.now():unix()` 값을 전달하세요.

## 메타데이터 및 컨텍스트

`meta` 컬럼은 자유 형식 JSON 블롭을 저장합니다. 이를 사용하여 레코드를 애플리케이션 이벤트와 연관시킵니다:

```lua
tracker.track_usage(model_id, prompt, completion, 0, 0, 0, {
    context_id = "chat-42",
    metadata   = {
        session_id = "s-7",
        route      = "/api/summarise",
        agent_id   = "writer",
    },
})
```

`context_id`는 최상위 컬럼이며 인덱싱될 수 있습니다; `metadata`는 텍스트로 저장되며 필터링이 아닌 표시용으로 사용됩니다.

## 참고 항목

- [LLM](framework/llm.md) - LLM 생성 및 `usage_tracker` 컨트랙트
- [마이그레이션](framework/migration.md) - 스키마를 생성하는 마이그레이션 러너
- [프레임워크 개요](framework/overview.md) - 프레임워크 모듈 사용법
