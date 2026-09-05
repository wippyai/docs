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
- `OPENAI_API_KEY` no ambiente — as chamadas de embedding e de geração passam por ela.

Crie o projeto e instale os módulos:

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

## Dependências

Declare a dependência `wippy/embeddings` e aponte-a para seu banco de dados. O parâmetro `target_db` é o Registry ID da entrada de banco de dados na qual a tabela de embeddings residirá. `wippy/embeddings` traz `wippy/llm` e a migração que cria a tabela `embeddings_512`, portanto `wippy/migration` e `wippy/bootloader` também precisam ser conectados — o bootloader executa a migração na inicialização, e tanto ele quanto o módulo LLM executam processos sob o grupo de políticas `wippy.security:process` fornecido por `wippy/security`:

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

O bootloader persiste uma `ENCRYPTION_KEY` gerada, portanto precisa de um armazenamento de ambiente gravável:

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

## Modelos

`wippy/embeddings` chama `llm.embed` com `text-embedding-3-small`, e a geração abaixo usa `gpt-4o-mini`. Ambos são resolvidos a partir do registro, então declare-os também em `src/_index.yaml`:

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

O provedor OpenAI lê `OPENAI_API_KEY` do ambiente do SO por padrão. Veja [Framework LLM](framework/llm.md) para outros provedores e campos de modelo.

## Ingerir documentos

A divisão é manipulada pelo módulo `text`; embedding e persistência pela biblioteca `embeddings`.

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

Registre a função e suas importações:

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

## Exemplo de ponta a ponta

Juntando tudo por trás de um endpoint HTTP. Acrescente estas entradas a `src/_index.yaml`:

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

O servidor declara um contexto de segurança porque a recuperação resolve o modelo de embedding a partir do registro, e uma requisição sem ator e escopo não lê entrada alguma — a resolução do modelo então falha com `Model or class not found`.

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

Inicialize o índice a partir de um comando CLI. `meta.command` torna o processo executável como `wippy run seed`, e seu bloco `security` lhe dá o escopo necessário para chamar `app:ingest`:

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

A primeira execução de `wippy run` cria `data/app.db` e aplica a migração de embeddings. Inicialize o índice, depois inicie o servidor e consulte-o:

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

## Notas operacionais

- **Tamanho do chunk**: `chunk_size` e `chunk_overlap` contam caracteres, não tokens (o splitter mede o comprimento com `utf8.RuneCountInString`). Cerca de 2000–4000 caracteres é um bom ponto de partida. Muito pequeno perde o contexto local; muito grande dilui as pontuações de similaridade. Use `chunk_overlap` (~10–20% do tamanho do chunk) para preservar frases através das fronteiras.
- **Tipos de conteúdo**: Use valores `content_type` distintos (`doc_chunk`, `faq`, `code_snippet`) para que a busca possa filtrar por tipo.
- **Reindexação**: Exclua e reingira por documento via `embedding_repo.delete_by_origin(doc_id)` antes de adicionar novos chunks. O repositório é uma biblioteca separada — importe-o como `embedding_repo: wippy.embeddings:embedding_repo`.
- **Busca híbrida**: Para recall exato de termos (nomes, IDs), combine busca vetorial com busca de texto completo sobre sua tabela fonte e reclassifique.
- **Escolha do modelo**: `wippy/embeddings` é fixo em `text-embedding-3-small` com 512 dimensões, e a tabela `embeddings_512` armazena `vector(512)`/`float[512]`. Um modelo diferente ou outro tamanho de vetor significa alterar as constantes da biblioteca e a tabela da migração.

## Próximos Passos

- [Framework LLM](framework/llm.md) — `llm.generate`, `llm.embed`, construção de prompt
- [Agentes](framework/agents.md) — envolva o retriever como ferramenta de agente
- [Módulo SQL](lua/storage/sql.md) — acesso subjacente ao banco de dados
- [Módulo Text](lua/text/text.md) — splitters e tokenização
