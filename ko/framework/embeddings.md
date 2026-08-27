---
title: "임베딩"
description: "PostgreSQL pgvector 또는 SQLite sqlite-vec로 벡터 임베딩을 생성하고 저장하며 검색합니다."
---

# 임베딩

`wippy/embeddings` 모듈은 `wippy/llm`을 통해 임베딩을 생성하고 애플리케이션 데이터베이스에 저장한 뒤 벡터 유사도 검색을 수행합니다. PostgreSQL의 pgvector와 SQLite의 sqlite-vec를 지원합니다.

이 페이지는 독립 실행형 튜토리얼이 아니라 참조 스니펫을 포함한 API 입문서입니다. 스니펫은 기존 Wippy 프로젝트, 구성된 데이터베이스, 그리고 아래에서 설명하는 임베딩 모델·제공자·자격 증명을 전제로 합니다. 원격 임베딩 호출에는 제공자 요금이 발생할 수 있습니다. 콘텐츠를 인덱싱하고 검색하는 완전한 애플리케이션은 [RAG 파이프라인 구축](../tutorials/rag.md)을 따르세요.

## 설정

프로젝트에 모듈을 추가합니다:

```bash
wippy add wippy/embeddings
wippy install
```

### 필수 모델 및 제공자

임베딩 API를 호출하기 전에 `meta.name`이 `text-embedding-3-small`이고 기능에 `embed`가 포함되며 제공자 매핑이 임베딩 제공자로 해석되는 `llm.model`을 등록하세요. `OPENAI_API_KEY` 같은 제공자 자격 증명은 `wippy/llm`이 사용하는 환경 저장소를 통해 구성합니다. [LLM 모델 구성](./llm.md#model-configuration)을 참고하세요.

### 데이터베이스 의존성

의존성을 선언하고 `target_db` 매개변수를 애플리케이션 데이터베이스로 설정합니다:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    file: ./data/app.db

  - name: dep.embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:app_db
```

시작 시 `wippy/migration`이 `01_create_embeddings_table` 마이그레이션을 찾아 구성된 데이터베이스 드라이버에 맞는 `embeddings_512` 테이블을 생성합니다.

위와 같은 상대 SQLite 경로를 사용한다면 애플리케이션을 시작하기 전에 `data` 디렉터리를 만드세요.

## 현재 고정 상수

모듈은 현재 다음 비공개 상수를 정의합니다. 이 값들은 의존성 매개변수가 아닙니다:

| 상수 | 기본값 | 설명 |
|----------|---------|-------------|
| `EMBEDDING_MODEL` | `text-embedding-3-small` | 벡터 생성에 사용하는 LLM 모델 |
| `EMBEDDING_DIMENSIONS` | `512` | 모델에 전달하는 벡터 크기 |
| `MAX_TOKENS_PER_REQUEST` | `8000` | 호출별 토큰 예산. 큰 배치는 분할됨 |
| `DEFAULT_SEARCH_LIMIT` | `10` | `search`가 반환하는 기본 결과 수 |

토큰 수는 `ceil(#text / 4)`로 추정합니다. 제한을 넘는 배치는 항목 사이에서 분할됩니다. 단일 항목이 예산보다 크면 분할되지 않으며 해당 하위 배치는 LLM 호출 전에 실패합니다.

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

`content`의 임베딩을 생성하고 저장합니다.

| 매개변수 | 타입 | 필수 | 설명 |
|-----------|------|----------|-------------|
| `content` | string | 예 | 임베딩할 텍스트 |
| `content_type` | string | 예 | `"document_chunk"` 또는 `"question"` 같은 레이블. PostgreSQL에서는 32자로 제한됨 |
| `origin_id` | string | 예 | 원본 문서나 레코드 식별자. `target_db`가 PostgreSQL이면 UUID여야 함 |
| `context_id` | string | 아니요 | 추가 범위 키(섹션, 채팅, 테넌트) |
| `meta` | table | 아니요 | 임의의 JSON 직렬화 가능 메타데이터 |

`{ entry_id, origin_id, content_type, context_id }` 또는 `nil, err`를 반환합니다.

<warning>
고정된 프레임워크 기준선에서 단일 항목 헬퍼는 `llm.embed()`의 첫 번째 벡터가 아니라 중첩된 결과를 리포지토리에 전달하므로 `embeddings.add()`가 정상적으로 저장할 수 없습니다. 프레임워크 구현이 수정될 때까지 항목 하나로 `embeddings.add_batch()`를 사용하거나, `llm.embed()`를 호출한 뒤 `response.result[1]`을 `embedding_repo.add()`에 전달하세요.
</warning>

### add_batch

다음 예시는 SQLite와 호환되는 애플리케이션 ID를 사용합니다. PostgreSQL 스키마는 `origin_id`를 `UUID`로 저장하므로 `doc-1`을 UUID로 바꾸세요.

```lua
local result, err = embeddings.add_batch({
    { content = "...", content_type = "chunk", origin_id = "doc-1" },
    { content = "...", content_type = "chunk", origin_id = "doc-1", context_id = "s1" },
})
```

여러 항목을 한 번의 호출로 임베딩하고 저장합니다. 전체 추정 토큰 수가 `MAX_TOKENS_PER_REQUEST`를 넘으면 메서드가 배치를 청크로 나눕니다. 각 리포지토리 청크는 트랜잭션이지만, 분할된 고수준 배치 전체는 원자적이지 않습니다. 뒤쪽 청크가 실패해도 앞쪽 청크는 저장된 채로 남습니다. `{ count, items = { ... } }`를 반환합니다.

테스트 중 생성한 레코드를 제거하려면 각 샘플 origin에 대해 리포지토리 API의 `delete_by_origin(origin_id)` 메서드를 사용하세요.

### search

```lua
local hits, err = embeddings.search("how do migrations work?", {
    content_type = "document_chunk",
    origin_id    = "doc-1",
    context_id   = "section-2",
    limit        = 10,
})
```

쿼리 문자열을 임베딩하고 저장된 벡터에서 유사도 검색을 수행합니다. 모든 필터는 선택 사항이며 일치하는 레코드는 유사도순으로 정렬됩니다.

`origin_id`는 문자열 또는 비어 있지 않은 문자열 배열일 수 있습니다. 각 결과에는 `entry_id`, `origin_id`, `content_type`, `context_id`, `content`, 디코딩된 `meta`, 타임스탬프, `similarity`가 포함됩니다.

### find_by_type

```lua
local hits, err = embeddings.find_by_type(
    "how do migrations work?",
    "document_chunk",
    { limit = 10 }
)
```

단일 `content_type`으로 `search`를 호출합니다. 기본 제한은 `10`입니다.

### find_by_origin

```lua
local hits, err = embeddings.find_by_origin("how do migrations work?", "doc-1", {
    content_type = "document_chunk",
    context_id   = "section-2",
    limit        = 5,
})
```

단일 `origin_id`와 선택적인 `content_type`, `context_id` 필터로 `search`를 호출합니다. 기본 제한은 `5`입니다.

## 리포지토리 API (`wippy.embeddings:embedding_repo`)

이미 벡터가 있어 임베딩 생성을 건너뛰려면 리포지토리를 직접 사용합니다. 원시 임베딩에는 정확히 512개의 숫자 값이 있어야 합니다:

| 함수 | 설명 |
|----------|-------------|
| `embedding_repo.add(content, content_type, origin_id, context_id, meta, embedding)` | 사전 계산한 벡터 삽입 |
| `embedding_repo.add_batch(batch)` | 여러 사전 계산 벡터를 하나의 트랜잭션으로 삽입 |
| `embedding_repo.get_by_origin(origin_id)` | 지정한 origin의 모든 레코드 나열 |
| `embedding_repo.delete_by_origin(origin_id)` | 지정한 origin의 모든 레코드 제거 |
| `embedding_repo.delete_by_entry(entry_id)` | 행 ID로 단일 레코드 제거 |
| `embedding_repo.search_by_embedding(vector, options)` | 원시 벡터에 대한 유사도 검색 |

`search_by_embedding`은 `{ content_type, origin_id, context_id, limit }`을 받습니다.

## 데이터베이스 지원

마이그레이션은 `target_db`의 데이터베이스 드라이버에 맞는 스키마를 생성합니다:

- **PostgreSQL** — `vector(512)` 열과 IVFFlat 코사인 인덱스를 갖춘 `embeddings_512` 테이블. 마이그레이션은 `vector` 확장 설치를 시도하므로 데이터베이스 역할에 생성 권한이 있거나 확장이 이미 설치되어 있어야 합니다. PostgreSQL은 `origin_id`를 `UUID`로 저장합니다.
- **SQLite** — KNN 검색을 위해 메타데이터 및 콘텐츠 열과 함께 `embedding float[512]` 벡터 열을 보관하는 `embeddings_512` `vec0` 가상 테이블.

## 참고 항목

- [LLM](./llm.md) — 원시 임베딩 생성을 위한 `llm.embed(...)`
- [마이그레이션](./migration.md) — 테이블을 프로비저닝하는 마이그레이션 러너
- [프레임워크 개요](./overview.md) — 프레임워크 모듈 사용법
