---
title: "임베딩"
---

# 임베딩

`wippy/embeddings` 모듈은 PostgreSQL(pgvector)과 SQLite(sqlite-vec) 모두를 위한 벡터 임베딩 저장 및 유사도 검색을 제공합니다. `wippy/llm`을 래핑하여 임베딩을 생성하고 애플리케이션 데이터베이스에 저장합니다.

## 설정

프로젝트에 모듈을 추가합니다:

```bash
wippy add wippy/embeddings
wippy install
```

의존성을 선언하고 `target_db` 요구사항을 애플리케이션 데이터베이스에 연결합니다:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    path: ./data/app.db

  - name: dep.embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"

  - name: target_db
    kind: registry.entry
    meta:
      wippy.embeddings.target_db: app:app_db
```

시작 시 `wippy/migration`이 `01_create_embeddings_table` 마이그레이션을 수행하여 데이터베이스 드라이버에 적합한 벡터 인덱스를 갖춘 `embeddings` 테이블을 생성합니다.

## 구성 상수

기본 구성은 모듈에 내장되어 있습니다:

| 상수 | 기본값 | 설명 |
|----------|---------|-------------|
| `EMBEDDING_MODEL` | `text-embedding-3-small` | 벡터 생성에 사용되는 LLM 모델 |
| `EMBEDDING_DIMENSIONS` | `512` | 모델에 전달되는 벡터 크기 |
| `MAX_TOKENS_PER_REQUEST` | `8000` | 호출당 토큰 예산; 큰 배치는 분할됨 |
| `DEFAULT_SEARCH_LIMIT` | `10` | `search`가 반환하는 기본 히트 수 |

토큰은 `#text / 4`로 추정됩니다. 예산을 초과하는 배치는 자동으로 분할됩니다.

## 임포트

```yaml
entries:
  - name: my_app
    kind: library.lua
    source: file://my_app.lua
    imports:
      embeddings: wippy.embeddings:embeddings
```

```lua
local embeddings = require("embeddings")
```

## 고수준 API (`wippy.embeddings:embeddings`)

### add

```lua
local result, err = embeddings.add(content, content_type, origin_id, context_id, meta)
```

`content`에 대한 임베딩을 생성하고 저장합니다.

| 파라미터 | 타입 | 필수 | 설명 |
|-----------|------|----------|-------------|
| `content` | string | 예 | 임베딩할 텍스트 |
| `content_type` | string | 예 | 자유 형식 레이블, 예: `"document_chunk"`, `"question"` |
| `origin_id` | string | 예 | 소스 문서 또는 레코드 식별자 |
| `context_id` | string | 아니오 | 추가 범위 지정 키 (섹션, 채팅, 테넌트) |
| `meta` | table | 아니오 | 임의의 JSON 직렬화 가능한 메타데이터 |

`{ id, content, content_type, origin_id, context_id, meta }` 또는 `nil, err`를 반환합니다.

### add_batch

```lua
local result, err = embeddings.add_batch({
    { content = "...", content_type = "chunk", origin_id = "doc-1" },
    { content = "...", content_type = "chunk", origin_id = "doc-1", context_id = "s1" },
})
```

한 번의 호출로 여러 항목을 임베딩하고 저장합니다. 총 추정 토큰 수가 `MAX_TOKENS_PER_REQUEST`를 초과하면 배치가 분할되어 청크로 처리됩니다. `{ count, items = { ... } }`를 반환합니다.

### search

```lua
local hits, err = embeddings.search("how do migrations work?", {
    content_type = "document_chunk",
    origin_id    = "doc-1",
    context_id   = "section-2",
    limit        = 10,
})
```

쿼리 문자열을 임베딩하고 저장된 벡터에 대해 유사도 검색을 수행합니다. 모든 필터는 선택사항이며, 일치하는 레코드는 유사도 순으로 정렬됩니다.

### find_by_type

```lua
local hits, err = embeddings.find_by_type(query, content_type, { limit = 10 })
```

단일 `content_type`으로 범위가 지정된 `search`의 편의 래퍼입니다.

### find_by_origin

```lua
local hits, err = embeddings.find_by_origin(query, origin_id, {
    content_type = "document_chunk",
    context_id   = "section-2",
    limit        = 5,
})
```

단일 `origin_id`로 범위가 지정되고 선택적으로 추가로 좁혀지는 편의 래퍼입니다.

## 리포지토리 API (`wippy.embeddings:embedding_repo`)

이미 벡터를 가지고 있고 임베딩 생성을 건너뛰고 싶을 때 리포지토리를 직접 사용합니다:

| 함수 | 설명 |
|----------|-------------|
| `embedding_repo.add(content, content_type, origin_id, context_id, meta, embedding)` | 사전 계산된 벡터 삽입 |
| `embedding_repo.add_batch(batch)` | 한 번의 구문으로 여러 사전 계산된 벡터 삽입 |
| `embedding_repo.get_by_origin(origin_id)` | 주어진 origin의 모든 레코드 나열 |
| `embedding_repo.delete_by_origin(origin_id)` | 주어진 origin의 모든 레코드 제거 |
| `embedding_repo.delete_by_entry(entry_id)` | 행 id로 단일 레코드 제거 |
| `embedding_repo.search_by_embedding(vector, options)` | 원시 벡터에 대한 유사도 검색 |

`search_by_embedding`은 `{ content_type, origin_id, context_id, limit }`을 받습니다.

## 데이터베이스 지원

마이그레이션은 `target_db`의 데이터베이스 드라이버에 적합한 스키마를 생성합니다:

- **PostgreSQL** - `vector(512)` 컬럼과 IVFFlat 인덱스가 있는 `embeddings` 테이블. `pgvector` 확장이 필요합니다.
- **SQLite** - 텍스트로 저장된 벡터와 KNN 검색을 위한 동반 `sqlite-vec` 가상 테이블이 있는 `embeddings` 테이블.

벡터는 API 레이어에서 항상 일반 JSON 배열을 통해 왕복됩니다.

## 참고 항목

- [LLM](framework/llm.md) - 원시 임베딩 생성을 위한 `llm.embed(...)`
- [마이그레이션](framework/migration.md) - 테이블을 프로비저닝하는 마이그레이션 러너
- [프레임워크 개요](framework/overview.md) - 프레임워크 모듈 사용법
