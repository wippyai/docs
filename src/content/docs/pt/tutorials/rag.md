---
title: "Geração Aumentada por Recuperação (RAG)"
description: "Construa uma base de conhecimento que responda perguntas a partir dos seus próprios documentos. Este tutorial usa o módulo wippy/embeddings para busca…"
---

# Geração Aumentada por Recuperação (RAG)

Construa uma base de conhecimento que responda perguntas a partir dos seus próprios documentos. Este tutorial usa o módulo `wippy/embeddings` para busca vetorial e o framework LLM para geração.

## O que você construirá

Um pipeline RAG mínimo:

1. Ingerir documentos markdown — dividir em chunks, embeber, persistir.
2. Recuperar — a busca vetorial retorna os chunks mais relevantes para uma consulta.
3. Gerar — uma chamada LLM usa os chunks recuperados como contexto de grounding.

## Pré-requisitos

- Um banco de dados: `db.sql.sqlite` (inclui suporte `vec0`) ou `db.sql.postgres` com a extensão `pgvector`.
- Um provedor LLM configurado com um modelo de embedding (por exemplo, `text-embedding-3-small`) — consulte [Framework LLM](framework/llm.md).
- Projeto Wippy inicializado (`wippy init`, `wippy add wippy/embeddings`).

## Dependências

Declare a dependência `wippy/embeddings` e aponte-a para seu banco de dados. O parâmetro `target_db` é o Registry ID da entrada de banco de dados na qual a tabela de embeddings residirá:

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

`wippy/embeddings` traz `wippy/llm` e a migração que cria a tabela `embeddings_512` (PostgreSQL `pgvector` ou tabela virtual SQLite `vec0`).

## Ingerir documentos

A divisão é manipulada pelo módulo `text`; embedding e persistência pela biblioteca `embeddings`.

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

Registre a função e suas importações:

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

Pontos principais:

- `origin_id` agrupa chunks que pertencem ao mesmo documento de origem.
- `context_id` é uma subchave opcional (seção, página, índice do chunk).
- `add_batch` divide automaticamente se o total de tokens exceder o limite de 8000 tokens por requisição.

## Recuperar

A busca vetorial retorna os chunks mais similares à consulta, juntamente com pontuações de similaridade:

```lua
local embeddings = require("embeddings")

local results, err = embeddings.search("how do I configure TLS?", {
    content_type = "doc_chunk",
    limit = 5,
})

-- results[i].content, .similarity, .meta, .origin_id, .context_id
```

Filtre por origem quando quiser fundamentar a resposta em um documento específico:

```lua
local hits = embeddings.find_by_origin("refund policy", "doc-42", { limit = 3 })
```

## Gerar uma resposta

Componha os chunks recuperados em um prompt e chame o LLM. Aqui o texto recuperado é anexado ao prompt do sistema; a pergunta do usuário se torna o turno do usuário:

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

## Exemplo de ponta a ponta

Juntando tudo por trás de um endpoint HTTP:

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

Inicialize o índice chamando `ingest` a partir de um processo de configuração ou um comando CLI (`process.lua` com `meta.command`), depois consulte:

```bash
curl -X POST http://localhost:8080/api/ask \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

## Notas operacionais

- **Tamanho do chunk**: 500–1000 tokens é um bom ponto de partida. Muito pequeno perde o contexto local; muito grande dilui as pontuações de similaridade. Use `chunk_overlap` (~10–20% do tamanho do chunk) para preservar frases através das fronteiras.
- **Tipos de conteúdo**: Use valores `content_type` distintos (`doc_chunk`, `faq`, `code_snippet`) para que a busca possa filtrar por tipo.
- **Reindexação**: Exclua e reingira por documento via `embedding_repo.delete_by_origin(doc_id)` antes de adicionar novos chunks.
- **Busca híbrida**: Para recall exato de termos (nomes, IDs), combine busca vetorial com busca de texto completo sobre sua tabela fonte e reclassifique.
- **Escolha do modelo**: O modelo padrão de 512 dimensões `text-embedding-3-small` é econômico. Atualize para 1024 ou 3072 dimensões somente se o recall for insuficiente — vetores maiores significam maior armazenamento e busca mais lenta.

## Próximos Passos

- [Framework LLM](framework/llm.md) — `llm.generate`, `llm.embed`, construção de prompt
- [Agentes](framework/agents.md) — envolva o retriever como ferramenta de agente
- [Módulo SQL](lua/storage/sql.md) — acesso subjacente ao banco de dados
- [Módulo Text](lua/text/text.md) — splitters e tokenização
