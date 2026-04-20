# Rastreamento de Uso

O modulo `wippy/usage` registra o consumo de tokens de LLMs e fornece consultas agregadas agrupadas por intervalo de tempo, modelo ou usuario. Ele se vincula ao contrato `wippy.llm:usage_tracker`, de modo que qualquer codigo que chame atraves do modulo LLM produz automaticamente registros de uso.

## Configuracao

Adicione o modulo ao seu projeto:

```bash
wippy add wippy/usage
wippy install
```

Declare a dependencia e aponte o requisito `target_db` para o banco de dados onde os registros de uso devem residir:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    path: ./data/app.db

  - name: dep.usage
    kind: ns.dependency
    component: wippy/usage
    version: "*"

  - name: target_db
    kind: registry.entry
    meta:
      wippy.usage.target_db: app:app_db
```

Quando a aplicacao inicia, `wippy/migration` executa a migracao `01_create_token_usage_table` do modulo, que cria a tabela `token_usage` junto com indices em `user_id`, `context_id`, `model_id` e `timestamp`.

## Schema

```
token_usage
├── usage_id           text primary key (uuid v7)
├── user_id            text not null
├── context_id         text
├── model_id           text not null
├── prompt_tokens      integer
├── completion_tokens  integer
├── thinking_tokens    integer default 0
├── cache_read_tokens  integer default 0
├── cache_write_tokens integer default 0
├── timestamp          timestamp
└── meta               text (JSON)
```

## Rastreamento Automatico

`wippy/llm` resolve o contrato `wippy.llm:usage_tracker` antes de cada geracao. `wippy/usage` vincula sua implementacao como padrao:

```yaml
contracts:
  - contract: wippy.llm:usage_tracker
    default: true
    methods:
      track_usage: wippy.usage:usage_tracker
```

Toda chamada LLM bem-sucedida invoca `track_usage` com o id do modelo, as contagens de tokens e um `context_id` opcional. O `user_id` e obtido do ator de seguranca ativo; chamadas fora de um contexto de usuario sao registradas como `"system"`.

## API do Rastreador

Importe o rastreador diretamente quando precisar registrar uso fora do fluxo LLM:

```yaml
imports:
  usage_tracker: wippy.usage:usage_tracker
```

```lua
local tracker = require("usage_tracker")

local usage_id, err = tracker.track_usage(
    "openai:gpt-4o",
    prompt_tokens,
    completion_tokens,
    thinking_tokens,
    cache_read_tokens,
    cache_write_tokens,
    { context_id = "chat-42", metadata = { feature = "summary" } }
)
```

| Parametro | Tipo | Descricao |
|-----------|------|-------------|
| `model_id` | string | Id canonico do modelo |
| `prompt_tokens` | number | Tokens de entrada |
| `completion_tokens` | number | Tokens de saida |
| `thinking_tokens` | number | Tokens de raciocinio (0 quando nao reportado) |
| `cache_read_tokens` | number | Acertos de cache de prompt |
| `cache_write_tokens` | number | Gravacoes no cache de prompt |
| `options.context_id` | string | Tag livre; fallback para `ctx.get("context_id")` |
| `options.timestamp` | number | Timestamp Unix; padrao e agora (UTC) |
| `options.metadata` | table | Metadados JSON arbitrarios armazenados junto ao registro |

Retorna `usage_id` ou `nil, err`.

## API do Repositorio

`wippy.usage:token_usage_repo` oferece consultas agregadas:

```yaml
imports:
  usage: wippy.usage:token_usage_repo
```

```lua
local usage = require("usage")

local summary  = usage.get_summary(start_unix, end_unix)
local by_time  = usage.get_usage_by_time(start_unix, end_unix, usage.INTERVAL.DAY)
local by_model = usage.get_usage_by_model(start_unix, end_unix)
local by_user  = usage.get_usage_by_user(start_unix, end_unix)
```

### Funcoes

| Funcao | Retorno |
|----------|---------|
| `get_summary(start, end)` | Totais do intervalo: tokens de prompt/completion/thinking/cache, contagem de requisicoes, `total_tokens` (prompt + completion + thinking) |
| `get_usage_by_time(start, end, interval)` | Array de baldes, um por intervalo; baldes ausentes retornam zeros |
| `get_usage_by_model(start, end)` | Totais por modelo, ordenados por `total_tokens` descendente |
| `get_usage_by_user(start, end)` | Totais por usuario, ordenados por `total_tokens` descendente |
| `create(user_id, model_id, prompt, completion, options)` | Insercao de baixo nivel usada pelo rastreador |

### Intervalos

```lua
usage.INTERVAL.HOUR   -- "hour"
usage.INTERVAL.DAY    -- "day"
usage.INTERVAL.WEEK   -- "week"
usage.INTERVAL.MONTH  -- "month"
```

`get_usage_by_time` alinha os baldes ao intervalo configurado. No PostgreSQL usa `generate_series` com aritmetica de intervalos; no SQLite usa uma CTE recursiva sobre timestamps UNIX. O `total_tokens` em cada balde exclui tokens de cache.

### Intervalos de Tempo

Tanto o rastreador quanto o repositorio aceitam timestamps UNIX na fronteira da API publica. Internamente o repositorio converte para strings RFC3339 para armazenamento e consulta. Passe valores de `os.time()` ou `time.now():unix()`, nao strings formatadas.

## Metadados e Contexto

A coluna `meta` armazena um blob JSON livre. Use-a para correlacionar registros com eventos da aplicacao:

```lua
tracker.track_usage(model_id, prompt, completion, 0, 0, 0, {
    context_id = "chat-42",
    metadata   = {
        session_id = "s-7",
        route      = "/api/summarise",
        agent_id   = "writer",
    },
})
```

`context_id` e uma coluna de nivel superior e pode ser indexada; `metadata` e armazenado como texto e destina-se a exibicao, nao a filtragem.

## Veja Tambem

- [LLM](framework/llm.md) - Geracao LLM e o contrato `usage_tracker`
- [Migracoes](framework/migration.md) - Executor de migracoes que cria o schema
- [Visao Geral do Framework](framework/overview.md) - Uso dos modulos do framework
