# Actor

O modulo `wippy/actor` fornece uma biblioteca de concorrencia por passagem de mensagens que transforma um processo Lua em um ator com roteamento por topico. Os manipuladores sao procurados pelo topico da mensagem, e a biblioteca multiplexa a caixa de entrada do processo, eventos do sistema, resultados assincronos internos e quaisquer canais adicionais atraves de um unico laco `channel.select`.

## Configuracao

```bash
wippy add wippy/actor
wippy install
```

Declare a biblioteca como dependencia e importe-a onde for necessaria:

```yaml
- name: dep.actor
  kind: ns.dependency
  component: wippy/actor
  version: "*"

- name: counter_process
  kind: process.lua
  source: file://counter.lua
  method: main
  modules:
    - time
  imports:
    actor: wippy.actor:actor
```

## Uso Basico

```lua
local actor = require("actor")

local initial_state = { counter = 0 }

local handlers = {
    increment = function(state, payload, topic, from)
        state.counter = state.counter + (payload.amount or 1)
    end,

    get_count = function(state, payload, topic, from)
        process.send(from, "count_result", { count = state.counter })
    end,

    stop = function(state)
        return actor.exit({ final_count = state.counter })
    end,
}

local function main()
    return actor.new(initial_state, handlers):run()
end

return { main = main }
```

`actor.new(state, handlers)` retorna uma instancia do ator. `run()` impulsiona o laco select ate que um manipulador retorne `actor.exit(...)` ou o processo seja cancelado.

## Manipuladores

Toda chave da tabela `handlers` cujo nome nao comece com `__` e um manipulador de topico. Os manipuladores recebem `(state, payload, topic, from)`.

### Manipuladores Especiais

| Nome | Quando executa |
|------|--------------|
| `__init` | Uma vez, antes de o laco select iniciar |
| `__default` | Topico sem um manipulador correspondente |
| `__on_event` | Qualquer evento do processo (incluindo cancelamento) |
| `__on_cancel` | Evento de cancelamento do processo (chamado apos `__on_event`) |
| `__on_internal_message` | Resultado entregue por `state.async` |

## Fluxo de Controle

### Exit

```lua
return actor.exit({ reason = "done", data = state.data })
```

Para o laco e resolve `run()` com o valor.

### Chain

```lua
return actor.next("process", payload)
```

Redireciona a mensagem atual sob um novo topico. Se `payload` for `nil`, o payload anterior e mantido. Util para pipelines de validacao -> processamento sem `if` aninhados.

## Metodos de Estado

`actor.new` anexa utilitarios a tabela de estado. Eles estao disponiveis dentro de qualquer manipulador.

| Metodo | Descricao |
|--------|-------------|
| `state.add_handler(topic, fn)` | Registra um manipulador em tempo de execucao |
| `state.remove_handler(topic)` | Remove um manipulador adicionado previamente |
| `state.register_channel(ch, fn)` | Multiplexa um canal adicional no laco; `fn(state, value, ok, channel_id)` executa a cada recepcao |
| `state.unregister_channel(ch)` | Para de escutar no canal |
| `state.async(fn)` | Executa `fn` em uma nova corrotina; se retornar `actor.next(...)`, o resultado e entregue de volta ao ator |
| `state.wait(topic, timeout_ms)` | Espera bloqueante com tempo limite por um listener de topico; retorna `(value, err)` |
| `state.next(topic, payload)` | Alias para `actor.next` |

## Eventos e Cancelamento

O laco recebe automaticamente os eventos do processo. Sobrescreva `__on_event` (ou o mais especifico `__on_cancel`) para reagir:

```lua
__on_cancel = function(state, event, kind, from)
    return actor.exit({ reason = "cancelled", items = state.items })
end,
```

Sem um manipulador personalizado, um evento de cancelamento ainda assim termina o ator -- atraves do encaminhamento padrao de eventos -- mas nenhuma limpeza personalizada executa.

## Exemplo Completo

```lua
local actor = require("actor")

local handlers = {
    __init = function(state)
        state.items = {}
        state.async(function() return actor.next("ready", {}) end)
    end,

    ready = function(state)
        process.send(state.parent, "actor_ready", { pid = process.pid() })
    end,

    subscribe = function(state, _, _, from)
        state.subscriber = from
    end,

    add_item = function(state, payload)
        table.insert(state.items, payload.item)
        return actor.next("notify_change", {})
    end,

    notify_change = function(state)
        if state.subscriber then
            process.send(state.subscriber, "items_changed", { count = #state.items })
        end
    end,

    get_items = function(state, _, _, from)
        process.send(from, "items_list", { items = state.items })
    end,

    __on_cancel = function(state)
        return actor.exit({ items = state.items })
    end,
}

local function main()
    return actor.new({ parent = process.parent() }, handlers):run()
end

return { main = main }
```

## Veja Tambem

- [Process](../lua/core/process.md) - Caixa de entrada, eventos, primitivas send/spawn
- [Channels](../lua/core/channel.md) - Primitivas de canal e select usadas internamente
- [Visao Geral do Framework](overview.md) - Uso de modulos do framework
