# System
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Consulte informacoes do sistema de runtime incluindo uso de memoria, estatisticas de garbage collection, detalhes de CPU e metadados de processo.

## Carregamento

```lua
local system = require("system")
```

## Shutdown

Acionar shutdown do sistema com codigo de saida. Util para apps de terminal; chamar de actors em execucao terminara o sistema inteiro:

```lua
local ok, err = system.exit(0)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `code` | integer | Codigo de saida (0 = sucesso), padrao 0 |

**Retorna:** `boolean, error`

## Listando Modulos

Obter todos os modulos Lua carregados com metadados:

```lua
local mods, err = system.modules()
```

**Retorna:** `table[], error`

Cada tabela de modulo contem:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `name` | string | Nome do modulo |
| `description` | string | Descricao do modulo |
| `class` | string[] | Tags de classificacao do modulo |

## Estatisticas de Memoria

Obter estatisticas detalhadas de memoria:

```lua
local stats, err = system.memory.stats()
```

**Retorna:** `table, error`

Tabela de stats contem:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `alloc` | number | Bytes alocados e em uso |
| `total_alloc` | number | Bytes cumulativos alocados |
| `sys` | number | Bytes obtidos do sistema |
| `heap_alloc` | number | Bytes alocados no heap |
| `heap_sys` | number | Bytes obtidos para heap do sistema |
| `heap_idle` | number | Bytes em spans ociosos |
| `heap_in_use` | number | Bytes em spans nao-ociosos |
| `heap_released` | number | Bytes liberados para o OS |
| `heap_objects` | number | Numero de objetos heap alocados |
| `stack_in_use` | number | Bytes usados pelo alocador de stack |
| `stack_sys` | number | Bytes obtidos para stack do sistema |
| `mspan_in_use` | number | Bytes de estruturas mspan em uso |
| `mspan_sys` | number | Bytes obtidos para mspan do sistema |
| `num_gc` | number | Numero de ciclos GC completados |
| `next_gc` | number | Tamanho alvo do heap para proximo GC |

## Alocacao Atual

Obter bytes atualmente alocados:

```lua
local bytes, err = system.memory.allocated()
```

**Retorna:** `number, error`

## Objetos Heap

Obter numero de objetos heap alocados:

```lua
local count, err = system.memory.heap_objects()
```

**Retorna:** `number, error`

## Limite de Memoria

Definir limite de memoria (retorna valor anterior):

```lua
local prev, err = system.memory.set_limit(1024 * 1024 * 100)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `limit` | integer | Limite de memoria em bytes, -1 para ilimitado |

**Retorna:** `number, error`

Obter limite de memoria atual:

```lua
local limit, err = system.memory.get_limit()
```

**Retorna:** `number, error`

## Forcar GC

Forcar garbage collection:

```lua
local ok, err = system.gc.collect()
```

**Retorna:** `boolean, error`

## Percentual Alvo de GC

Definir percentual alvo de GC (retorna valor anterior). Um valor de 100 significa GC dispara quando heap dobra:

```lua
local prev, err = system.gc.set_percent(200)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `percent` | integer | Percentual alvo de GC |

**Retorna:** `number, error`

Obter percentual alvo de GC atual:

```lua
local percent, err = system.gc.get_percent()
```

**Retorna:** `number, error`

## Contagem de Goroutines

Obter numero de goroutines ativas:

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

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `n` | integer | Se fornecido, define GOMAXPROCS (deve ser > 0) |

**Retorna:** `number, error`

## Contagem de CPUs

Obter numero de CPUs logicas:

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

## Estado do Servico

Obter estado para um servico supervisionado especifico:

```lua
local state, err = system.supervisor.state("namespace:service")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `service_id` | string | ID do servico (ex: "namespace:service") |

**Retorna:** `table, error`

Tabela de estado contem:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | string | ID do servico |
| `status` | string | Status atual |
| `desired` | string | Status desejado |
| `retry_count` | number | Numero de retries |
| `last_update` | number | Timestamp da ultima atualizacao (nanossegundos) |
| `started_at` | number | Timestamp de inicio (nanossegundos) |
| `details` | string | Detalhes opcionais (formatados) |

## Todos os Estados de Servico

Obter estados para todos os servicos supervisionados:

```lua
local states, err = system.supervisor.states()
```

**Retorna:** `table[], error`

Cada tabela de estado tem o mesmo formato que `system.supervisor.state()`.

## Permissoes

Operacoes de sistema estao sujeitas a avaliacao de politica de seguranca.

| Acao | Recurso | Descricao |
|------|---------|-----------|
| `system.read` | `memory` | Ler estatisticas de memoria |
| `system.read` | `memory_limit` | Ler limite de memoria |
| `system.control` | `memory_limit` | Definir limite de memoria |
| `system.read` | `gc_percent` | Ler percentual de GC |
| `system.gc` | `gc` | Forcar garbage collection |
| `system.gc` | `gc_percent` | Definir percentual de GC |
| `system.read` | `goroutines` | Ler contagem de goroutines |
| `system.read` | `gomaxprocs` | Ler GOMAXPROCS |
| `system.control` | `gomaxprocs` | Definir GOMAXPROCS |
| `system.read` | `cpu` | Ler contagem de CPUs |
| `system.read` | `pid` | Ler ID do processo |
| `system.read` | `hostname` | Ler hostname |
| `system.read` | `modules` | Listar modulos carregados |
| `system.read` | `supervisor` | Ler estado do supervisor |
| `system.exit` | - | Acionar shutdown do sistema |

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| Permissao negada | `errors.PERMISSION_DENIED` | nao |
| Argumento invalido | `errors.INVALID` | nao |
| Argumento obrigatorio ausente | `errors.INVALID` | nao |
| Code manager indisponivel | `errors.INTERNAL` | nao |
| Info de servico indisponivel | `errors.INTERNAL` | nao |
| Erro de OS obtendo hostname | `errors.INTERNAL` | nao |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
