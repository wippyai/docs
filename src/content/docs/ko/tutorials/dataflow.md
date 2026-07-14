---
title: "Dataflow: 로컬 지식 베이스"
---

# Dataflow: 로컬 지식 베이스

자신의 머신에서 지식 베이스를 구축합니다 — 벡터 스토어를 생성한 다음 문서를 청크로 분할하여 수집합니다. 이것은 [RAG 튜토리얼](tutorials/rag.md)의 데이터 생성 동반자입니다: 여기서는 로컬 KB를 세우고 채우며; 거기서는 그것에서 검색하고 답변을 생성합니다. 둘 다 로컬 SQLite 벡터 스토어로 뒷받침되는 `wippy/embeddings` 모듈을 사용합니다.

## 무엇을 구축할 것인가

1. 데이터베이스가 512차원 벡터 스토어를 보유하는 로컬 앱.
2. 시작 시 `embeddings_512` 테이블을 생성하는 마이그레이션.
3. 마크다운을 청크로 분할하고 임베딩을 스토어에 쓰는 수집 함수.

## 전제 조건

- Wippy 프로젝트 ([app-template](https://github.com/wippyai/app-template) 클론, 또는 `wippy init`).
- 임베딩 모델 (예: `text-embedding-3-small`) 로 구성된 LLM 제공자 — [LLM 프레임워크](framework/llm.md) 참조. 벡터 스토어는 그것 없이 로컬에서 생성되지만, 수집 (`llm.embed`를 호출함) 에는 구성된 제공자가 필요합니다.

의존성을 설치합니다:

```bash
wippy add wippy/embeddings
wippy add wippy/migration
wippy add wippy/bootloader
wippy add wippy/llm
wippy install
```

## 스토어 생성

KB는 로컬 SQLite 데이터베이스에 있습니다. `wippy/embeddings`는 벡터 테이블을 생성하는 마이그레이션을 제공합니다; 부트로더가 시작 시 이를 실행합니다. 조각들을 함께 연결합니다:

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./data/app.db
    lifecycle:
      auto_start: true

  - name: processes
    kind: process.host
    host:
      max_processes: 1000
      workers: 8

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    parameters:
      - name: target_db
        value: app:db

  - name: migration
    kind: ns.dependency
    component: wippy/migration
    parameters:
      - name: app_db
        value: app:db

  - name: bootloader
    kind: ns.dependency
    component: wippy/bootloader
    parameters:
      - name: application_host
        value: app:processes
      - name: app_db
        value: app:db
      - name: env_storage
        value: app.env:store
```

부트로더는 환경 스토어가 필요합니다; 자체 네임스페이스에 표준 스토어를 추가합니다:

```yaml
# src/env/_index.yaml
version: "1.0"
namespace: app.env

entries:
  - name: file
    kind: env.storage.file
    auto_create: true
    file_path: .env
    lifecycle:
      auto_start: true

  - name: os
    kind: env.storage.os
    lifecycle:
      auto_start: true

  - name: store
    kind: env.storage.router
    lifecycle:
      auto_start: true
    storages:
      - app.env:file
      - app.env:os
```

데이터 디렉토리를 생성하고 앱을 시작합니다:

```bash
mkdir -p data
wippy run
```

부팅 시 마이그레이션이 실행되고 스토어가 `data/app.db`에 나타납니다:

```
$ sqlite3 data/app.db ".tables"
_migrations            embeddings_512         embeddings_512_chunks
embeddings_512_info    embeddings_512_rowids  embeddings_512_vector_chunks00
...
```

`embeddings_512`는 SQLite `vec0` 가상 테이블입니다; `embeddings_512_*` 섀도 테이블은 청크, 행 id, 메타데이터를 보유합니다. (PostgreSQL에서는 동일한 마이그레이션이 대신 `pgvector`를 사용합니다.)

## 문서 수집

수집은 두 단계입니다: `text` 모듈로 텍스트를 청크로 분할한 다음, 각 청크를 임베딩하고 영속화하는 `embeddings.add_batch`로 씁니다.

```lua
-- src/ingest.lua
local text = require("text")
local embeddings = require("embeddings")

local function ingest(doc_id, title, markdown)
    local splitter, err = text.splitter.markdown({
        chunk_size = 800,
        chunk_overlap = 100,
        heading_hierarchy = true,
        code_blocks = true,
    })
    if err then return nil, err end

    local chunks, split_err = splitter:split_text(markdown)
    if split_err then return nil, split_err end

    local batch = {}
    for i, chunk in ipairs(chunks) do
        table.insert(batch, {
            content = chunk,
            content_type = "doc_chunk",
            origin_id = doc_id,
            context_id = tostring(i),
            meta = { title = title, chunk = i },
        })
    end

    return embeddings.add_batch(batch)
end

return { ingest = ingest }
```

함수를 등록합니다:

```yaml
- name: ingest
  kind: function.lua
  source: file://ingest.lua
  method: ingest
  modules:
    - text
  imports:
    embeddings: wippy.embeddings:embeddings
```

주요 사항:

- `origin_id`는 하나의 원본 문서에서 나온 모든 청크를 그룹화합니다 — `embedding_repo.delete_by_origin(doc_id)`로 문서별로 삭제하고 다시 수집합니다.
- `content_type`을 사용하면 하나의 스토어에 서로 구별되는 코퍼스 (`doc_chunk`, `faq`, `code_snippet`) 를 유지하고 쿼리 시 필터링할 수 있습니다.
- `add_batch`는 배치가 8000 토큰 요청 제한을 초과하면 자동으로 분할합니다.

## 콘텐츠 검증

문서가 수집되면 행이 들어갔는지 확인하고 유사도 검색을 실행합니다:

```lua
local embeddings = require("embeddings")

local results, err = embeddings.search("how do I configure TLS?", {
    content_type = "doc_chunk",
    limit = 5,
})
-- results[i].content, .similarity, .meta, .origin_id, .context_id
```

거기서부터 [RAG 튜토리얼](tutorials/rag.md)은 이러한 결과를 그라운딩된 답변을 위해 LLM에 공급하는 방법을 보여줍니다.

## 운영 참고 사항

- **청크 크기**: 500–1000 토큰이 좋은 기본값입니다. 문장이 경계를 넘어 잘리지 않도록 `chunk_overlap` (청크 크기의 ~10–20%) 을 사용하세요.
- **차원**: 512차원의 `text-embedding-3-small`은 비용 효율적이며 `embeddings_512` 테이블과 일치합니다. 더 큰 벡터는 더 큰 저장 공간과 느린 검색을 의미합니다.
- **로컬 대 공유**: SQLite (`vec0`) 는 전체 KB를 하나의 로컬 파일에 유지합니다 — 개발 및 단일 노드 앱에 이상적입니다. 공유된 프로덕션 스토어를 위해서는 `target_db`를 `pgvector`가 있는 `db.sql.postgres`로 가리키세요; 수집 코드는 변경되지 않습니다.

## 다음 단계

- [RAG](tutorials/rag.md) — 이 스토어에서 검색하고 그라운딩된 답변 생성
- [LLM 프레임워크](framework/llm.md) — `llm.embed`, 임베딩 모델, 제공자
- [텍스트 모듈](lua/text/text.md) — 스플리터 및 토큰화
