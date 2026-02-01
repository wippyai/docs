# Gerenciamento de Processos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

Crie, monitore e comunique-se com processos filhos. Implementa padroes de modelo de atores com passagem de mensagens, supervisao e gerenciamento de ciclo de vida.

O global `process` esta sempre disponivel.

## Informacoes do Processo

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

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `destination` | string | PID ou nome registrado |
| `topic` | string | Nome do topico (nao pode comecar com `@`) |
| `...` | any | Valores do payload |

**Permissao:** `process.send` no PID de destino

## Criando Processos

```lua
-- Spawn basico
local pid, err = process.spawn(id, host, ...)

-- Com monitoramento (receber eventos EXIT)
local pid, err = process.spawn_monitored(id, host, ...)

-- Com link (receber LINK_DOWN em saida anormal)
local pid, err = process.spawn_linked(id, host, ...)

-- Ambos linked e monitored
local pid, err = process.spawn_linked_monitored(id, host, ...)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `id` | string | ID fonte do processo (ex: `"app.workers:handler"`) |
| `host` | string | ID do host (ex: `"app:processes"`) |
| `...` | any | Argumentos passados para o processo criado |

**Permissoes:**
- `process.spawn` no id do processo
- `process.host` no id do host
- `process.spawn.monitored` no id do processo (para variantes monitored)
- `process.spawn.linked` no id do processo (para variantes linked)

## Controle de Processo

```lua
-- Terminar forcadamente um processo
local ok, err = process.terminate(destination)

-- Solicitar cancelamento gracioso com deadline opcional
local ok, err = process.cancel(destination, "5s")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `destination` | string | PID ou nome registrado |
| `deadline` | string\|integer | String de duracao ou milissegundos |

**Permissoes:** `process.terminate`, `process.cancel` no PID de destino

## Monitoramento e Link

Monitorar ou linkar a um processo existente:

```lua
-- Monitoramento: receber eventos EXIT quando o alvo sair
local ok, err = process.monitor(destination)
local ok, err = process.unmonitor(destination)

-- Link: bidirecional, receber LINK_DOWN em saida anormal
local ok, err = process.link(destination)
local ok, err = process.unlink(destination)
```

**Permissoes:** `process.monitor`, `process.unmonitor`, `process.link`, `process.unlink` no PID de destino

## Opcoes do Processo

```lua
local options = process.get_options()
local ok, err = process.set_options({trap_links = true})
```

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `trap_links` | boolean | Se eventos LINK_DOWN sao entregues ao channel de eventos |

## Inbox e Eventos

Obter channels para receber mensagens e eventos de ciclo de vida:

```lua
local inbox = process.inbox()    -- Objetos Message do topico @inbox
local events = process.events()  -- Eventos de ciclo de vida do topico @events
```

### Tipos de Evento

| Constante | Descricao |
|-----------|-----------|
| `process.event.CANCEL` | Cancelamento solicitado |
| `process.event.EXIT` | Processo monitorado saiu |
| `process.event.LINK_DOWN` | Processo linked terminou anormalmente |

### Campos de Evento

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `kind` | string | Constante de tipo de evento |
| `from` | string | PID de origem |
| `result` | table | Para EXIT: `{value: any}` ou `{error: string}` |
| `deadline` | string | Para CANCEL: timestamp do deadline |

## Inscricao em Topico

Inscrever-se em topicos customizados:

```lua
local ch = process.listen(topic, options)
process.unlisten(ch)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `topic` | string | Nome do topico (nao pode comecar com `@`) |
| `options.message` | boolean | Se true, recebe objetos Message; se false, payloads raw |

## Objetos Message

Ao receber do inbox ou com `{message = true}`:

```lua
local msg = inbox:receive()

msg:topic()    -- string: nome do topico
msg:from()     -- string|nil: PID do remetente
msg:payload()  -- any: dados do payload
```

## Chamada Sincrona

Criar um processo, aguardar seu resultado e retornar:

```lua
local result, err = process.call(id, host, ...)
```

**Permissoes:** `process.call` no id do processo, `process.host` no id do host

## Upgrade de Processo

Atualizar o processo atual para uma nova definicao preservando o PID:

```lua
-- Upgrade para nova versao, passando estado
process.upgrade(source, ...)

-- Manter mesma definicao, re-executar com novo estado
process.upgrade(nil, preserved_state)
```

## Spawner de Contexto

Criar um spawner com contexto customizado para processos filhos:

```lua
local spawner = process.with_context({request_id = "123"})
```

**Permissao:** `process.context` em "context"

### Metodos SpawnBuilder

SpawnBuilder e imutavel - cada metodo retorna uma nova instancia:

```lua
spawner:with_context(values)      -- Adicionar valores de contexto
spawner:with_actor(actor)         -- Definir ator de seguranca
spawner:with_scope(scope)         -- Definir escopo de seguranca
spawner:with_name(name)           -- Definir nome do processo
spawner:with_message(topic, ...)  -- Enfileirar mensagem para enviar apos spawn
```

**Permissao:** `process.security` em "security" para `:with_actor()` e `:with_scope()`

### Metodos Spawn do Spawner

```lua
spawner:spawn(id, host, ...)
spawner:spawn_monitored(id, host, ...)
spawner:spawn_linked(id, host, ...)
spawner:spawn_linked_monitored(id, host, ...)
```

Mesmas permissoes que funcoes spawn do modulo.

## Registro de Nomes

Registrar e buscar processos por nome:

```lua
local ok, err = process.registry.register(name, pid)  -- pid padrao e self
local pid, err = process.registry.lookup(name)
local ok = process.registry.unregister(name)
```

**Permissoes:** `process.registry.register`, `process.registry.unregister` no nome

## Permissoes

Permissoes controlam o que um processo chamador pode fazer. Todas as verificacoes usam o contexto de seguranca do chamador (ator) contra o recurso alvo.

### Avaliacao de Politica

Politicas podem permitir/negar baseado em:
- **Actor**: O principal de seguranca fazendo a requisicao
- **Action**: A operacao sendo realizada (ex: `process.send`)
- **Resource**: O alvo (PID, id do processo, id do host ou nome)
- **Attributes**: Contexto adicional incluindo `pid` (ID do processo do chamador)

### Referencia de Permissoes

| Permissao | Funcoes | Recurso |
|-----------|---------|---------|
| `process.spawn` | `spawn*()` | id do processo |
| `process.spawn.monitored` | `spawn_monitored()`, `spawn_linked_monitored()` | id do processo |
| `process.spawn.linked` | `spawn_linked()`, `spawn_linked_monitored()` | id do processo |
| `process.host` | `spawn*()`, `call()` | id do host |
| `process.send` | `send()` | PID de destino |
| `process.call` | `call()` | id do processo |
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

### Multiplas Permissoes

Algumas operacoes requerem multiplas permissoes:

| Operacao | Permissoes Requeridas |
|----------|----------------------|
| `spawn()` | `process.spawn` + `process.host` |
| `spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `call()` | `process.call` + `process.host` |
| spawn com ator/escopo customizado | permissoes de spawn + `process.security` |

## Erros

| Condicao | Tipo |
|----------|------|
| Contexto nao encontrado | `errors.INVALID` |
| Contexto de frame nao encontrado | `errors.INVALID` |
| Argumentos requeridos ausentes | `errors.INVALID` |
| Prefixo de topico reservado (`@`) | `errors.INVALID` |
| Formato de duracao invalido | `errors.INVALID` |
| Nome nao registrado | `errors.NOT_FOUND` |
| Permissao negada | `errors.PERMISSION_DENIED` |
| Nome ja registrado | `errors.ALREADY_EXISTS` |

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.

## Veja Tambem

- [Channels](lua/core/channel.md) - Comunicacao entre processos
- [Message Queue](lua/storage/queue.md) - Mensagens baseadas em fila
- [Functions](lua/core/funcs.md) - Invocacao de funcoes
- [Supervision](guides/supervision.md) - Gerenciamento de ciclo de vida de processos
