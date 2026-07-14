---
title: "Grupos de Processos"
---

# Grupos de Processos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Agrupe processos em grupos nomeados e faça broadcast para todos os membros em todo o cluster. Modelado no `pg` do Erlang/OTP: grupos são dinâmicos, um processo pode pertencer a muitos grupos e a associação é rastreada em todo o cluster e é eventualmente consistente.

Para o tipo de entrada de escopo e sua configuração, veja [Grupos de Processos](system/process-groups.md). Para o modelo de clustering mais amplo, veja o [Guia de Cluster](guides/cluster.md).

## Carregamento

```lua
local pg = require("pg")
```

## Abrindo um Escopo

Um grupo de processos vive dentro de um **escopo** — uma entrada de registro `pg.scope`. Abra-o para obter uma instância sobre a qual você opera:

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

A instância é liberada automaticamente quando o processo sai; chame `release()` para liberá-la antes. Todas as outras operações são métodos na instância, chamados com `:`.

## Entrando e Saindo

```lua
local ok, err = group:join("workers")           -- grupo único
local ok, err = group:join({"workers", "all"})  -- lote
local ok, err = group:leave("workers")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `group` | string \| string[] | Nome do grupo, ou lista de nomes para operação em lote |

**Retorna:** `boolean, error`

Um processo pode entrar no mesmo grupo mais de uma vez; deve sair o mesmo número de vezes para partir completamente (semântica multi-join). `leave` é best-effort em um lote e retorna erro apenas quando o processo não era membro de nenhum dos grupos nomeados.

**Permissões:** `pg.join` / `pg.leave` em cada nome de grupo

## Listando Membros

```lua
local members, err = group:get_members("workers")        -- todos os nós
local local_members, err = group:get_local_members("workers")  -- apenas este nó
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `group` | string | Nome do grupo |

**Retorna:** `string[], error` — array de strings PID (vazio para grupo desconhecido)

**Permissões:** `pg.get_members` / `pg.get_local_members` no nome do grupo

## Listando Grupos

```lua
local groups, err = group:which_groups()         -- todos os grupos no cluster
local local_groups, err = group:which_local_groups()  -- grupos com membro local
```

**Retorna:** `string[], error` — nomes de grupos que atualmente têm pelo menos um membro

**Permissões:** `pg.which_groups` / `pg.which_local_groups`

## Broadcast

Envia uma mensagem para todos os membros de um grupo. Cada membro a recebe sob `topic` do processo chamador — trate com `process.listen(topic)`.

```lua
local ok, err = group:broadcast("workers", "task", {id = 42})   -- todos os nós
local ok, err = group:broadcast_local("workers", "task", {id = 42})  -- apenas este nó
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `group` | string | Grupo alvo |
| `topic` | string | Tópico da mensagem |
| `...` | any | Zero ou mais valores de payload |

**Retorna:** `boolean, error`

**Permissões:** `pg.broadcast` / `pg.broadcast_local` no nome do grupo

## Monitorando um Grupo

`monitor` inscreve-se em eventos de entrada/saída para um grupo e retorna os membros atuais atomicamente — nenhuma mudança de associação pode ocorrer entre o snapshot e a inscrição.

```lua
local sub, members, err = group:monitor("workers")
if err then
    return nil, err
end

for _, pid in ipairs(members) do
    -- membros atuais no momento da inscrição
end

local ch = sub:channel()
local event = ch:receive()  -- {kind = "member.joined" | "member.left", path = "workers", data = {...}}

sub:close()  -- cancelar inscrição; sub:close({flush = true}) drena eventos enfileirados primeiro
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `group` | string | Grupo a observar |

**Retorna:** `pg.Subscription, string[], error` — a inscrição e um snapshot dos membros atuais

**Permissão:** `pg.monitor` no nome do grupo

## Observando Todos os Grupos

`events` inscreve-se em mudanças de associação em todos os grupos do escopo e retorna um snapshot de todos os grupos com seus membros.

```lua
local sub, snapshot, err = group:events()
-- snapshot: { ["workers"] = {pid, ...}, ["all"] = {pid, ...} }

local event = sub:channel():receive()
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

Libera a instância imediatamente. Idempotente; após a liberação, cada método retorna um erro. A limpeza também ocorre automaticamente quando o processo sai.

**Retorna:** `boolean`

## Permissões

| Permissão | Método | Recurso |
|-----------|--------|---------|
| `pg.open` | `pg.open()` | id do escopo |
| `pg.join` | `join()` | nome do grupo |
| `pg.leave` | `leave()` | nome do grupo |
| `pg.get_members` | `get_members()` | nome do grupo |
| `pg.get_local_members` | `get_local_members()` | nome do grupo |
| `pg.which_groups` | `which_groups()` | (escopo) |
| `pg.which_local_groups` | `which_local_groups()` | (escopo) |
| `pg.broadcast` | `broadcast()` | nome do grupo |
| `pg.broadcast_local` | `broadcast_local()` | nome do grupo |
| `pg.monitor` | `monitor()` | nome do grupo |
| `pg.events` | `events()` | (escopo) |

## Erros

| Condição | Tipo |
|----------|------|
| Permissão negada | `errors.PERMISSION_DENIED` |
| Argumento ausente ou vazio | `errors.INVALID` |
| Escopo não encontrado | `errors.NOT_FOUND` |
| Sair de um grupo sem associação | `errors.INVALID` |
| Instância liberada | `errors.INVALID` |

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.

## Veja Também

- [Grupos de Processos](system/process-groups.md) - Tipo de entrada de escopo e configuração
- [Cluster](guides/cluster.md) - Associação e o modelo de clustering
- [Gerenciamento de Processos](lua/core/process.md) - Criando e enviando mensagens para processos individuais
