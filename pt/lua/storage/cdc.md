---
title: "CDC"
description: "<secondary-label ref='storage'/ <secondary-label ref='stream'/ <secondary-label ref='nondeterministic'/"
---

# CDC
<secondary-label ref="storage"/>
<secondary-label ref="stream"/>
<secondary-label ref="nondeterministic"/>

Assine streams de Change Data Capture de fontes [`db.cdc.postgres`](system/cdc.md) e [`db.cdc.sqlite`](system/cdc.md). Liste as fontes configuradas, abra um stream e receba eventos de mudança em nível de linha através de um channel. A API é neutra em relação ao driver: ambos os tipos retornam as mesmas informações de fonte e os mesmos eventos de mudança, diferindo apenas nas [capacidades](system/cdc.md#capabilities) que publicam.

## Carregamento

```lua
local cdc = require("cdc")
```

## list_sources

Lista as fontes CDC configuradas que o chamador tem permissão de ver:

```lua
local sources, err = cdc.list_sources()
for _, s in ipairs(sources) do
    print(s.id, s.kind, s.state, s.capabilities.before_images)
end
```

Fontes sobre as quais o chamador não tem `cdc.source` são omitidas em vez de reportadas como erro.

**Retorna:** `table, error`

## source

Obtém uma única fonte pelo nome (seu ID de entrada):

```lua
local info, err = cdc.source("app:pg_cdc")
if info == nil then
    -- fonte inexistente
end
```

**Retorna:** `table, error` (informações da fonte, ou `nil` se não encontrada)

## stream

Abre um stream de mudanças em uma fonte. Retorna um `cdc.Stream` cujo channel entrega eventos de mudança:

```lua
local stream, err = cdc.stream("app:pg_cdc", {
    tables = { "public.users", "public.orders" },
    ops    = { "insert", "update" },
    buffer = 128,
})
```

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|---------|-------------|
| `name` | string | obrigatório | Nome da fonte (ID de entrada) |
| `opts.tables` | []string | - | Filtra para estas tabelas (omita para todas as tabelas capturadas) |
| `opts.ops` | []string | - | Filtra para estas operações: `insert`, `update`, `delete`, `truncate` |
| `opts.buffer` | int | 64 | Capacidade de itens do backlog (1-65536) |
| `opts.max_bytes` | int | 1048576 | Orçamento de bytes de backlog para este assinante (1 MiB) |
| `opts.snapshot` | bool | padrão da entrada | Solicita a entrega snapshot/ao vivo para este stream |
| `opts.after` | string | - | Cursor opaco de retomada, vindo do `cursor` de um evento anterior |

Chaves de opção desconhecidas são rejeitadas com `errors.INVALID`. Nomes de tabelas são comparados sem diferenciar maiúsculas de minúsculas, tanto contra a relação qualificada quanto contra o nome simples da tabela. Linhas de snapshot são filtradas apenas por `tables`; `ops` aplica-se às mudanças ao vivo.

Um stream recebe um snapshot quando `opts.snapshot` é true ou quando o campo `snapshot` da entrada da fonte está definido; as linhas de snapshot chegam primeiro com `op = "snapshot"`, e então o stream continua nas mudanças ao vivo sem lacuna. `opts.after` só é honrado por drivers cuja capacidade `capture_resume` esteja definida — todo driver entregue hoje retorna `errors.INVALID` ("cdc operation is not supported by this source") para ele.

Filtros apenas restringem a entrega. O acesso a uma fonte é concedido pela permissão `cdc.subscribe`, nunca por um filtro.

**Retorna:** `Stream, error`

## Métodos do Stream

### channel

Retorna o channel que recebe eventos de mudança. A primeira chamada assina a fonte (cede a vez); chamadas subsequentes retornam o mesmo channel. `:receive()` bloqueia até a próxima mudança chegar, ou retorna `nil` quando o stream termina:

```lua
local stream = cdc.stream("app:pg_cdc")
local ch = stream:channel()

while true do
    local change = ch:receive()
    if change == nil then break end   -- stream fechado

    if change.op == "snapshot" then
        seed_row(change.table, change.after)
    elseif change.op == "insert" then
        handle_new_user(change.table, change.after)
    elseif change.op == "update" then
        handle_update(change.table, change.before, change.after)
    elseif change.op == "delete" then
        handle_delete(change.table, change.before)
    end
end
```

O stream é preguiçoso: construa-o e então chame `channel()` antes de gerar as escritas que ele deve observar. Isso é observação ao vivo, não reprodução de mudanças feitas antes da assinatura.

Quando uma fonte encerra um stream com falha, o channel entrega um valor de erro antes de fechar. `receive` é um alias para `channel`.

### close

Encerra a assinatura e libera o stream. Idempotente; também fechado automaticamente no escopo da task. `release` é um alias para `close`.

```lua
stream:close()
```

## Evento de Mudança

Cada mensagem recebida no channel é uma tabela de mudança:

| Campo | Descrição |
|-------|-------------|
| `op` | Operação: `insert`, `update`, `delete`, `snapshot` ou `truncate` |
| `schema` | Schema da tabela |
| `table` | Nome da tabela |
| `relation` | Nome qualificado da relação |
| `before` | Estado da linha antes da mudança (`update`, `delete`). Uma imagem completa da linha só é garantida quando a fonte tem a capacidade `before_images`; `db.cdc.postgres` a preenche com a tupla antiga que o WAL carregar, o que é controlado pelo `REPLICA IDENTITY` da tabela |
| `after` | Estado da linha após a mudança (`insert`, `update`, `snapshot`; ausente em `delete`) |
| `source` | ID de entrada da fonte |
| `source_id` | ID de entrada da fonte, como um ID de registro |
| `generation` | Geração da fonte que produziu o evento |
| `cursor` | Posição opaca por evento dentro da fonte |
| `transaction` | Identificador da transação, quando o driver informa um |
| `lsn` | Log sequence number da mudança (`db.cdc.postgres`) |
| `commit_lsn` | LSN da transação que confirmou (quando aplicável) |
| `xid` | ID da transação (quando aplicável) |
| `unchanged` | Colunas cujo valor não foi transmitido (valores TOAST inalterados) |
| `error` | Descrição de erro informada pelo driver, carregada no evento |

`before` e `after` são mapas de linha indexados pelo nome da coluna.

## Informações da Fonte

`cdc.source` e cada item de `cdc.list_sources` retornam o mesmo registro:

| Campo | Descrição |
|-------|-------------|
| `id` | ID da entrada |
| `kind` | `db.cdc.postgres` ou `db.cdc.sqlite` |
| `name` | Nome da fonte (o ID da entrada) |
| `state` | `unknown`, `starting`, `running`, `faulted` ou `stopped` |
| `generation` | Geração atual da fonte |
| `epoch` | Mesmo valor de `generation` |
| `engine` | Nome do engine, quando o driver informa um |
| `db_resource` | ID de entrada do recurso SQL observado (`db.cdc.sqlite`) |
| `slot` | Nome do slot de replicação (`db.cdc.postgres`) |
| `publication` | Publicação do Postgres, quando configurada |
| `tables` | Tabelas capturadas, quando configuradas |
| `streaming` | Se a fonte está atualmente em execução |
| `failover` | Modo de slot de failover (`db.cdc.postgres`) |
| `temporary` | Slot temporário (`db.cdc.postgres`) |
| `snapshot` | Padrão de snapshot no nível da entrada |
| `faulted` | Se a fonte está no estado `faulted` |
| `error` | Último erro da fonte, quando há um registrado |
| `admission` | `active`, `snapshots`, `reserved_bytes`, `rejected` |
| `capabilities` | `snapshot`, `capture_resume`, `replayable`, `captures_external_writes`, `before_images`, `coalesced` |

Ramifique sobre `capabilities` em vez de `kind`:

```lua
local info = cdc.source("app:changes")
if not info.capabilities.before_images then
    -- before não é uma imagem completa garantida da linha; mantenha seu próprio último estado conhecido
end
```

Veja [Fontes CDC](system/cdc.md#source-info) para a semântica dos campos.

## Permissões

| Ação | Recurso | Descrição |
|--------|----------|-------------|
| `cdc.source` | ID de entrada da fonte | `cdc.source`; também filtra `cdc.list_sources` |
| `cdc.subscribe` | ID de entrada da fonte | `cdc.stream`, verificado novamente quando a assinatura é estabelecida |

Uma ação negada retorna `errors.PERMISSION_DENIED`.

## Erros

| Condição | Tipo |
|-----------|------|
| Sem contexto / sem PID de processo | `errors.INTERNAL` |
| Nome da fonte obrigatório | `errors.INVALID` |
| Opção de stream inválida ou desconhecida | `errors.INVALID` |
| `after` em uma fonte sem `capture_resume` | `errors.INVALID` |
| Fonte não registrada | `errors.NOT_FOUND` |
| Fonte não iniciada ou sendo substituída | `errors.UNAVAILABLE` |
| Capacidade de assinaturas esgotada | `errors.UNAVAILABLE` |
| Permissão negada | `errors.PERMISSION_DENIED` |

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.

## Veja Também

- [Change Data Capture](system/cdc.md) - Configuração e capacidades das fontes
- [Channel](lua/core/channel.md) - Semântica de channels
- [Banco de Dados](system/database.md) - Serviços de banco de dados SQL
