---
title: "검색 증강 생성 (RAG)"
description: "자신의 문서에서 질문에 답하는 지식 베이스를 구축합니다. 이 튜토리얼은 벡터 검색에 wippy/embeddings 모듈을, 생성에 LLM 프레임워크를 사용합니다."
---

# 검색 증강 생성 (RAG)

자신의 문서에서 질문에 답하는 지식 베이스를 구축합니다. 이 튜토리얼은 벡터 검색에 `wippy/embeddings` 모듈을, 생성에 LLM 프레임워크를 사용합니다.

## 무엇을 구축할 것인가

최소한의 RAG 파이프라인:

1. 마크다운 문서 수집 — 청크로 분할, 임베딩, 영속화.
2. 검색 — 벡터 검색은 쿼리에 가장 관련된 청크를 반환합니다.
3. 생성 — LLM 호출은 검색된 청크를 그라운딩 컨텍스트로 사용합니다.

## 전제 조건

- 데이터베이스: `db.sql.sqlite` (`vec0` 지원 포함) 또는 `pgvector` 확장이 있는 `db.sql.postgres`.
- 환경 변수의 `OPENAI_API_KEY` — 임베딩 및 생성 호출이 이를 통해 이루어집니다.

프로젝트를 생성하고 모듈을 설치합니다:

```bash
mkdir rag && cd rag
mkdir -p src/app data
wippy init
wippy add wippy/embeddings
wippy add wippy/migration
wippy add wippy/bootloader
wippy add wippy/security
wippy install
```

```
rag/
├── wippy.lock
├── data/
└── src/
    ├── _index.yaml
    ├── env/
    │   └── _index.yaml
    └── app/
        ├── ingest.lua
        ├── answer.lua
        ├── answer_http.lua
        └── seed.lua
```

## 의존성

`wippy/embeddings` 의존성을 선언하고 데이터베이스로 가리킵니다. `target_db` 매개변수는 임베딩 테이블이 있을 데이터베이스 항목의 Registry ID입니다. `wippy/embeddings`는 `wippy/llm`과 `embeddings_512` 테이블을 생성하는 마이그레이션을 가져오므로, `wippy/migration`과 `wippy/bootloader`도 함께 연결해야 합니다 — 부트로더는 시작 시 마이그레이션을 실행하고, 부트로더와 LLM 모듈은 모두 `wippy/security`가 제공하는 `wippy.security:process` 정책 그룹으로 프로세스를 실행합니다:

```yaml
# src/_index.yaml
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
    lifecycle:
      auto_start: true

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db

  - name: migration
    kind: ns.dependency
    component: wippy/migration
    version: "*"
    parameters:
      - name: app_db
        value: app:db

  - name: bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app.env:store

  - name: security
    kind: ns.dependency
    component: wippy/security
    version: "*"
```

부트로더는 생성된 `ENCRYPTION_KEY`를 영속화하므로 쓰기 가능한 환경 저장소가 필요합니다:

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

## 모델

`wippy/embeddings`는 `text-embedding-3-small`로 `llm.embed`를 호출하며, 아래의 생성은 `gpt-4o-mini`를 사용합니다. 둘 다 레지스트리에서 해석되므로 `src/_index.yaml`에도 선언합니다:

```yaml
  - name: text-embedding-3-small
    kind: registry.entry
    meta:
      name: text-embedding-3-small
      type: llm.model
      title: Text Embedding 3 Small
      capabilities:
        - embed
    dimensions: 512
    max_tokens: 8191
    pricing:
      input: 0.02
      output: 0
    providers:
      - id: wippy.llm.openai:provider
        provider_model: text-embedding-3-small

  - name: gpt-4o-mini
    kind: registry.entry
    meta:
      name: gpt-4o-mini
      type: llm.model
      title: GPT-4o mini
      capabilities:
        - generate
    max_tokens: 128000
    output_tokens: 16384
    pricing:
      input: 0.15
      output: 0.6
    providers:
      - id: wippy.llm.openai:provider
        provider_model: gpt-4o-mini
```

OpenAI 제공자는 기본적으로 OS 환경에서 `OPENAI_API_KEY`를 읽습니다. 다른 제공자와 모델 필드는 [LLM 프레임워크](framework/llm.md)를 참조하세요.

## 문서 수집

분할은 `text` 모듈에 의해 처리됩니다. 임베딩 및 영속화는 `embeddings` 라이브러리에서 처리합니다.

```lua
-- src/app/ingest.lua
local text = require("text")
local embeddings = require("embeddings")

local function ingest(doc_id: string, title: string, markdown: string)
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
-- src/app/answer.lua
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

local function answer(question: string)
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

HTTP 엔드포인트 뒤에서 모두 합치기. 다음 엔트리를 `src/_index.yaml`에 추가합니다:

```yaml
  - name: ingest
    kind: function.lua
    source: file://app/ingest.lua
    method: ingest
    modules:
      - text
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

  - name: seed
    kind: process.lua
    meta:
      command:
        name: seed
        short: Ingest the sample document
        security:
          groups:
            - wippy.security:process
    source: file://app/seed.lua
    method: main
    modules:
      - funcs
      - io

  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true
      security:
        actor:
          id: gateway
        groups:
          - wippy.security:process

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

검색이 레지스트리에서 임베딩 모델을 해석하기 때문에 서버는 보안 컨텍스트를 선언합니다. 액터와 스코프가 없는 요청은 어떤 엔트리도 읽지 못하며, 그 경우 모델 해석이 `Model or class not found`로 실패합니다.

```lua
-- src/app/answer_http.lua
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

    local result, ans_err = answer.answer(tostring(body.question))
    if ans_err then
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({ error = ans_err })
        return
    end

    res:write_json(result)
end

return { handler = handler }
```

CLI 명령으로 인덱스를 시드합니다. `meta.command`는 프로세스를 `wippy run seed`로 실행할 수 있게 하고, 그 `security` 블록은 `app:ingest`를 호출하는 데 필요한 스코프를 부여합니다:

```lua
-- src/app/seed.lua
local funcs = require("funcs")
local io = require("io")

local DOC = [[
# TLS Configuration

Wippy servers terminate TLS when the `tls` block is present on the
`http.service` entry. Set `cert_file` and `key_file` to PEM paths.

## Refund Policy

Refunds are issued within 14 days of purchase.
]]

local function main()
    local res, err = funcs.call("app:ingest", "doc-42", "Handbook", DOC)
    if err then
        io.print("ingest failed: " .. tostring(err))
        return
    end
    io.print("ingested " .. tostring(res.count) .. " chunks")
end

return { main = main }
```

첫 `wippy run`이 `data/app.db`를 생성하고 임베딩 마이그레이션을 적용합니다. 인덱스를 시드한 다음 서버를 시작하고 쿼리합니다:

```bash
wippy run seed
# ingested 2 chunks

wippy run
```

```bash
curl -X POST http://localhost:8080/api/ask \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

```json
{
  "answer": "You can configure TLS by adding a `tls` block to the `http.service` entry. Set `cert_file` and `key_file` to the paths of your PEM files. (See: Handbook, TLS Configuration)",
  "sources": [
    {
      "entry_id": "52fafcc0-2d18-40d9-8a6e-7662ef9d9bea",
      "origin_id": "doc-42",
      "context_id": "1",
      "content_type": "doc_chunk",
      "content": "# TLS Configuration\nWippy servers terminate TLS when the `tls` block is present on the\n`http.service` entry. Set `cert_file` and `key_file` to PEM paths.",
      "meta": { "title": "Handbook", "chunk": 1 },
      "similarity": 0.0736
    }
  ]
}
```

## 운영 참고 사항

- **청크 크기**: `chunk_size`와 `chunk_overlap`은 토큰이 아니라 문자를 셉니다 (splitter는 `utf8.RuneCountInString`으로 길이를 측정합니다). 대략 2000–4000자가 좋은 시작점입니다. 너무 작으면 로컬 컨텍스트가 손실되고, 너무 크면 유사도 점수가 희석됩니다. 경계를 넘어 문장을 보존하기 위해 `chunk_overlap` (청크 크기의 ~10–20%) 을 사용하세요.
- **콘텐츠 타입**: 검색이 타입으로 필터링할 수 있도록 서로 다른 `content_type` 값 (`doc_chunk`, `faq`, `code_snippet`) 을 사용하세요.
- **재인덱싱**: 새 청크를 추가하기 전에 `embedding_repo.delete_by_origin(doc_id)`을 통해 문서별로 삭제하고 다시 수집합니다. 리포지토리는 별도의 라이브러리이므로 `embedding_repo: wippy.embeddings:embedding_repo`로 임포트하세요.
- **하이브리드 검색**: 정확한 용어 재현 (이름, ID) 을 위해 벡터 검색과 소스 테이블에 대한 전체 텍스트 검색을 결합하고 재순위를 매깁니다.
- **모델 선택**: `wippy/embeddings`는 512차원의 `text-embedding-3-small`로 고정되어 있으며, `embeddings_512` 테이블은 `vector(512)`/`float[512]`를 저장합니다. 다른 모델이나 벡터 크기를 쓰려면 라이브러리 상수와 마이그레이션 테이블을 변경해야 합니다.

## 다음 단계

- [LLM 프레임워크](framework/llm.md) — `llm.generate`, `llm.embed`, 프롬프트 구성
- [에이전트](framework/agents.md) — 리트리버를 에이전트 도구로 래핑
- [SQL 모듈](lua/storage/sql.md) — 기본 데이터베이스 액세스
- [텍스트 모듈](lua/text/text.md) — 스플리터 및 토큰화
