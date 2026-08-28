---
title: "Gerenciamento de Processos"
description: "Crie, monitore, vincule, envie mensagens, nomeie e atualize processos do Wippy."
---

# Gerenciamento de Processos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

O global `process` fornece criação de processos, mensagens, monitoramento, vínculos, nomes e controle do ciclo de vida.

Ele está disponível sem `require()` e não precisa ser listado em `modules:`.

Esta página é uma referência de API. Seus blocos de formas de chamada usam placeholders como `id`, `host`, `destination`, `topic` e `name` para valores fornecidos pelo código da aplicação; não são programas independentes. As chamadas mostradas com um resultado `err` retornam o valor documentado em caso de sucesso ou um sentinela de falha mais `error`; o sentinela normalmente é `nil`, enquanto `process.set_options` retorna `false`. O fluxo de controle da aplicação deve tratar o erro.

## Informações do Processo

Obter o ID do frame atual ou ID do processo:

```lua
local frame_id, err = process.id()  -- Registry ID of the current function, process, or workflow definition
if err then return nil, err end

local pid, err = process.pid()      -- Process ID
if err then return nil, err end
```

## Enviando Mensagens

Enviar mensagem(s) para um processo por PID ou nome registrado:

```lua
local ok, err = process.send(destination, topic, ...)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `destination` | string | PID ou nome registrado |
| `topic` | string | Nome do tópico (não pode começar com `@`) |
| `...` | any | Valores do payload |

**Permissão:** `process.send` no PID de destino

## Criando Processos

```lua
-- Basic spawn
local pid, err = process.spawn(id, host, ...)

-- With monitoring (receive EXIT events)
local pid, err = process.spawn_monitored(id, host, ...)

-- With linking (receive LINK_DOWN on abnormal exit)
local pid, err = process.spawn_linked(id, host, ...)

-- Both linked and monitored
local pid, err = process.spawn_linked_monitored(id, host, ...)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID fonte do processo (ex: `"app.workers:handler"`) |
| `host` | string | ID do host (ex: `"app:processes"`) |
| `...` | any | Argumentos passados para o processo criado |

Todas as variantes exigem `process.spawn` no ID do processo. As variantes monitoradas também exigem `process.spawn.monitored`, e as variantes vinculadas exigem `process.spawn.linked`. No runtime v0.3.32a, apenas o `spawn()` no nível do módulo verifica `process.host` no ID do host; as variantes especializadas no nível do módulo não fazem essa verificação de permissão do host.

## Controle de Processo

```lua
-- Forcefully terminate a process
local ok, err = process.terminate(destination)

-- Request graceful cancellation with an optional reason
local ok, err = process.cancel(destination, "shutting down")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `destination` | string | PID ou nome registrado |
| `reason` | string | Motivo opcional entregue ao alvo |

**Permissões:** `process.terminate`, `process.cancel` no PID de destino

## Monitoramento e Link

Monitorar ou linkar a um processo existente:

```lua
-- Monitoring: receive EXIT events when target exits
local ok, err = process.monitor(destination)
local ok, err = process.unmonitor(destination)

-- Linking: bidirectional, receive LINK_DOWN on abnormal exit
local ok, err = process.link(destination)
local ok, err = process.unlink(destination)
```

**Permissões:** `process.monitor`, `process.unmonitor`, `process.link`, `process.unlink` no PID de destino

## Opções do Processo

```lua
local options = process.get_options()
local ok, err = process.set_options({trap_links = true})
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `trap_links` | boolean | Se eventos LINK_DOWN são entregues ao channel de eventos |
| `upgradable` | boolean | Opta por receber eventos OUTDATED quando o código do processo é invalidado |

## Inbox e Eventos

Obter channels para receber mensagens e eventos de ciclo de vida:

```lua
local inbox = process.inbox()    -- Message objects from @inbox topic
local events = process.events()  -- Lifecycle events from @events topic
```

### Tipos de Evento

| Constante | Descrição |
|-----------|-----------|
| `process.event.CANCEL` | Cancelamento solicitado |
| `process.event.EXIT` | Processo monitorado saiu |
| `process.event.LINK_DOWN` | Processo linked terminou anormalmente |
| `process.event.OUTDATED` | O código do processo ou uma dependência importada mudou no registro |

### Campos de Evento

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `kind` | string | Constante de tipo de evento |
| `from` | string | PID de origem |
| `result` | table | Para EXIT/LINK_DOWN: registro {value, error}; o valor retornado pelo processo fica em `result.value` e qualquer erro em `result.error` |
| `reason` | string | Para CANCEL: motivo pelo qual o processo está sendo cancelado |
| `sources` | string[] | Para OUTDATED: IDs de registro que mudaram ou foram afetados transitivamente |

`OUTDATED` é entregue apenas aos processos que optam por recebê-lo com `process.set_options({upgradable = true})`. Múltiplas invalidações são combinadas em um único evento pendente com a união de `sources`. Trate o evento chamando [`process.upgrade`](#upgrade-de-processo).

## Inscrição em Tópico

Inscrever-se em tópicos customizados:

```lua
local ch, err = process.listen(topic, options)
if err then return nil, err end

local ok, err = process.unlisten(ch)
if err then return nil, err end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `topic` | string | Nome do tópico (não pode começar com `@`) |
| `options.message` | boolean | Se true, recebe objetos Message; se false, payloads raw |

## Objetos Message

Ao receber do inbox ou com `{message = true}`:

```lua
local msg = inbox:receive()

msg:topic()            -- string: topic name
msg:from()             -- string|nil: sender PID
msg:payload()          -- Payload: wrapper (call :data() to extract)
msg:payload():data()   -- any: actual payload value
```

## Chamada Síncrona

Criar um processo, aguardar seu resultado e retornar:

```lua
local result, err = process.exec(id, host, ...)
```

**Permissões:** `process.exec` no id do processo, `process.host` no id do host

## Upgrade de Processo

Atualize o processo atual preservando seu PID:

Os dois trechos abaixo são formas alternativas de chamada, não operações sequenciais.

```lua
-- Upgrade to new version, passing state
process.upgrade(id, ...)
```

```lua
-- Keep same definition, re-run with new state
process.upgrade(nil, preserved_state)
```

`process.upgrade` é uma transferência de controle terminal: ele limpa a execução atual e inicia a definição solicitada com o mesmo PID. O código depois da chamada não é executado na execução antiga.

## Spawner de Contexto

Criar um spawner com contexto customizado para processos filhos:

```lua
local spawner = process.with_context({request_id = "123"})
```

**Permissão:** `process.context` em "context"

### Spawner com Opções

`process.with_options(options)` cria um spawner que carrega opções de tempo de spawn (ex: um seletor de rede) em vez de valores de contexto:

```lua
local spawner = process.with_options({network = "app:tor_proxy"})
```

| Opção | Tipo | Descrição |
|-------|------|-----------|
| `network` | string | ID de registro de uma entrada `network.*` para as conexões de saída do processo filho |

**Permissão:** `process.context` em "context"; selecionar uma rede requer adicionalmente `network.select` nesse ID de rede.

### Métodos SpawnBuilder

SpawnBuilder é imutável - cada método retorna uma nova instância:

```lua
spawner:with_context(values)      -- Add context values
spawner:with_actor(actor)         -- Set security actor
spawner:with_scope(scope)         -- Set security scope
spawner:with_name(name)           -- Set process name
spawner:with_message(topic, ...)  -- Queue message to send after spawn
spawner:with_options(options)     -- Merge spawn-time options (e.g. network)
```

**Permissão:** `process.security` em "security" para `:with_actor()` e `:with_scope()`

### Métodos Spawn do Spawner

```lua
spawner:spawn(id, host, ...)
spawner:spawn_monitored(id, host, ...)
spawner:spawn_linked(id, host, ...)
spawner:spawn_linked_monitored(id, host, ...)
```

Mesmas permissões que funções spawn do módulo.

### Exec do Spawner

```lua
local result, err = spawner:exec(id, host, ...)
```

Executa o processo alvo de forma síncrona sob o contexto, ator e escopo do builder, e retorna seu valor de resultado — a contraparte vinculada do `process.exec` de nível de módulo. Um worker deferido pode reconstruir a identidade de um dono com `with_actor`/`with_scope` e executar em nome dele.

**Permissões:** `process.exec` no id do processo, `process.host` no id do host

## Registro de Nomes

Registrar um processo sob um nome e alcançá-lo por esse nome em vez de seu PID. Qualquer função que aceite um `destination` (`send`, `terminate`, `cancel`, `monitor`, `link`, ...) aceita um nome registrado no lugar de um PID.

```lua
local ok, err = process.registry.register(name)               -- self, local scope
local pid, err = process.registry.lookup(name)
local ok, err = process.registry.unregister(name)
```

### Escopo

O argumento opcional `scope` seleciona a garantia de consistência do nome e usa `LOCAL` por padrão. Consulte o [Guia de Cluster](guides/cluster.md#nomeação-e-escopos-de-nome) para o modelo completo.

| Constante | Visibilidade | Garantia |
|-----------|--------------|----------|
| `process.registry.LOCAL` | apenas este nó | Instantâneo, local ao nó |
| `process.registry.EVENTUAL` | todo o cluster | Eventualmente consistente (gossip) |
| `process.registry.CONSISTENT` | todo o cluster | Singleton linearizável (Raft) |
| `process.registry.STRONG` | todo o cluster | Consistente + todos os nós ativos reconhecem |

Em um nó standalone, apenas `LOCAL` está disponível; os escopos de cluster exigem [clustering](guides/cluster.md).

### register

```lua
local ok, err = process.registry.register(name, pid, scope)
```

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `name` | string | sim | | Nome a registrar |
| `pid` | string | não | self | PID a registrar; padrão é o processo chamador |
| `scope` | number | não | `LOCAL` | Um dos constantes de escopo acima |

Retorna `true` em caso de sucesso, ou `nil, error` em caso de falha. Conflitos (nome já registrado para um PID diferente sob um escopo de cluster) retornam `errors.ALREADY_EXISTS`. Registrar o mesmo nome para o mesmo PID é idempotente. Um registro `STRONG` bloqueia até que todos os nós ativos reconheçam ou o prazo da reserva expire; em timeout retorna um erro.

Registrar em nome de um PID diferente requer adicionalmente a permissão `process.registry.foreign` no PID alvo.

### lookup

```lua
local pid, err = process.registry.lookup(name)
```

Retorna a string PID registrada, ou `nil, error` com tipo `errors.NOT_FOUND` quando o nome não está registrado.

### unregister

```lua
local ok, err = process.registry.unregister(name, scope)
```

`scope` tem padrão `LOCAL` e deve corresponder ao escopo sob o qual o nome foi registrado. Para `CONSISTENT` e `STRONG`, o processo proprietário é o autorizado a cancelar o registro; cancelar o registro de um nome pertencente a outro PID retorna `false`. Nomes também são liberados automaticamente quando o processo proprietário sai (e, para escopos de cluster, quando seu nó parte), portanto o unregister explícito é para liberação antecipada.

## Permissões

Permissões controlam o que um processo chamador pode fazer. Todas as verificações usam o contexto de segurança do chamador (ator) contra o recurso alvo.

### Avaliação de Política

Políticas podem permitir/negar baseado em:
- **Actor**: O principal de segurança fazendo a requisição
- **Action**: A operação sendo realizada (ex: `process.send`)
- **Resource**: O alvo (PID, id do processo, id do host ou nome)
- **Attributes**: Contexto adicional incluindo `pid` (ID do processo do chamador)

### Referência de Permissões

| Permissão | Funções | Recurso |
|-----------|---------|---------|
| `process.spawn` | `spawn*()` | id do processo |
| `process.spawn.monitored` | `spawn_monitored()`, `spawn_linked_monitored()` | id do processo |
| `process.spawn.linked` | `spawn_linked()`, `spawn_linked_monitored()` | id do processo |
| `process.host` | `spawn()` no nível do módulo, todos os métodos de spawn de `SpawnBuilder`, `exec()` | ID do host |
| `process.send` | `send()` | PID de destino |
| `process.exec` | `exec()` | id do processo |
| `process.terminate` | `terminate()` | PID de destino |
| `process.cancel` | `cancel()` | PID de destino |
| `process.monitor` | `monitor()` | PID de destino |
| `process.unmonitor` | `unmonitor()` | PID de destino |
| `process.link` | `link()` | PID de destino |
| `process.unlink` | `unlink()` | PID de destino |
| `process.context` | `with_context()` | "context" |
| `process.security` | `:with_actor()`, `:with_scope()` | "security" |
| `process.registry.register` | `registry.register()` | nome |
| `process.registry.unregister` | `registry.unregister()` | nome |
| `process.registry.foreign` | `registry.register()` | PID de destino |

Escopos de nome de cluster são autorizados por variantes com sufixo de escopo dessas ações (`process.registry.register.eventual`, `.consistent`, `.strong` e as ações `unregister` correspondentes), de modo que uma política pode conceder nomeação local separadamente de nomeação em todo o cluster.

### Múltiplas Permissões

Algumas operações requerem múltiplas permissões:

| Operação | Permissões Requeridas |
|----------|----------------------|
| `spawn()` | `process.spawn` + `process.host` |
| `spawn_monitored()` no nível do módulo | `process.spawn` + `process.spawn.monitored` |
| `spawn_linked()` no nível do módulo | `process.spawn` + `process.spawn.linked` |
| `spawn_linked_monitored()` no nível do módulo | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` |
| `SpawnBuilder:spawn()` | `process.spawn` + `process.host` |
| `SpawnBuilder:spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `SpawnBuilder:spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `SpawnBuilder:spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `exec()` | `process.exec` + `process.host` |
| spawn com ator/escopo customizado | permissões de spawn + `process.security` |

## Erros

| Condição | Tipo |
|----------|------|
| Contexto não encontrado | `errors.INTERNAL` |
| Contexto de frame não encontrado | `errors.INTERNAL` |
| Argumentos requeridos ausentes | `errors.INVALID` |
| Prefixo de tópico reservado (`@`) | `errors.INVALID` |
| Nome não registrado | `errors.NOT_FOUND` |
| Permissão negada | `errors.PERMISSION_DENIED` |
| Nome já registrado | `errors.ALREADY_EXISTS` |

Veja [Tratamento de Erros](lua/core/errors.md) para trabalhar com erros.

## Veja Também

- [Channels](lua/core/channel.md) - Coordenação de corrotinas no processo
- [Fila de Mensagens](lua/storage/queue.md) - Mensagens baseadas em fila
- [Funções](lua/core/funcs.md) - Invocação de funções
- [Supervisão](guides/supervision.md) - Gerenciamento do ciclo de vida de processos
- [Cluster](guides/cluster.md) - Escopos de nome e nomeação no cluster
