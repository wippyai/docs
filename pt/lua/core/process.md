---
title: "Gerenciamento de Processos"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='workflow'/ <secondary-label ref='permissions'/"
---

# Gerenciamento de Processos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

Crie, monitore e comunique-se com processos filhos. Implementa padrões de modelo de atores com passagem de mensagens, supervisão e gerenciamento de ciclo de vida.

A variável global `process` está sempre disponível — não requer `require()` nem precisa aparecer em `modules:`.

## Informações do Processo

Obter o ID do frame atual ou ID do processo:

```lua
local frame_id = process.id()  -- Identificador da cadeia de chamadas
local pid = process.pid()       -- ID do processo
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
-- Spawn básico
local pid, err = process.spawn(id, host, ...)

-- Com monitoramento (receber eventos EXIT)
local pid, err = process.spawn_monitored(id, host, ...)

-- Com link (receber LINK_DOWN em saída anormal)
local pid, err = process.spawn_linked(id, host, ...)

-- Ambos linked e monitored
local pid, err = process.spawn_linked_monitored(id, host, ...)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID fonte do processo (ex: `"app.workers:handler"`) |
| `host` | string | ID do host (ex: `"app:processes"`) |
| `...` | any | Argumentos passados para o processo criado |

**Permissões:**
- `process.spawn` no id do processo
- `process.host` no id do host
- `process.spawn.monitored` no id do processo (para variantes monitored)
- `process.spawn.linked` no id do processo (para variantes linked)

## Controle de Processo

```lua
-- Terminar forçadamente um processo
local ok, err = process.terminate(destination)

-- Solicitar cancelamento gracioso com motivo opcional
local ok, err = process.cancel(destination, "encerrando")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `destination` | string | PID ou nome registrado |
| `reason` | string | Motivo opcional entregue ao alvo |

**Permissões:** `process.terminate`, `process.cancel` no PID de destino

## Monitoramento e Link

Monitorar ou linkar a um processo existente:

```lua
-- Monitoramento: receber eventos EXIT quando o alvo sair
local ok, err = process.monitor(destination)
local ok, err = process.unmonitor(destination)

-- Link: bidirecional, receber LINK_DOWN em saída anormal
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
local inbox = process.inbox()    -- Objetos Message do tópico @inbox
local events = process.events()  -- Eventos de ciclo de vida do tópico @events
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
| `result` | any | Para EXIT: o valor retornado (presente em saída normal) |
| `error` | any | Para EXIT: o erro (presente em saída anormal) |
| `reason` | string | Para CANCEL: motivo pelo qual o processo está sendo cancelado |
| `sources` | string[] | Para OUTDATED: IDs de registro que mudaram ou foram afetados transitivamente |

OUTDATED é entregue apenas a processos que optaram por ele com `process.set_options({upgradable = true})`; os demais processos nunca o veem. Múltiplas invalidações são coalescidas em um único evento pendente com a união de `sources`. A reação pretendida é um hot swap via [`process.upgrade`](#upgrade-de-processo).

## Inscrição em Tópico

Inscrever-se em tópicos customizados:

```lua
local ch = process.listen(topic, options)
process.unlisten(ch)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `topic` | string | Nome do tópico (não pode começar com `@`) |
| `options.message` | boolean | Se true, recebe objetos Message; se false, payloads raw |

## Objetos Message

Ao receber do inbox ou com `{message = true}`:

```lua
local msg = inbox:receive()

msg:topic()            -- string: nome do tópico
msg:from()             -- string|nil: PID do remetente
msg:payload()          -- Payload: wrapper (chame :data() para extrair)
msg:payload():data()   -- any: valor real do payload
```

## Chamada Síncrona

Criar um processo, aguardar seu resultado e retornar:

```lua
local result, err = process.exec(id, host, ...)
```

**Permissões:** `process.exec` no id do processo, `process.host` no id do host

## Upgrade de Processo

Atualizar o processo atual para uma nova definição preservando o PID:

```lua
-- Upgrade para nova versão, passando estado
process.upgrade(id, ...)

-- Manter mesma definição, re-executar com novo estado
process.upgrade(nil, preserved_state)
```

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
spawner:with_context(values)      -- Adicionar valores de contexto
spawner:with_actor(actor)         -- Definir ator de segurança
spawner:with_scope(scope)         -- Definir escopo de segurança
spawner:with_name(name)           -- Definir nome do processo
spawner:with_message(topic, ...)  -- Enfileirar mensagem para enviar após spawn
spawner:with_options(options)     -- Mesclar opções de spawn (ex. network)
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
local ok, err = process.registry.register(name)               -- self, escopo local
local pid, err = process.registry.lookup(name)
local ok, err = process.registry.unregister(name)
```

### Escopo

O argumento opcional `scope` seleciona a garantia de consistência do nome. O padrão é `LOCAL`. Os quatro escopos e suas garantias estão descritos no [Guia de Cluster](guides/cluster.md#nomeação-e-escopos-de-nome); resumidamente:

| Constante | Visibilidade | Garantia |
|-----------|--------------|----------|
| `process.registry.LOCAL` | apenas este nó | Instantâneo, local ao nó |
| `process.registry.EVENTUAL` | todo o cluster | Eventualmente consistente (gossip) |
| `process.registry.CONSISTENT` | todo o cluster | Singleton linearizável (Raft) |
| `process.registry.STRONG` | todo o cluster | Consistente + todos os nós ativos reconhecem |

Em um nó standalone apenas `LOCAL` é significativo; os escopos de cluster requerem [clustering](guides/cluster.md).

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
| `process.host` | `spawn*()`, `exec()` | id do host |
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
| `spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `exec()` | `process.exec` + `process.host` |
| spawn com ator/escopo customizado | permissões de spawn + `process.security` |

## Erros

| Condição | Tipo |
|----------|------|
| Contexto não encontrado | `errors.INVALID` |
| Contexto de frame não encontrado | `errors.INVALID` |
| Argumentos requeridos ausentes | `errors.INVALID` |
| Prefixo de tópico reservado (`@`) | `errors.INVALID` |
| Formato de duração inválido | `errors.INVALID` |
| Nome não registrado | `errors.NOT_FOUND` |
| Permissão negada | `errors.PERMISSION_DENIED` |
| Nome já registrado | `errors.ALREADY_EXISTS` |

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.

## Veja Também

- [Channels](lua/core/channel.md) - Comunicação entre processos
- [Message Queue](lua/storage/queue.md) - Mensagens baseadas em fila
- [Functions](lua/core/funcs.md) - Invocação de funções
- [Supervisão](guides/supervision.md) - Gerenciamento de ciclo de vida de processos
- [Cluster](guides/cluster.md) - Escopos de nome e nomeação em todo o cluster
