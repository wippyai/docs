---
title: "Geração Aumentada por Recuperação (RAG)"
description: "Ingira documentos, recupere trechos relevantes com busca vetorial e gere respostas fundamentadas nesse contexto."
---

# Geração Aumentada por Recuperação (RAG)

Crie um pipeline de geração aumentada por recuperação sobre seus próprios documentos. O exemplo usa `wippy/embeddings` para busca vetorial e o framework LLM para gerar respostas.

**Classificação: receita parcial de aplicação.** O código de recuperação está completo,
mas é uma integração para o template de aplicação Wippy, não uma aplicação autônoma.
O template fornece autenticação, política de segurança, configuração de provedor e
modelo, bootloader e migrações.

## O que Você Criará

Um pipeline RAG mínimo:

1. Ingira documentos Markdown dividindo-os em trechos, gerando embeddings e persistindo-os.
2. Recupere os trechos mais relevantes para uma consulta com busca vetorial.
3. Gere uma resposta usando os trechos recuperados como contexto.

## Pré-requisitos

- Uma aplicação baseada no [template de aplicação Wippy](https://github.com/wippyai/app),
  com `app:db`, `app:processes`, `app.env:store` e as dependências de bootloader e
  migração já presentes.
- SQLite do runtime (incluindo `vec0`) ou PostgreSQL com a extensão `pgvector`
  habilitada antes da inicialização.
- `OPENAI_API_KEY` disponível pelo armazenamento de ambiente LLM configurado na aplicação.
- Entradas de modelo no registro chamadas `text-embedding-3-small` (capacidade `embed`,
  provedor OpenAI) e `gpt-4o-mini` (capacidade `generate`, provedor OpenAI). O pacote
  de embeddings chama o primeiro nome diretamente e solicita 512 dimensões.

## Dependências

Adicione a dependência `wippy/embeddings` a `src/app/deps/_index.yaml` e vincule seu
banco de dados de destino:

```yaml
  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db

```

Não declare novamente dependências já fornecidas pelo template da aplicação. Confirme
que a dependência `wippy/migration` existente vincula `app_db` a `app:db` e que a
dependência `wippy/bootloader` existente vincula `application_host` a `app:processes`
e `env_storage` a `app.env:store`.

`wippy/embeddings` fornece a migração que cria `embeddings_512` (PostgreSQL `pgvector`
ou SQLite `vec0`). `wippy/migration` a descobre, e o bootloader iniciado automaticamente
a aplica durante `wippy run -c`; esta receita não possui um comando de esquema separado.

Depois de editar as entradas de dependência, resolva e instale o grafo:

```bash
wippy update
wippy install
```

## Ingerir Documentos

O módulo `text` divide os documentos, enquanto a biblioteca `embeddings` gera e persiste seus vetores.

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

Registre a função e suas importações em `src/app/_index.yaml`:

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

Os campos de ingestão controlam o agrupamento e a recuperação:

- `origin_id` agrupa trechos do mesmo documento de origem. O PostgreSQL armazena esse
  campo como `UUID`, portanto use valores UUID para que o tutorial funcione tanto no
  PostgreSQL quanto no SQLite.
- `context_id` é uma subchave opcional (seção, página ou índice do trecho).
- `add_batch` divide automaticamente quando o total de tokens excede o limite de 8000 tokens por solicitação.

## Recuperar

A busca vetorial retorna os trechos mais semelhantes à consulta, com pontuações de similaridade:

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
local hits = embeddings.find_by_origin(
    "refund policy",
    "91e6f640-2d18-4eb9-a868-1ec4a894ddf6",
    { limit = 3 }
)
```

## Gerar uma Resposta

Componha os trechos recuperados em um prompt e chame o LLM. Aqui o texto recuperado é acrescentado ao prompt do sistema, e a pergunta se torna o turno do usuário:

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

Registre a função de resposta no mesmo `src/app/_index.yaml`:

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

## Exemplo de Endpoint HTTP

Acrescente as entradas a seguir a `src/app/_index.yaml`. As entradas `ingest` e
`answer` já foram adicionadas acima; não duplique essas entradas nem o banco, o
gateway e o roteador do template:

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

Inicie a aplicação para que o bootloader de migração crie a tabela vetorial:

```bash
wippy run -c
```

Preencha o índice chamando `app:ingest` a partir de uma função de configuração
autenticada ou de um processo nomeado da aplicação. A superfície exata pertence à
aplicação, portanto esta receita parcial não expõe um endpoint de escrita não
autenticado. Depois de ingerir pelo menos um documento, consulte a API protegida por
token do template com um bearer de sessão da aplicação:

```bash
curl -X POST http://localhost:8080/api/v1/ask \
    -H 'Authorization: Bearer <app-session-token>' \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

Uma resposta bem-sucedida tem o formato abaixo; o texto da resposta, os valores de
similaridade e a ordem dos resultados dependem do provedor e do conteúdo indexado:

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

## Notas Operacionais

- **Tamanho dos trechos** — `chunk_size` e `chunk_overlap` contam caracteres, não tokens (o divisor mede o comprimento com `utf8.RuneCountInString`). Cerca de 2000–4000 caracteres é um bom ponto de partida. Um tamanho pequeno demais perde o contexto local; um tamanho grande demais dilui as pontuações de similaridade. Use `chunk_overlap` (~10–20% do tamanho do trecho) para preservar frases entre limites.
- **Tipos de conteúdo** — Use valores distintos de `content_type` (`doc_chunk`, `faq`, `code_snippet`) para permitir filtros por tipo.
- **Reindexação** — Exclua e ingira novamente cada documento com `embedding_repo.delete_by_origin(doc_id)` antes de adicionar novos trechos.
- **Busca híbrida** — Para recuperar termos exatos (nomes e IDs), combine busca vetorial com busca de texto completo na tabela de origem e reordene os resultados.
- **Escolha do modelo** — `wippy/embeddings` usa `text-embedding-3-small` com 512 dimensões, e a tabela `embeddings_512` armazena `vector(512)`/`float[512]`. Outro modelo ou tamanho de vetor exige alterar as constantes da biblioteca e a tabela da migração.

## Próximos Passos

- [Framework LLM](../framework/llm.md) — `llm.generate`, `llm.embed` e construção de prompts
- [Agentes](../framework/agents.md) — Envolva o recuperador como uma ferramenta de agente
- [Módulo SQL](../lua/storage/sql.md) — Acesso subjacente ao banco de dados
- [Módulo Text](../lua/text/text.md) — Divisores de texto baseados em caracteres
