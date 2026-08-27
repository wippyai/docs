---
title: "Embeddings"
description: "Gere, armazene e pesquise embeddings vetoriais com PostgreSQL pgvector ou SQLite sqlite-vec."
---

# Embeddings

O módulo `wippy/embeddings` gera embeddings por meio de `wippy/llm`, armazena-os em um banco de dados da aplicação e executa buscas vetoriais por similaridade. Ele oferece suporte a PostgreSQL com pgvector e SQLite com sqlite-vec.

Esta página é uma introdução à API com exemplos de referência, não um tutorial independente. Os exemplos pressupõem um projeto Wippy existente, um banco configurado e o modelo, o provedor e as credenciais de embeddings descritos abaixo. Chamadas remotas de embeddings podem gerar cobranças do provedor. Para uma aplicação completa que indexa e pesquisa conteúdo, siga [Crie um pipeline RAG](../tutorials/rag.md).

## Configuração

Adicione o módulo ao projeto:

```bash
wippy add wippy/embeddings
wippy install
```

### Modelo e provedor obrigatórios

Antes de chamar a API de embeddings, registre um `llm.model` cujo `meta.name` seja `text-embedding-3-small`, cujas capacidades incluam `embed` e cujo mapeamento de provedor resolva para um provedor de embeddings. Configure as credenciais desse provedor, como `OPENAI_API_KEY`, no armazenamento de ambiente usado por `wippy/llm`. Consulte a [configuração de modelos de LLM](./llm.md#model-configuration).

### Dependência do banco de dados

Declare a dependência e defina seu parâmetro `target_db` como o banco de dados da aplicação:

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

Na inicialização, `wippy/migration` detecta a migração `01_create_embeddings_table` e cria a tabela `embeddings_512` para o driver de banco configurado.

Se você usar o caminho relativo do SQLite mostrado acima, crie o diretório `data` antes de iniciar a aplicação.

## Constantes fixas atuais

O módulo define atualmente estas constantes privadas; elas não são parâmetros da dependência:

| Constante | Padrão | Descrição |
|----------|---------|-------------|
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Modelo LLM usado para gerar vetores |
| `EMBEDDING_DIMENSIONS` | `512` | Tamanho do vetor passado ao modelo |
| `MAX_TOKENS_PER_REQUEST` | `8000` | Orçamento de tokens por chamada; lotes grandes são divididos |
| `DEFAULT_SEARCH_LIMIT` | `10` | Número padrão de resultados retornados por `search` |

Os tokens são estimados como `ceil(#text / 4)`. Lotes grandes são divididos entre os itens. Um item individual maior que o orçamento não é dividido e faz esse sublote falhar antes da chamada ao LLM.

## Importação

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

## API de alto nível (`wippy.embeddings:embeddings`)

### add

```lua
local result, err = embeddings.add(content, content_type, origin_id, context_id, meta)
```

Gera um embedding para `content` e o persiste.

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|----------|-------------|
| `content` | string | sim | Texto a ser embutido |
| `content_type` | string | sim | Rótulo como `"document_chunk"` ou `"question"`; no PostgreSQL, limitado a 32 caracteres |
| `origin_id` | string | sim | Identificador do documento ou registro de origem; deve ser um UUID quando `target_db` for PostgreSQL |
| `context_id` | string | não | Chave adicional de escopo (seção, chat, tenant) |
| `meta` | table | não | Metadados arbitrários serializáveis em JSON |

Retorna `{ entry_id, origin_id, content_type, context_id }` ou `nil, err`.

<warning>
Na versão de referência fixada do framework, o helper de item único passa ao repositório o resultado aninhado de `llm.embed()`, em vez de seu primeiro vetor; por isso, `embeddings.add()` não consegue persistir com sucesso. Use `embeddings.add_batch()` com um item ou chame `llm.embed()` e passe `response.result[1]` para `embedding_repo.add()` até que a implementação do framework seja corrigida.
</warning>

### add_batch

O exemplo a seguir usa IDs de aplicação compatíveis com SQLite. No PostgreSQL, substitua `doc-1` por um UUID, pois o esquema armazena `origin_id` como `UUID`.

```lua
local result, err = embeddings.add_batch({
    { content = "...", content_type = "chunk", origin_id = "doc-1" },
    { content = "...", content_type = "chunk", origin_id = "doc-1", context_id = "s1" },
})
```

Gera embeddings e armazena vários itens em uma única chamada. Se a contagem total estimada de tokens exceder `MAX_TOKENS_PER_REQUEST`, o método divide o lote em blocos. Cada bloco enviado ao repositório é transacional, mas um lote de alto nível dividido não é atômico entre os blocos: blocos anteriores permanecem armazenados se um bloco posterior falhar. Retorna `{ count, items = { ... } }`.

Para remover registros criados durante testes, use o método `delete_by_origin(origin_id)` da API do repositório para cada origem de exemplo.

### search

```lua
local hits, err = embeddings.search("how do migrations work?", {
    content_type = "document_chunk",
    origin_id    = "doc-1",
    context_id   = "section-2",
    limit        = 10,
})
```

Gera um embedding para a string de consulta e executa uma busca por similaridade nos vetores armazenados. Todos os filtros são opcionais; os registros correspondentes são ordenados por similaridade.

`origin_id` pode ser uma string ou um array não vazio de strings. Cada resultado contém `entry_id`, `origin_id`, `content_type`, `context_id`, `content`, `meta` decodificado, timestamps e `similarity`.

### find_by_type

```lua
local hits, err = embeddings.find_by_type(
    "how do migrations work?",
    "document_chunk",
    { limit = 10 }
)
```

Chama `search` com um único `content_type`. O limite padrão é `10`.

### find_by_origin

```lua
local hits, err = embeddings.find_by_origin("how do migrations work?", "doc-1", {
    content_type = "document_chunk",
    context_id   = "section-2",
    limit        = 5,
})
```

Chama `search` com um único `origin_id` e filtros opcionais de `content_type` e `context_id`. O limite padrão é `5`.

## API do repositório (`wippy.embeddings:embedding_repo`)

Use o repositório diretamente quando já tiver um vetor e quiser evitar a geração do embedding. Embeddings brutos devem conter exatamente 512 valores numéricos:

| Função | Descrição |
|----------|-------------|
| `embedding_repo.add(content, content_type, origin_id, context_id, meta, embedding)` | Insere um vetor pré-calculado |
| `embedding_repo.add_batch(batch)` | Insere vários vetores pré-calculados em uma transação |
| `embedding_repo.get_by_origin(origin_id)` | Lista todos os registros de uma origem |
| `embedding_repo.delete_by_origin(origin_id)` | Remove todos os registros de uma origem |
| `embedding_repo.delete_by_entry(entry_id)` | Remove um único registro pelo ID da linha |
| `embedding_repo.search_by_embedding(vector, options)` | Pesquisa por similaridade usando um vetor bruto |

`search_by_embedding` aceita `{ content_type, origin_id, context_id, limit }`.

## Bancos de dados compatíveis

A migração cria o esquema apropriado para o driver do banco em `target_db`:

- **PostgreSQL** — Tabela `embeddings_512` com uma coluna `vector(512)` e um índice IVFFlat de cosseno. A migração tenta instalar a extensão `vector`; portanto, o papel do banco deve poder criá-la ou a extensão já deve existir. O PostgreSQL armazena `origin_id` como `UUID`.
- **SQLite** — Tabela virtual `vec0` chamada `embeddings_512`, que mantém a coluna vetorial `embedding float[512]` junto das colunas de metadados e conteúdo para busca KNN.

## Consulte também

- [LLM](./llm.md) — `llm.embed(...)` para geração direta de embeddings
- [Migrações](./migration.md) — Executor de migrações que provisiona a tabela
- [Visão geral do framework](./overview.md) — Uso dos módulos do framework
