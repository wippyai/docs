---
title: "Rastreamento de Uso"
description: "Registre o consumo de tokens de LLMs e consulte totais de uso por intervalo de tempo, modelo ou usuário."
---

# Rastreamento de Uso

O módulo `wippy/usage` registra o consumo de tokens de LLMs e oferece consultas agregadas por intervalo de tempo, modelo ou usuário. Ele é a implementação padrão do contrato `wippy.llm:usage_tracker`; por isso, as chamadas feitas pelo módulo de LLM geram registros de uso automaticamente.

Esta página é uma introdução à API com exemplos de referência, não um tutorial independente. Os exemplos pressupõem um projeto Wippy existente, um banco de dados SQL configurado e `wippy/llm` quando o rastreamento automático for necessário. Os registros de uso persistem no banco selecionado; ao terminar os testes, remova os dados de exemplo pelo fluxo normal de manutenção do banco.

## Configuração

Adicione o módulo ao projeto:

```bash
wippy add wippy/usage
wippy install
```

Declare a dependência e defina `target_db` como o banco que armazenará os registros de uso:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    file: ./data/app.db

  - name: dep.usage
    kind: ns.dependency
    component: wippy/usage
    version: "*"
    parameters:
      - name: target_db
        value: app:app_db
```

Quando a aplicação inicia, `wippy/migration` executa a migração `01_create_token_usage_table` do módulo, que cria a tabela `token_usage` e os índices de `user_id`, `context_id`, `model_id` e `timestamp`.

Se você usar o caminho relativo do SQLite mostrado acima, crie o diretório `data` antes de iniciar a aplicação.

## Esquema

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

## Rastreamento automático

`wippy/llm` resolve o contrato `wippy.llm:usage_tracker` antes de cada geração. `wippy/usage` registra sua implementação como padrão:

```yaml
contracts:
  - contract: wippy.llm:usage_tracker
    default: true
    methods:
      track_usage: wippy.usage:usage_tracker
```

Toda chamada bem-sucedida ao LLM invoca `track_usage` com o ID do modelo, as contagens de tokens e um `context_id` opcional. O `user_id` é obtido do ator de segurança ativo; chamadas fora de um contexto de usuário são registradas como `"system"`.

## API do rastreador

Importe o rastreador diretamente para registrar uso fora do fluxo do LLM:

```yaml
imports:
  usage_tracker: wippy.usage:usage_tracker
```

```lua
local tracker = require("usage_tracker")

-- Numeric counts supplied by the caller or model provider.
local prompt_tokens, completion_tokens = 120, 40
local thinking_tokens = 0
local cache_read_tokens, cache_write_tokens = 0, 0

local usage_id, err = tracker.track_usage(
    "openai:gpt-4o",
    prompt_tokens,
    completion_tokens,
    thinking_tokens,
    cache_read_tokens,
    cache_write_tokens,
    { context_id = "chat-42", metadata = { feature = "summary" } }
)
if err then
    error("Failed to record usage: " .. tostring(err))
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-------------|
| `model_id` | string | ID canônico do modelo |
| `prompt_tokens` | number | Tokens de entrada |
| `completion_tokens` | number | Tokens de saída |
| `thinking_tokens` | number | Tokens de raciocínio (0 quando não informado) |
| `cache_read_tokens` | number | Acertos de cache de prompt |
| `cache_write_tokens` | number | Gravações no cache de prompt |
| `options.context_id` | string | Tag livre; usa `ctx.get("context_id")` como fallback |
| `options.timestamp` | number | Timestamp Unix; o padrão é o momento atual (UTC) |
| `options.metadata` | table | Metadados JSON arbitrários armazenados com o registro |

Retorna `usage_id` ou `nil, err`.

## API do repositório

`wippy.usage:token_usage_repo` oferece consultas agregadas:

```yaml
modules:
  - time
imports:
  usage: wippy.usage:token_usage_repo
```

```lua
local usage = require("usage")
local time = require("time")

-- Inclusive query bounds expressed as UNIX timestamps.
local end_unix = time.now():unix()
local start_unix = end_unix - (24 * 60 * 60)

local function require_result(value, err)
    if err then
        error("Usage query failed: " .. tostring(err))
    end
    return value
end

local summary  = require_result(usage.get_summary(start_unix, end_unix))
local by_time  = require_result(usage.get_usage_by_time(start_unix, end_unix, usage.INTERVAL.DAY))
local by_model = require_result(usage.get_usage_by_model(start_unix, end_unix))
local by_user  = require_result(usage.get_usage_by_user(start_unix, end_unix))
```

### Funções

| Função | Retorno |
|----------|---------|
| `get_summary(start, end)` | Totais do intervalo: tokens de prompt, completion, thinking e cache; número de requisições; e `total_tokens` (prompt + completion + thinking) |
| `get_usage_by_time(start, end, interval)` | Array de buckets, um por intervalo; buckets ausentes retornam zeros |
| `get_usage_by_model(start, end)` | Totais por modelo, ordenados por `total_tokens` em ordem decrescente |
| `get_usage_by_user(start, end)` | Totais por usuário, ordenados por `total_tokens` em ordem decrescente |
| `create(user_id, model_id, prompt, completion, options)` | Inserção de baixo nível usada pelo rastreador |

### Intervalos

```lua
usage.INTERVAL.HOUR   -- "hour"
usage.INTERVAL.DAY    -- "day"
usage.INTERVAL.WEEK   -- "week"
usage.INTERVAL.MONTH  -- "month"
```

`get_usage_by_time` alinha os buckets ao intervalo configurado. No PostgreSQL, usa `generate_series` com aritmética de intervalos; no SQLite, usa uma CTE recursiva sobre timestamps Unix. O `total_tokens` de cada bucket exclui os tokens de cache.

### Intervalos de tempo

Tanto o rastreador quanto o repositório aceitam timestamps Unix na fronteira da API pública. Internamente, o repositório os converte em strings RFC3339 para armazenamento e consulta. Passe valores de `os.time()` ou `time.now():unix()`, não strings formatadas.

## Metadados e contexto

A coluna `meta` armazena JSON de formato livre para correlacionar registros com eventos da aplicação:

```lua
local usage_id, err = tracker.track_usage("openai:gpt-4o", 120, 40, 0, 0, 0, {
    context_id = "chat-42",
    metadata   = {
        session_id = "s-7",
        route      = "/api/summarise",
        agent_id   = "writer",
    },
})
if err then
    error("Failed to record usage metadata: " .. tostring(err))
end
```

`context_id` é uma coluna de nível superior e pode ser indexada; `metadata` é armazenado como texto e se destina à exibição, não à filtragem.

## Consulte também

- [LLM](framework/llm.md) — Geração por LLM e o contrato `usage_tracker`
- [Migrações](framework/migration.md) — Executor de migrações que cria o esquema
- [Visão geral do framework](framework/overview.md) — Uso dos módulos do framework
