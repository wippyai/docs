---
title: "Dataflow: Base de Conhecimento Local"
---

# Dataflow: Base de Conhecimento Local

Construa uma base de conhecimento na sua própria máquina — crie o store vetorial, depois
divida em chunks e ingira documentos nele. Este é o companheiro de criação de dados do
[tutorial RAG](tutorials/rag.md): aqui você levanta e preenche uma base de conhecimento
local; lá você recupera dela e gera respostas. Ambos usam o módulo `wippy/embeddings`
apoiado por um store vetorial SQLite local.

## O que você construirá

1. Uma aplicação local cujo banco de dados contém um store vetorial de 512 dimensões.
2. A migração que cria a tabela `embeddings_512` na inicialização.
3. Uma função de ingestão que divide markdown em chunks e escreve embeddings no store.

## Pré-requisitos

- Um projeto Wippy (clone o [app-template](https://github.com/wippyai/app-template), ou
  `wippy init`).
- Um provedor LLM com um modelo de embedding configurado (por exemplo,
  `text-embedding-3-small`) — consulte [Framework LLM](framework/llm.md). O store vetorial
  é criado localmente sem ele, mas a ingestão (que chama `llm.embed`) precisa de um
  provedor configurado.

Instale as dependências:

```bash
wippy add wippy/embeddings
wippy add wippy/migration
wippy add wippy/bootloader
wippy add wippy/llm
wippy install
```

## Crie o store

A base de conhecimento reside em um banco de dados SQLite local. `wippy/embeddings`
fornece uma migração que cria a tabela vetorial; o bootloader a executa na inicialização.
Conecte as peças:

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

O bootloader precisa de um store de ambiente; adicione o padrão em seu próprio namespace:

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

Crie o diretório de dados e inicie a aplicação:

```bash
mkdir -p data
wippy run
```

Na inicialização, a migração é executada e o store aparece em `data/app.db`:

```
$ sqlite3 data/app.db ".tables"
_migrations            embeddings_512         embeddings_512_chunks
embeddings_512_info    embeddings_512_rowids  embeddings_512_vector_chunks00
...
```

`embeddings_512` é uma tabela virtual `vec0` do SQLite; as tabelas-sombra
`embeddings_512_*` contêm seus chunks, row ids e metadados. (No PostgreSQL a mesma
migração usa `pgvector`.)

## Ingerir documentos

A ingestão tem dois passos: dividir o texto em chunks com o módulo `text`, depois
escrevê-los com `embeddings.add_batch`, que embebe e persiste cada chunk.

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

Registre a função:

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

Pontos principais:

- `origin_id` agrupa todos os chunks de um documento de origem — exclua e reingira por
  documento com `embedding_repo.delete_by_origin(doc_id)`.
- `content_type` permite manter corpora distintos (`doc_chunk`, `faq`, `code_snippet`) em
  um único store e filtrar no momento da consulta.
- `add_batch` divide automaticamente quando o lote excede o limite de 8000 tokens por requisição.

## Verifique o conteúdo

Uma vez que os documentos são ingeridos, confirme que as linhas chegaram e execute uma
busca por similaridade:

```lua
local embeddings = require("embeddings")

local results, err = embeddings.search("how do I configure TLS?", {
    content_type = "doc_chunk",
    limit = 5,
})
-- results[i].content, .similarity, .meta, .origin_id, .context_id
```

A partir daí, o [tutorial RAG](tutorials/rag.md) mostra como alimentar esses resultados a
um LLM para respostas fundamentadas.

## Notas operacionais

- **Tamanho do chunk**: 500–1000 tokens é um bom padrão. Use `chunk_overlap` (~10–20% do
  tamanho do chunk) para que as frases não sejam cortadas através das fronteiras.
- **Dimensões**: `text-embedding-3-small` em 512 dimensões é econômico e corresponde à
  tabela `embeddings_512`. Vetores maiores significam maior armazenamento e busca mais lenta.
- **Local vs. compartilhado**: O SQLite (`vec0`) mantém toda a base de conhecimento em um
  único arquivo local — ideal para desenvolvimento e aplicações de nó único. Aponte
  `target_db` para um `db.sql.postgres` com `pgvector` para um store compartilhado de
  produção; o código de ingestão permanece inalterado.

## Próximos Passos

- [RAG](tutorials/rag.md) — recupere deste store e gere respostas fundamentadas
- [Framework LLM](framework/llm.md) — `llm.embed`, modelos de embedding, provedores
- [Módulo Text](lua/text/text.md) — splitters e tokenização
