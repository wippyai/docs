# Actor

El modulo `wippy/actor` proporciona una biblioteca de concurrencia por paso de mensajes que convierte un proceso Lua en un actor con enrutamiento por topico. Los manejadores se buscan por el topico del mensaje, y la biblioteca multiplexa el buzon del proceso, los eventos del sistema, los resultados asincronos internos y cualquier canal adicional a traves de un unico bucle `channel.select`.

## Configuracion

```bash
wippy add wippy/actor
wippy install
```

Declara la biblioteca como dependencia e importala donde la necesites:

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

`actor.new(state, handlers)` devuelve una instancia de actor. `run()` impulsa el bucle select hasta que un manejador retorne `actor.exit(...)` o el proceso sea cancelado.

## Manejadores

Toda clave de la tabla `handlers` cuyo nombre no empiece con `__` es un manejador de topico. Los manejadores reciben `(state, payload, topic, from)`.

### Manejadores Especiales

| Nombre | Cuando se ejecuta |
|------|--------------|
| `__init` | Una vez, antes de iniciar el bucle select |
| `__default` | Topico sin un manejador coincidente |
| `__on_event` | Cualquier evento del proceso (incluida la cancelacion) |
| `__on_cancel` | Evento de cancelacion del proceso (se invoca tras `__on_event`) |
| `__on_internal_message` | Resultado entregado por `state.async` |

## Flujo de Control

### Exit

```lua
return actor.exit({ reason = "done", data = state.data })
```

Detiene el bucle y resuelve `run()` con el valor.

### Chain

```lua
return actor.next("process", payload)
```

Re-despacha el mensaje actual bajo un nuevo topico. Si `payload` es `nil`, se conserva el payload anterior. Util para pipelines de validacion -> procesamiento sin `if` anidados.

## Metodos de Estado

`actor.new` adjunta ayudantes a la tabla de estado. Estan disponibles dentro de cualquier manejador.

| Metodo | Descripcion |
|--------|-------------|
| `state.add_handler(topic, fn)` | Registra un manejador en tiempo de ejecucion |
| `state.remove_handler(topic)` | Elimina un manejador agregado previamente |
| `state.register_channel(ch, fn)` | Multiplexa un canal adicional en el bucle; `fn(state, value, ok, channel_id)` se ejecuta en cada recepcion |
| `state.unregister_channel(ch)` | Deja de escuchar en el canal |
| `state.async(fn)` | Ejecuta `fn` en una nueva corrutina; si retorna `actor.next(...)`, el resultado se entrega al actor |
| `state.wait(topic, timeout_ms)` | Espera bloqueante con tiempo limite para un listener de topico; devuelve `(value, err)` |
| `state.next(topic, payload)` | Alias de `actor.next` |

## Eventos y Cancelacion

El bucle recibe automaticamente los eventos del proceso. Sobrescribe `__on_event` (o el mas especifico `__on_cancel`) para reaccionar:

```lua
__on_cancel = function(state, event, kind, from)
    return actor.exit({ reason = "cancelled", items = state.items })
end,
```

Sin un manejador personalizado, un evento de cancelacion aun asi termina el actor -- mediante el cableado de eventos por defecto -- pero no se ejecuta limpieza personalizada.

## Ejemplo Completo

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

## Ver Tambien

- [Process](../lua/core/process.md) - Buzon, eventos, primitivas send/spawn
- [Channels](../lua/core/channel.md) - Primitivas de canal y select usadas internamente
- [Resumen del Framework](overview.md) - Uso de modulos del framework
