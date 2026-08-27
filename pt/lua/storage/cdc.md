---
title: "CDC"
description: "Assine streams de change data capture do PostgreSQL e receba eventos no nível de linha."
---

# CDC
<secondary-label ref="storage"/>
<secondary-label ref="stream"/>
<secondary-label ref="nondeterministic"/>

O módulo `cdc` assina streams de change data capture do PostgreSQL provenientes de fontes [`db.cdc.postgres`](../../system/cdc.md). Ele lista fontes configuradas, abre streams e entrega eventos de alteração de linhas por channels.

Esta página é uma referência de API com uma receita parcial de assinatura. Seus exemplos exigem uma fonte CDC configurada e em execução; abrir o channel de entrega também exige um contexto de processo em execução. Callbacks da aplicação, como `handle_new_user`, são placeholders fornecidos pelo chamador.

## Carregamento

```lua
local cdc = require("cdc")
```

## `list_sources`

Lista as fontes CDC configuradas:

```lua
local sources, err = cdc.list_sources()
if err then return nil, err end
for _, s in ipairs(sources) do
    print(s.name, s.slot, s.streaming)
end
```

Cada fonte é uma tabela com `name`, `slot`, `publication`, `tables`, `streaming`, `failover`, `temporary` e `snapshot`. Consulte [Fontes CDC](../../system/cdc.md#informações-da-fonte).

**Retorna:** `table, error`

## `source`

Obtém uma fonte pelo ID de entry no registry ou pelo nome do slot de replicação:

```lua
local info, err = cdc.source("app:pg_cdc")
if err then return nil, err end
if info == nil then
    -- no such source
end
```

**Retorna:** `table, error` — informações da fonte ou `nil` se não for encontrada

## `stream`

Abre um stream de alterações em uma fonte. O `cdc.Stream` retornado expõe um channel que entrega eventos de alteração:

```lua
local stream, err = cdc.stream("app:pg_cdc", {
    tables = { "public.users", "public.orders" },
    ops    = { "insert", "update" },
    buffer = 128,
})
if err then return nil, err end

-- The caller owns stream until close(), release(), or task cleanup.
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | ID da fonte no registry ou nome do slot de replicação |
| `opts.tables` | []string | Filtra por estas tabelas; omita para todas as tabelas configuradas |
| `opts.ops` | []string | Filtra por `insert`, `update`, `delete`, `truncate` ou `snapshot` |
| `opts.buffer` | int | Tamanho do buffer da assinatura na fonte, de 1 a 65536; padrão 128 |

**Retorna:** `Stream, error`

O channel de entrega Lua tem uma capacidade fixa separada de 64. A opção `buffer` controla a assinatura da fonte PostgreSQL, não esse channel.

## Métodos de Stream

### `channel`

Retorna o channel que recebe eventos de alteração. A primeira chamada assina a fonte e cede a execução; chamadas posteriores retornam o mesmo channel. A primeira chamada pode retornar um erro de assinatura. `:receive()` retorna `value, true` para uma alteração ou `nil, false` quando o stream termina:

```lua
local stream, stream_err = cdc.stream("app:pg_cdc")
if stream_err then return nil, stream_err end
local ch, subscribe_err = stream:channel()
if subscribe_err then
    stream:close()
    return nil, subscribe_err
end

while true do
    local change, ok = ch:receive()
    if not ok then break end

    if change.op == "insert" then
        handle_new_user(change.table, change.after)
    elseif change.op == "update" then
        handle_update(change.table, change.before, change.after)
    elseif change.op == "delete" then
        handle_delete(change.table, change.before)
    end
end

local _, close_err = stream:close()
if close_err then return nil, close_err end
```

`receive` é um alias de `channel`.

### `close`

Interrompe a assinatura e libera o stream. O método é idempotente, e a runtime também fecha o stream ao final do escopo da tarefa. `release` é um alias de `close`.

```lua
local _, err = stream:close()
if err then return nil, err end
```

## Evento de alteração

Cada mensagem recebida no channel é uma tabela de alteração:

| Campo | Descrição |
|-------|-----------|
| `op` | Operação: `insert`, `update`, `delete`, `truncate` ou `snapshot` |
| `schema` | Schema da tabela |
| `table` | Nome da tabela |
| `relation` | `schema.table` |
| `before` | Estado da linha antes da alteração em `update` ou `delete`; ausente em `insert` |
| `after` | Estado da linha depois da alteração em `insert`, `update` ou `snapshot`; ausente em `delete` |
| `source` | Nome da fonte |
| `lsn` | Log sequence number da alteração |
| `commit_lsn` | LSN da transação de commit, quando aplicável |
| `xid` | ID da transação, quando aplicável |

`before` e `after` são mapas de linha indexados pelo nome da coluna.

## Erros

| Condição | Tipo |
|----------|------|
| Sem contexto Lua ao criar um stream | `errors.INTERNAL` |
| Sem PID de processo na primeira assinatura | erro Lua lançado |
| Nome da fonte obrigatório | `errors.INVALID` |
| Tamanho de buffer inválido | `errors.INVALID` |
| Fonte não encontrada na primeira chamada de `channel()` / `receive()` | `errors.NOT_FOUND` |
| Inspetor de fontes indisponível para `list_sources()` / `source()` | `errors.INTERNAL` |
| Binding de processo indisponível após a assinatura | `errors.INTERNAL` |
| Falha na assinatura da fonte na primeira chamada de `channel()` / `receive()` | erro estruturado dependente da fonte |

Consulte [Tratamento de erros](../core/errors.md) para trabalhar com erros.

## Consulte também

- [Change Data Capture](../../system/cdc.md) - Configuração da fonte `db.cdc.postgres`
- [Channel](../core/channel.md) - Semântica de channels
- [Banco de dados](../../system/database.md) - Serviços de banco de dados SQL
