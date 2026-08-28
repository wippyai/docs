---
title: "검색 증강 생성(RAG)"
description: "문서를 수집하고 벡터 검색으로 관련 청크를 찾은 뒤 그 컨텍스트에 근거한 답변을 생성합니다."
---

# 검색 증강 생성(RAG)

자체 문서에 대한 검색 증강 생성 파이프라인을 만듭니다. 이 예제는 벡터 검색에 `wippy/embeddings`, 답변 생성에 LLM 프레임워크를 사용합니다.

**분류: 부분 애플리케이션 레시피.** 검색 코드는 완전하지만 독립 실행형 애플리케이션이 아니라 Wippy 애플리케이션 템플릿을 위한 통합입니다. 템플릿이 인증, 보안 정책, 제공자/모델 구성, 부트로더, 마이그레이션 연결을 소유합니다.

## 만들 기능

최소 RAG 파이프라인:

1. Markdown 문서를 분할하고 임베딩하여 청크를 영속화합니다.
2. 벡터 검색으로 쿼리와 가장 관련 있는 청크를 검색합니다.
3. 검색한 청크를 컨텍스트로 사용하여 답변을 생성합니다.

## 사전 요구 사항

- `app:db`, `app:processes`, `app.env:store`, 부트로더/마이그레이션 의존성이 이미 있는 [Wippy 애플리케이션 템플릿](https://github.com/wippyai/app) 기반 애플리케이션
- 런타임의 SQLite(`vec0` 포함) 또는 시작 전에 `pgvector` 확장이 활성화된 PostgreSQL
- 애플리케이션에 구성된 LLM 환경 저장소를 통해 제공되는 `OPENAI_API_KEY`
- `text-embedding-3-small`(`embed` 기능, OpenAI 제공자) 및 `gpt-4o-mini`(`generate` 기능, OpenAI 제공자)라는 레지스트리 모델 엔트리. 임베딩 패키지는 첫 번째 이름을 직접 호출하고 512차원을 요청합니다.

## 의존성

`src/app/deps/_index.yaml`에 `wippy/embeddings` 의존성을 추가하고 대상 데이터베이스를 바인딩합니다.

```yaml
  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db

```

애플리케이션 템플릿이 이미 제공하는 의존성은 다시 선언하지 마세요. 기존 `wippy/migration` 의존성이 `app_db`를 `app:db`에 바인딩하고, 기존 `wippy/bootloader` 의존성이 `application_host`를 `app:processes`에, `env_storage`를 `app.env:store`에 바인딩하는지 확인하세요.

`wippy/embeddings`는 `embeddings_512`(PostgreSQL `pgvector` 또는 SQLite `vec0`)를 생성하는 마이그레이션을 제공합니다. `wippy/migration`이 이를 발견하고 자동 시작되는 부트로더가 `wippy run -c` 중 적용하므로 이 레시피에는 별도 스키마 명령이 없습니다.

의존성 엔트리를 편집한 뒤 그래프를 해석하고 설치합니다.

```bash
wippy update
wippy install
```

## 문서 수집

`text` 모듈이 문서를 분할하고 `embeddings` 라이브러리가 벡터를 생성해 영속화합니다.

```lua
-- src/app/ingest.lua
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

`src/app/_index.yaml`에 함수와 가져오기를 등록합니다.

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

수집 필드는 그룹화와 검색을 제어합니다.

- `origin_id`는 같은 원본 문서의 청크를 묶습니다. PostgreSQL은 이 필드를 `UUID`로 저장하므로 PostgreSQL과 SQLite 모두에서 작동해야 하는 튜토리얼에는 UUID 값을 사용하세요.
- `context_id`는 선택적 하위 키(섹션, 페이지, 청크 인덱스)입니다.
- 총 토큰이 요청당 8000토큰 제한을 초과하면 `add_batch`가 자동으로 나눕니다.

## 검색

벡터 검색은 쿼리와 가장 유사한 청크를 유사도 점수와 함께 반환합니다.

```lua
local embeddings = require("embeddings")

local results, err = embeddings.search("how do I configure TLS?", {
    content_type = "doc_chunk",
    limit = 5,
})

-- results[i].content, .similarity, .meta, .origin_id, .context_id
```

특정 문서에 근거해 답해야 한다면 출처로 필터링합니다.

```lua
local hits = embeddings.find_by_origin(
    "refund policy",
    "91e6f640-2d18-4eb9-a868-1ec4a894ddf6",
    { limit = 3 }
)
```

## 답변 생성

검색한 청크를 프롬프트로 구성하고 LLM을 호출합니다. 여기서는 검색한 텍스트를 시스템 프롬프트에 덧붙이고 사용자의 질문을 사용자 턴으로 만듭니다.

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

같은 `src/app/_index.yaml`에 답변 함수를 등록합니다.

```yaml
- name: answer
  kind: function.lua
  source: file://answer.lua
  method: answer
  imports:
    embeddings: wippy.embeddings:embeddings
    llm: wippy.llm:llm
    prompt: wippy.llm:prompt
```

## HTTP 엔드포인트 예제

다음 엔트리를 `src/app/_index.yaml`에 추가합니다. `ingest`와 `answer` 엔트리는 위에서 이미 추가했으므로 템플릿의 데이터베이스, 게이트웨이, 라우터와 함께 중복 선언하지 마세요.

```yaml
  - name: ask
    kind: http.endpoint
    meta:
      router: app:api
    method: POST
    path: /ask
    func: app:answer_http

  - name: answer_http
    kind: function.lua
    source: file://answer_http.lua
    method: handler
    modules:
      - http
    imports:
      answer: app:answer
```

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

마이그레이션 부트로더가 벡터 테이블을 만들도록 애플리케이션을 시작합니다.

```bash
wippy run -c
```

애플리케이션의 인증된 설정 함수 또는 이름 있는 프로세스에서 `app:ingest`를 호출해 인덱스를 시드합니다. 정확한 시드 표면은 애플리케이션 소유이므로 이 부분 레시피는 인증되지 않은 쓰기 엔드포인트를 노출하지 않습니다. 문서를 하나 이상 수집한 뒤 애플리케이션 세션 베어러로 템플릿의 토큰 보호 API를 쿼리합니다.

```bash
curl -X POST http://localhost:8080/api/v1/ask \
    -H 'Authorization: Bearer <app-session-token>' \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

성공한 응답의 형태는 다음과 같습니다. 답변 텍스트, 유사도 값, 결과 순서는 제공자와 인덱싱된 콘텐츠에 따라 달라집니다.

```json
{
  "answer": "...",
  "sources": [
    {
      "content": "...",
      "content_type": "doc_chunk",
      "origin_id": "91e6f640-2d18-4eb9-a868-1ec4a894ddf6",
      "context_id": "1",
      "similarity": 0.82,
      "meta": { "title": "TLS guide", "chunk": 1 }
    }
  ]
}
```

## 운영 참고 사항

- **청크 크기** — `chunk_size`와 `chunk_overlap`은 토큰이 아니라 문자를 셉니다(분할기는 `utf8.RuneCountInString`으로 길이를 측정합니다). 약 2000~4000자로 시작하는 것이 좋습니다. 너무 작으면 로컬 컨텍스트가 사라지고 너무 크면 유사도 점수가 희석됩니다. 경계에서 문장을 보존하려면 `chunk_overlap`을 청크 크기의 약 10~20%로 설정하세요.
- **콘텐츠 유형** — 검색에서 유형별로 필터링할 수 있도록 서로 다른 `content_type` 값(`doc_chunk`, `faq`, `code_snippet`)을 사용하세요.
- **재인덱싱** — 새 청크를 추가하기 전에 `embedding_repo.delete_by_origin(doc_id)`로 문서별 데이터를 삭제하고 다시 수집합니다.
- **하이브리드 검색** — 이름이나 ID 같은 정확한 용어를 재현하려면 벡터 검색과 원본 테이블의 전문 검색을 결합하고 재순위화합니다.
- **모델 선택** — `wippy/embeddings`는 512차원의 `text-embedding-3-small`로 고정되어 있고 `embeddings_512` 테이블은 `vector(512)`/`float[512]`를 저장합니다. 다른 모델이나 벡터 크기를 사용하려면 라이브러리 상수와 마이그레이션 테이블을 변경해야 합니다.

## 다음 단계

- [LLM 프레임워크](framework/llm.md) — `llm.generate`, `llm.embed`, 프롬프트 구성
- [에이전트](framework/agents.md) — 검색기를 에이전트 도구로 래핑
- [SQL 모듈](lua/storage/sql.md) — 기반 데이터베이스 접근
- [텍스트 모듈](lua/text/text.md) — 문자 기반 텍스트 분할기
