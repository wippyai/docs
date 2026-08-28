---
title: "Grupos de Processos"
description: "Gerencie grupos de processos no cluster, associações, broadcasts e inscrições em alterações de membros."
---

# Grupos de Processos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Os grupos de processos organizam processos sob nomes dinâmicos e transmitem mensagens aos membros do grupo em todo o cluster. Um processo pode participar de vários grupos, e a associação no cluster é eventualmente consistente.

Esta página é uma referência de API. Seus trechos pressupõem um `pg.scope` existente, uma entrada executável com contexto de processo e políticas que autorizem as operações documentadas. Os blocos demonstram chamadas individuais ou fluxos parciais de inscrição, não uma aplicação independente.

Para o tipo de entrada de escopo e sua configuração, veja [Grupos de Processos](system/process-groups.md). Para o modelo de clustering mais amplo, veja o [Guia de Cluster](guides/cluster.md).

## Carregamento

```lua
local pg = require("pg")
```

Adicione `pg` à lista `modules:` da entrada executável antes de carregá-lo.

## Abrindo um Escopo

Um grupo de processos pertence a um **escopo**, representado por uma entrada de registro `pg.scope`. Abra o escopo para obter uma instância para as operações do grupo:

```lua
local group, err = pg.open("app:pg")
if err then
    return nil, err
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID da entrada de escopo (formato: `"namespace:name"`) |

**Retorna:** `pg.Instance, error`

**Permissão:** `pg.open` no `id` do escopo

A instância é liberada automaticamente durante a limpeza do frame de execução. Chame `release()` para liberá-la antes. As demais operações são métodos da instância e usam a sintaxe `:`.

## Entrando e Saindo

As chamadas abaixo são formas independentes: escolha a associação a um único grupo ou em lote necessária para a aplicação e combine-a com as operações de saída correspondentes.

```lua
local ok, err = group:join("workers")           -- single group
if err then return nil, err end
```

```lua
local ok, err = group:join({"workers", "all"})  -- batch
if err then return nil, err end
```

```lua
local ok, err = group:leave("workers")
if err then return nil, err end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `group` | string \| string[] | Nome do grupo, ou lista de nomes para operação em lote |

**Retorna:** `boolean, error`

Um processo pode entrar no mesmo grupo mais de uma vez e deve sair o mesmo número de vezes para deixá-lo por completo. Em um lote, `leave` é best-effort e só retorna erro quando o processo não era membro de nenhum dos grupos informados.

**Permissões:** `pg.join` / `pg.leave` em cada nome de grupo

## Listando Membros

```lua
local members, err = group:get_members("workers")        -- all nodes
if err then return nil, err end

local local_members, err = group:get_local_members("workers")  -- this node only
if err then return nil, err end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `group` | string | Nome do grupo |

**Retorna:** `string[], error` — array de strings PID (vazio para grupo desconhecido)

**Permissões:** `pg.get_members` / `pg.get_local_members` no nome do grupo

## Listando Grupos

```lua
local groups, err = group:which_groups()         -- all groups in the cluster
if err then return nil, err end

local local_groups, err = group:which_local_groups()  -- groups with a local member
if err then return nil, err end
```

**Retorna:** `string[], error` — nomes de grupos que atualmente têm pelo menos um membro

**Permissões:** `pg.which_groups` / `pg.which_local_groups`

## Broadcast

O broadcast envia uma mensagem do processo chamador para todos os membros do grupo sob `topic`. Os membros a recebem com `process.listen(topic)`.

```lua
local ok, err = group:broadcast("workers", "task", {id = 42})   -- all nodes
if err then return nil, err end

ok, err = group:broadcast_local("workers", "task", {id = 42})  -- this node only
if err then return nil, err end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `group` | string | Grupo alvo |
| `topic` | string | Tópico da mensagem |
| `...` | any | Zero ou mais valores de payload |

**Retorna:** `boolean, error`

**Permissões:** `pg.broadcast` / `pg.broadcast_local` no nome do grupo

## Monitorando um Grupo

`monitor` assina eventos de entrada e saída de um grupo e retorna um snapshot atômico dos membros atuais. Nenhuma alteração de associação pode ocorrer entre o snapshot e a criação da inscrição sem ser observada.

```lua
local sub, members, err = group:monitor("workers")
if err then
    return nil, err
end

for _, pid in ipairs(members) do
    -- current members at subscription time
end

local ch = sub:channel()
local event, open = ch:receive()  -- {kind = "member.joined" | "member.left", path = "workers", data = {...}}
if not open then
    return nil, errors.new("Process-group subscription closed")
end

sub:close()  -- unsubscribe; sub:close({flush = true}) drains queued events first
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `group` | string | Grupo a observar |

**Retorna:** `pg.Subscription, string[], error` — a inscrição e um snapshot dos membros atuais

**Permissão:** `pg.monitor` no nome do grupo

## Observando Todos os Grupos

`events` assina mudanças de associação em todos os grupos do escopo e retorna um snapshot que mapeia os grupos para seus membros.

```lua
local sub, snapshot, err = group:events()
if err then
    return nil, err
end
-- snapshot: { ["workers"] = {pid, ...}, ["all"] = {pid, ...} }

local event, open = sub:channel():receive()
if not open then
    return nil, errors.new("Process-group subscription closed")
end
sub:close()
```

**Retorna:** `pg.Subscription, table, error`

**Permissão:** `pg.events`

### Campos de Evento

Eventos entregues em um channel de inscrição contêm:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `system` | string | Sempre `"pg"` |
| `kind` | string | `"member.joined"` ou `"member.left"` |
| `path` | string | O nome do grupo |
| `data` | table | `{Group = string, PIDs = string[]}` — os membros afetados |

Channels de inscrição têm buffer (capacidade 64); se um consumidor lento encher o buffer, eventos adicionais para essa inscrição são descartados.

## Liberando

```lua
group:release()
```

`release` libera a instância imediatamente e é idempotente. Após a liberação, todas as outras operações do grupo retornam erro. A limpeza também é executada automaticamente ao fim do frame de execução.

**Retorna:** `boolean`

## Permissões

| Permissão | Método | Recurso |
|-----------|--------|---------|
| `pg.open` | `pg.open()` | id do escopo |
| `pg.join` | `join()` | nome do grupo |
| `pg.leave` | `leave()` | nome do grupo |
| `pg.get_members` | `get_members()` | nome do grupo |
| `pg.get_local_members` | `get_local_members()` | nome do grupo |
| `pg.which_groups` | `which_groups()` | - |
| `pg.which_local_groups` | `which_local_groups()` | - |
| `pg.broadcast` | `broadcast()` | nome do grupo |
| `pg.broadcast_local` | `broadcast_local()` | nome do grupo |
| `pg.monitor` | `monitor()` | nome do grupo |
| `pg.events` | `events()` | - |

## Erros

| Condição | Tipo |
|----------|------|
| Permissão negada | `errors.PERMISSION_DENIED` |
| Argumento ausente ou vazio | `errors.INVALID` |
| Escopo não encontrado | `errors.INTERNAL` |
| Sair de um grupo sem associação | `errors.NOT_FOUND` |
| Instância liberada | `errors.INVALID` |
| Limite de grupos/membros ou da fila de ações atingido | `errors.RATE_LIMITED` (retentável) |
| Serviço interrompido, backpressure ou circuito aberto | `errors.UNAVAILABLE` |
| Timeout no broadcast | `errors.TIMEOUT` (retentável) |

Veja [Tratamento de Erros](lua/core/errors.md) para trabalhar com erros.

## Veja Também

- [Grupos de Processos](system/process-groups.md) - Tipo de entrada de escopo e configuração
- [Cluster](guides/cluster.md) - Associação, nomes e modelo de clustering
- [Gerenciamento de Processos](lua/core/process.md) - Criação de processos individuais e envio de mensagens
