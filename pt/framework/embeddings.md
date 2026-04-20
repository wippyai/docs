# Embeddings

O modulo `wippy/embeddings` fornece armazenamento de embeddings vetoriais e busca por similaridade tanto para PostgreSQL (pgvector) quanto para SQLite (sqlite-vec). Ele encapsula `wippy/llm` para gerar embeddings e os persiste em um banco de dados da aplicacao.

## Configuracao

Adicione o modulo ao seu projeto:

```bash
wippy add wippy/embeddings
wippy install
```

Declare a dependencia e aponte o requisito `target_db` para o banco de dados da sua aplicacao:

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

Na inicializacao, `wippy/migration` seleciona a migracao `01_create_embeddings_table` e cria a tabela `embeddings` com o indice vetorial apropriado para o driver do seu banco de dados.

## Constantes de Configuracao

A configuracao padrao esta embutida no modulo:

| Constante | Padrao | Descricao |
|----------|---------|-------------|
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Modelo LLM usado para gerar vetores |
| `EMBEDDING_DIMENSIONS` | `512` | Tamanho do vetor passado ao modelo |
| `MAX_TOKENS_PER_REQUEST` | `8000` | Orcamento de tokens por chamada; lotes grandes sao divididos |
| `DEFAULT_SEARCH_LIMIT` | `10` | Numero padrao de resultados retornados por `search` |

Os tokens sao estimados como `#text / 4`. Lotes que excedem o orcamento sao divididos automaticamente.

## Importacao

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

## API de Alto Nivel (`wippy.embeddings:embeddings`)

### add

```lua
local result, err = embeddings.add(content, content_type, origin_id, context_id, meta)
```

Gera um embedding para `content` e o persiste.

| Parametro | Tipo | Obrigatorio | Descricao |
|-----------|------|----------|-------------|
| `content` | string | sim | Texto a ser embutido |
| `content_type` | string | sim | Rotulo livre, ex.: `"document_chunk"`, `"question"` |
| `origin_id` | string | sim | Identificador do documento ou registro de origem |
| `context_id` | string | nao | Chave adicional de escopo (secao, chat, tenant) |
| `meta` | table | nao | Metadados arbitrarios serializaveis em JSON |

Retorna `{ id, content, content_type, origin_id, context_id, meta }` ou `nil, err`.

### add_batch

```lua
local result, err = embeddings.add_batch({
    { content = "...", content_type = "chunk", origin_id = "doc-1" },
    { content = "...", content_type = "chunk", origin_id = "doc-1", context_id = "s1" },
})
```

Gera embeddings e armazena muitos itens em uma unica chamada. Se a contagem total estimada de tokens exceder `MAX_TOKENS_PER_REQUEST`, o lote e dividido e processado em partes. Retorna `{ count, items = { ... } }`.

### search

```lua
local hits, err = embeddings.search("how do migrations work?", {
    content_type = "document_chunk",
    origin_id    = "doc-1",
    context_id   = "section-2",
    limit        = 10,
})
```

Gera um embedding para a string de consulta e executa uma busca por similaridade contra os vetores armazenados. Todos os filtros sao opcionais; os registros correspondentes sao ordenados por similaridade.

### find_by_type

```lua
local hits, err = embeddings.find_by_type(query, content_type, { limit = 10 })
```

Envoltorio de conveniencia para `search` restrito a um unico `content_type`.

### find_by_origin

```lua
local hits, err = embeddings.find_by_origin(query, origin_id, {
    content_type = "document_chunk",
    context_id   = "section-2",
    limit        = 5,
})
```

Envoltorio de conveniencia restrito a um unico `origin_id`, com possibilidade de restricao adicional.

## API do Repositorio (`wippy.embeddings:embedding_repo`)

Use o repositorio diretamente quando voce ja tiver um vetor e quiser pular a geracao do embedding:

| Funcao | Descricao |
|----------|-------------|
| `embedding_repo.add(content, content_type, origin_id, context_id, meta, embedding)` | Insere um vetor pre-computado |
| `embedding_repo.add_batch(batch)` | Insere muitos vetores pre-computados em uma unica instrucao |
| `embedding_repo.get_by_origin(origin_id)` | Lista todos os registros de uma dada origem |
| `embedding_repo.delete_by_origin(origin_id)` | Remove todos os registros de uma dada origem |
| `embedding_repo.delete_by_entry(entry_id)` | Remove um unico registro pelo seu id de linha |
| `embedding_repo.search_by_embedding(vector, options)` | Busca por similaridade contra um vetor bruto |

`search_by_embedding` aceita `{ content_type, origin_id, context_id, limit }`.

## Suporte a Banco de Dados

A migracao cria o schema apropriado para o driver do banco de dados em `target_db`:

- **PostgreSQL** - tabela `embeddings` com uma coluna `vector(512)` e um indice IVFFlat. Requer a extensao `pgvector`.
- **SQLite** - tabela `embeddings` com o vetor armazenado como texto, alem de uma tabela virtual `sqlite-vec` complementar para busca KNN.

Os vetores sao sempre transportados como um array JSON simples na camada da API.

## Veja Tambem

- [LLM](framework/llm.md) - `llm.embed(...)` para geracao bruta de embeddings
- [Migracoes](framework/migration.md) - Executor de migracoes que provisiona a tabela
- [Visao Geral do Framework](framework/overview.md) - Uso dos modulos do framework
