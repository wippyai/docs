# 검색 증강 생성 (RAG)

자신의 문서에서 질문에 답하는 지식 베이스를 구축합니다. 이 튜토리얼은 벡터 검색에 `wippy/embeddings` 모듈을, 생성에 LLM 프레임워크를 사용합니다.

## 무엇을 구축할 것인가

최소한의 RAG 파이프라인:

1. 마크다운 문서 수집 — 청크로 분할, 임베딩, 영속화.
2. 검색 — 벡터 검색은 쿼리에 가장 관련된 청크를 반환합니다.
3. 생성 — LLM 호출은 검색된 청크를 그라운딩 컨텍스트로 사용합니다.

## 전제 조건

- 데이터베이스: `db.sql.sqlite` (`vec0` 지원 포함) 또는 `pgvector` 확장이 있는 `db.sql.postgres`.
- 임베딩 모델 (예: `text-embedding-3-small`) 로 구성된 LLM 제공자 — [LLM 프레임워크](framework/llm.md) 참조.
- 부트스트랩된 Wippy 프로젝트 (`wippy init`, `wippy add wippy/embeddings`).

## 의존성

`wippy/embeddings` 의존성을 선언하고 데이터베이스로 가리킵니다. `target_db` 매개변수는 임베딩 테이블이 있을 데이터베이스 항목의 Registry ID입니다:

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./data/app.db
    lifecycle:
      auto_start: true

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db
```

`wippy/embeddings`는 `wippy/llm`과 `embeddings_512` 테이블 (PostgreSQL `pgvector` 또는 SQLite `vec0` 가상 테이블) 을 생성하는 마이그레이션을 가져옵니다.

## 문서 수집

분할은 `text` 모듈에 의해 처리됩니다. 임베딩 및 영속화는 `embeddings` 라이브러리에서 처리합니다.

```lua
-- app/ingest.lua
local text = require("text")
local embeddings = require("embeddings")
local uuid = require("uuid")

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

함수와 그 임포트를 등록합니다:

```yaml
- name: ingest
  kind: function.lua
  source: file://app/ingest.lua
  method: ingest
  modules:
    - text
    - uuid
  imports:
    embeddings: wippy.embeddings:embeddings
```

주요 사항:

- `origin_id`는 동일한 원본 문서에 속하는 청크를 그룹화합니다.
- `context_id`는 선택적 하위 키 (섹션, 페이지, 청크 인덱스) 입니다.
- `add_batch`는 총 토큰이 8000 토큰 요청 제한을 초과하면 자동으로 분할합니다.

## 검색

벡터 검색은 유사도 점수와 함께 쿼리와 가장 유사한 청크를 반환합니다:

```lua
local embeddings = require("embeddings")

local results, err = embeddings.search("how do I configure TLS?", {
    content_type = "doc_chunk",
    limit = 5,
})

-- results[i].content, .similarity, .meta, .origin_id, .context_id
```

특정 문서에서 답변을 그라운드하려면 origin으로 필터링하세요:

```lua
local hits = embeddings.find_by_origin("refund policy", "doc-42", { limit = 3 })
```

## 답변 생성

검색된 청크를 프롬프트로 구성하고 LLM을 호출합니다. 여기서 검색된 텍스트는 시스템 프롬프트에 추가됩니다; 사용자의 질문은 사용자 턴이 됩니다:

```lua
-- app/answer.lua
local embeddings = require("embeddings")
local llm = require("llm")
local prompt = require("prompt")

local SYSTEM = [[
Answer using only the provided context. If the context does not contain
the answer, say you don't know. Cite the chunk title for each claim.
]]

local function format_context(hits)
    local parts = {}
    for i, h in ipairs(hits) do
        local title = h.meta and h.meta.title or h.origin_id
        table.insert(parts,
            string.format("[%d] %s\n%s", i, title, h.content))
    end
    return table.concat(parts, "\n\n")
end

local function answer(question)
    local hits, err = embeddings.search(question, { limit = 4 })
    if err then return nil, err end

    local p = prompt.new()
    p:add_system(SYSTEM)
    p:add_system("Context:\n\n" .. format_context(hits))
    p:add_user(question)

    local response, gen_err = llm.generate(p, { model = "gpt-4o-mini" })
    if gen_err then return nil, gen_err end

    return {
        answer = response.result,
        sources = hits,
    }
end

return { answer = answer }
```

```yaml
- name: answer
  kind: function.lua
  source: file://app/answer.lua
  method: answer
  imports:
    embeddings: wippy.embeddings:embeddings
    llm: wippy.llm:llm
    prompt: wippy.llm:prompt
```

## 엔드-투-엔드 예제

HTTP 엔드포인트 뒤에서 모두 합치기:

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./data/app.db
    lifecycle:
      auto_start: true

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db

  - name: ingest
    kind: function.lua
    source: file://app/ingest.lua
    method: ingest
    modules:
      - text
      - uuid
    imports:
      embeddings: wippy.embeddings:embeddings

  - name: answer
    kind: function.lua
    source: file://app/answer.lua
    method: answer
    imports:
      embeddings: wippy.embeddings:embeddings
      llm: wippy.llm:llm
      prompt: wippy.llm:prompt

  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api

  - name: ask
    kind: http.endpoint
    meta:
      router: app:api
    method: POST
    path: /ask
    func: app:answer_http

  - name: answer_http
    kind: function.lua
    source: file://app/answer_http.lua
    method: handler
    modules:
      - http
    imports:
      answer: app:answer
```

```lua
-- app/answer_http.lua
local http = require("http")
local answer = require("answer")

local function handler()
    local req = http.request()
    local res = http.response()

    local body, err = req:body_json()
    if err or not body or not body.question then
        res:set_status(http.STATUS.BAD_REQUEST)
        res:write_json({ error = "question is required" })
        return
    end

    local result, ans_err = answer.answer(body.question)
    if ans_err then
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({ error = ans_err })
        return
    end

    res:write_json(result)
end

return { handler = handler }
```

설정 프로세스 또는 CLI 명령 (`meta.command`가 있는 `process.lua`) 에서 `ingest`를 호출하여 인덱스를 시드한 다음 쿼리합니다:

```bash
curl -X POST http://localhost:8080/api/ask \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

## 운영 참고 사항

- **청크 크기**: 500–1000 토큰이 좋은 시작점입니다. 너무 작으면 로컬 컨텍스트가 손실되고, 너무 크면 유사도 점수가 희석됩니다. 경계를 넘어 문장을 보존하기 위해 `chunk_overlap` (청크 크기의 ~10–20%) 을 사용하세요.
- **콘텐츠 타입**: 검색이 타입으로 필터링할 수 있도록 서로 다른 `content_type` 값 (`doc_chunk`, `faq`, `code_snippet`) 을 사용하세요.
- **재인덱싱**: 새 청크를 추가하기 전에 `embedding_repo.delete_by_origin(doc_id)`을 통해 문서별로 삭제하고 다시 수집합니다.
- **하이브리드 검색**: 정확한 용어 재현 (이름, ID) 을 위해 벡터 검색과 소스 테이블에 대한 전체 텍스트 검색을 결합하고 재순위를 매깁니다.
- **모델 선택**: 기본 512차원 `text-embedding-3-small`은 비용 효율적입니다. 재현이 충분하지 않은 경우에만 1024 또는 3072차원으로 업그레이드하세요 — 더 큰 벡터는 더 큰 저장 공간과 느린 검색을 의미합니다.

## 다음 단계

- [LLM 프레임워크](framework/llm.md) — `llm.generate`, `llm.embed`, 프롬프트 구성
- [에이전트](framework/agents.md) — 리트리버를 에이전트 도구로 래핑
- [SQL 모듈](lua/storage/sql.md) — 기본 데이터베이스 액세스
- [텍스트 모듈](lua/text/text.md) — 스플리터 및 토큰화
