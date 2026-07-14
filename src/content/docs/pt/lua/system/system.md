---
title: "System"
---

# System
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Consulte informações do sistema de runtime incluindo uso de memória, estatísticas de garbage collection, detalhes de CPU e metadados de processo.

## Carregamento

```lua
local system = require("system")
```

## Shutdown

Acionar shutdown do sistema com código de saída. Útil para apps de terminal; chamar de actors em execução terminará o sistema inteiro:

```lua
local ok, err = system.exit(0)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `code` | integer | Código de saída (0 = sucesso), padrão 0 |

**Retorna:** `boolean, error`

## Listando Módulos

Obter todos os módulos Lua carregados com metadados:

```lua
local mods, err = system.modules()
```

**Retorna:** `table[], error`

Cada tabela de módulo contém:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `name` | string | Nome do módulo |
| `description` | string | Descrição do módulo |
| `class` | string[] | Tags de classificação do módulo |

## Estatísticas de Memória

Obter estatísticas detalhadas de memória:

```lua
local stats, err = system.memory.stats()
```

**Retorna:** `table, error`

Tabela de stats contém:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `alloc` | number | Bytes alocados e em uso |
| `total_alloc` | number | Bytes cumulativos alocados |
| `sys` | number | Bytes obtidos do sistema |
| `heap_alloc` | number | Bytes alocados no heap |
| `heap_sys` | number | Bytes obtidos para heap do sistema |
| `heap_idle` | number | Bytes em spans ociosos |
| `heap_in_use` | number | Bytes em spans não-ociosos |
| `heap_released` | number | Bytes liberados para o OS |
| `heap_objects` | number | Número de objetos heap alocados |
| `stack_in_use` | number | Bytes usados pelo alocador de stack |
| `stack_sys` | number | Bytes obtidos para stack do sistema |
| `mspan_in_use` | number | Bytes de estruturas mspan em uso |
| `mspan_sys` | number | Bytes obtidos para mspan do sistema |
| `num_gc` | number | Número de ciclos GC completados |
| `next_gc` | number | Tamanho alvo do heap para próximo GC |

## Alocação Atual

Obter bytes atualmente alocados:

```lua
local bytes, err = system.memory.allocated()
```

**Retorna:** `number, error`

## Objetos Heap

Obter número de objetos heap alocados:

```lua
local count, err = system.memory.heap_objects()
```

**Retorna:** `number, error`

## Limite de Memória

Definir limite de memória (retorna valor anterior):

```lua
local prev, err = system.memory.set_limit(1024 * 1024 * 100)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `limit` | integer | Limite de memória em bytes, -1 para ilimitado |

**Retorna:** `number, error`

Obter limite de memória atual:

```lua
local limit, err = system.memory.get_limit()
```

**Retorna:** `number, error`

## Forçar GC

Forçar garbage collection:

```lua
local ok, err = system.gc.collect()
```

**Retorna:** `boolean, error`

## Percentual Alvo de GC

Definir percentual alvo de GC (retorna valor anterior). Um valor de 100 significa GC dispara quando heap dobra:

```lua
local prev, err = system.gc.set_percent(200)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `percent` | integer | Percentual alvo de GC |

**Retorna:** `number, error`

Obter percentual alvo de GC atual:

```lua
local percent, err = system.gc.get_percent()
```

**Retorna:** `number, error`

## Contagem de Goroutines

Obter número de goroutines ativas:

```lua
local count, err = system.runtime.goroutines()
```

**Retorna:** `number, error`

## GOMAXPROCS

Obter ou definir valor GOMAXPROCS:

```lua
-- Obter valor atual
local current, err = system.runtime.max_procs()

-- Definir novo valor
local prev, err = system.runtime.max_procs(4)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `n` | integer | Se fornecido, define GOMAXPROCS (deve ser > 0) |

**Retorna:** `number, error`

## Contagem de CPUs

Obter número de CPUs lógicas:

```lua
local cpus, err = system.runtime.cpu_count()
```

**Retorna:** `number, error`

## ID do Processo

Obter ID do processo atual:

```lua
local pid, err = system.process.pid()
```

**Retorna:** `number, error`

## Hostname

Obter hostname do sistema:

```lua
local hostname, err = system.process.hostname()
```

**Retorna:** `string, error`

## Diretório de Trabalho

Obter o diretório de trabalho atual do runtime:

```lua
local dir, err = system.process.cwd()
```

**Retorna:** `string, error`

## Hosts de Processo

Listar todos os hosts de processo com estatísticas de workers e fila:

```lua
local hosts, err = system.hosts.list()
```

**Retorna:** `table[], error`

Cada tabela de host contém:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | ID de registro do host |
| `workers` | number | Tamanho do pool de workers |
| `processes` | number | Processos ativos neste host |
| `executed` | number | Total de passos executados |
| `stolen` | number | Passos roubados de outros hosts |
| `queue_depth` | number | Itens pendentes na fila do host |

Listar processos rodando em um host específico:

```lua
local procs, err = system.hosts.processes("app:host")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `host_id` | string | ID de registro do host |

**Retorna:** `table[], error`

Cada tabela de processo contém:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `pid` | string | ID do processo |
| `host` | string | ID do host |
| `source` | string | ID da entrada fonte |
| `state` | string | Estado do processo |
| `steps` | number | Passos executados |
| `started_at` | number | Timestamp de início (nanossegundos) |
| `parent` | string | PID pai (omitido se não houver) |
| `actor_id` | string | ID do actor (omitido se não houver) |
| `stats` | table | Estatísticas específicas do processo (opcional) |

## Estado do Serviço

Obter estado para um serviço supervisionado específico:

```lua
local state, err = system.supervisor.state("namespace:service")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `service_id` | string | ID do serviço (ex: "namespace:service") |

**Retorna:** `table, error`

Tabela de estado contém:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | ID do serviço |
| `status` | string | Status atual |
| `desired` | string | Status desejado |
| `retry_count` | number | Número de retries |
| `last_update` | number | Timestamp da última atualização (nanossegundos) |
| `started_at` | number | Timestamp de início (nanossegundos) |
| `details` | string | Detalhes opcionais (formatados) |

## Todos os Estados de Serviço

Obter estados para todos os serviços supervisionados:

```lua
local states, err = system.supervisor.states()
```

**Retorna:** `table[], error`

Cada tabela de estado tem o mesmo formato que `system.supervisor.state()`.

## Primitivos de Cluster

As sub-tabelas `system.node`, `system.cluster`, `system.raft` e `system.lock` expõem a camada de clustering. São mais úteis quando o [clustering está habilitado](guides/cluster.md); em um nó standalone elas degradam de forma previsível — `system.raft.*` reporta "raft not available", `system.cluster` reporta apenas o nó local e `system.lock` requer o registro global que o clustering fornece.

Todas as chamadas de leitura são locais e baratas: reportam a visão deste nó do estado confirmado, sem bloquear na rede.

### Identidade do nó

`system.node` reporta a identidade própria deste nó no cluster.

```lua
local id, err = system.node.id()      -- ID deste nó
local addr, err = system.node.addr()  -- endereço de rede anunciado
local role, err = system.node.role()  -- "leader" | "voter" | "standby" | "non-member"
```

| Função | Retorna | Notas |
|--------|---------|-------|
| `system.node.id()` | `string, error` | ID do nó a partir do contexto de relay |
| `system.node.addr()` | `string, error` | Endereço anunciado (ex: `10.0.0.1:7946`); erro se associação estiver indisponível |
| `system.node.role()` | `string, error` | Papel Raft deste nó; retorna `"non-member"` (sem erro) quando Raft não está em execução |

**Permissão:** `system.read` em `node`.

### Associação do cluster

`system.cluster` reporta a visão em todo o cluster: quem são os membros e quem lidera.

```lua
local members, err = system.cluster.members()  -- array de tabelas de nó
local leader, err = system.cluster.leader()    -- ID do nó leader, ou "" se desconhecido
local n, err = system.cluster.size()           -- contagem de membros visíveis
```

`system.cluster.members()` retorna um array de tabelas de nó. O nó local é incluído uma vez e ordena primeiro.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | ID do nó |
| `is_local` | boolean | True para o nó chamador |
| `addr` | string | Endereço anunciado (omitido quando desconhecido) |
| `meta` | table | Metadados gossip string-para-string (omitido quando nenhum) |

| Função | Retorna | Notas |
|--------|---------|-------|
| `system.cluster.members()` | `table[], error` | Erro se nenhuma informação de associação estiver acessível |
| `system.cluster.leader()` | `string, error` | ID do leader Raft atual; `""` (sem erro) quando o leader é desconhecido ou Raft está ausente |
| `system.cluster.size()` | `number, error` | Contagem de membros visíveis; `0` quando nenhuma informação de associação está disponível |

**Permissão:** `system.read` em `cluster`.

### Estado do Raft

`system.raft` lê a visão local deste nó do núcleo de consenso Raft. Toda função retorna `nil, error` ("raft not available") quando Raft não está em execução neste nó.

```lua
local leader, err = system.raft.is_leader()      -- boolean
local member, err = system.raft.is_member()      -- boolean: voter ou standby
local role, err = system.raft.role()             -- mesmos valores que system.node.role()
local term, err = system.raft.term()             -- termo Raft atual
local idx, err = system.raft.commit_index()      -- índice de log confirmado mais alto
local stats, err = system.raft.stats()           -- mapa de stats bruto (string -> string)
```

| Função | Retorna | Notas |
|--------|---------|-------|
| `system.raft.is_leader()` | `boolean, error` | True se e somente se este nó é o leader atual |
| `system.raft.is_member()` | `boolean, error` | True se este nó é voter ou standby na configuração confirmada |
| `system.raft.role()` | `string, error` | `"leader"` / `"voter"` / `"standby"` / `"non-member"` |
| `system.raft.term()` | `number, error` | Termo atual; `0` se indisponível a partir das stats |
| `system.raft.commit_index()` | `number, error` | Índice de log confirmado mais alto neste nó |
| `system.raft.stats()` | `table, error` | Mapa de stats bruto completo; chaves e valores são strings |

**Permissão:** `system.read` em `raft`, exceto `system.raft.stats()` que requer `system.read` em `raft_stats`.

### Locks distribuídos

`system.lock` fornece exclusão mútua em todo o cluster. Um lock é um nome globalmente único de propriedade do processo chamador. É construído sobre o escopo Strong de nomes, portanto no máximo um detentor pode existir em todo o cluster, e o lock é liberado automaticamente quando o processo detentor sai ou seu nó parte — não há lock preso para limpar.

```lua
local ok, err = system.lock.acquire("orders.migration")
if ok then
  -- seção crítica: apenas um detentor em todo o cluster
  system.lock.release("orders.migration")
end
```

A aquisição é fail-fast: se o lock já está mantido, retorna `false` imediatamente em vez de bloquear, portanto os chamadores implementam seu próprio retry e backoff. Apenas o detentor atual pode liberar; liberar um lock que você não detém é uma operação segura sem efeito.

| Função | Retorna | Resultados |
|--------|---------|------------|
| `system.lock.acquire(name)` | `boolean, error` | `true, nil` adquirido; `false, error` já mantido (tipo `errors.ALREADY_EXISTS`); `nil, error` em falha |
| `system.lock.release(name)` | `boolean, error` | `true, nil` liberado; `false, nil` não mantido ou mantido por outro processo; `nil, error` em falha |

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome do lock em todo o cluster |

**Permissão:** `system.lock` no `name` do lock (para que a política possa restringir quais nomes um chamador pode bloquear).

## Permissões

Operações de sistema estão sujeitas a avaliação de política de segurança.

| Ação | Recurso | Descrição |
|------|---------|-----------|
| `system.read` | `memory` | Ler estatísticas de memória |
| `system.read` | `memory_limit` | Ler limite de memória |
| `system.control` | `memory_limit` | Definir limite de memória |
| `system.read` | `gc_percent` | Ler percentual de GC |
| `system.gc` | `gc` | Forçar garbage collection |
| `system.gc` | `gc_percent` | Definir percentual de GC |
| `system.read` | `goroutines` | Ler contagem de goroutines |
| `system.read` | `gomaxprocs` | Ler GOMAXPROCS |
| `system.control` | `gomaxprocs` | Definir GOMAXPROCS |
| `system.read` | `cpu` | Ler contagem de CPUs |
| `system.read` | `pid` | Ler ID do processo |
| `system.read` | `hostname` | Ler hostname |
| `system.read` | `cwd` | Ler diretório de trabalho |
| `system.read` | `hosts` | Listar hosts / processos de host |
| `system.read` | `modules` | Listar módulos carregados |
| `system.read` | `supervisor` | Ler estado do supervisor |
| `system.read` | `node` | Ler identidade deste nó |
| `system.read` | `cluster` | Ler associação e leader do cluster |
| `system.read` | `raft` | Ler estado do Raft |
| `system.read` | `raft_stats` | Ler o mapa de stats bruto do Raft |
| `system.lock` | `<nome do lock>` | Adquirir ou liberar um lock distribuído |
| `system.exit` | - | Acionar shutdown do sistema |

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Permissão negada | `errors.INVALID` | não |
| Argumento inválido | `errors.INVALID` | não |
| Argumento obrigatório ausente | `errors.INVALID` | não |
| Code manager indisponível | `errors.INTERNAL` | não |
| Info de serviço indisponível | `errors.INTERNAL` | não |
| Erro de OS (hostname, cwd) | `errors.INTERNAL` | não |
| Raft não está em execução neste nó | `errors.INTERNAL` | não |
| Associação indisponível | `errors.INTERNAL` | não |
| Lock já mantido | `errors.ALREADY_EXISTS` | não |

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.
