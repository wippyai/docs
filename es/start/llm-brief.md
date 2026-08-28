---
title: "Resumen para LLM"
description: "Esta página es para agentes de IA y LLM. Si estás construyendo sobre Wippy o generando código para un proyecto Wippy, lee esto primero."
---

# Resumen para LLM

Usa este resumen como contexto inicial al generar código para un proyecto Wippy.

**Clasificación: referencia para generación.** Los bloques siguientes son patrones de contrato concretos, no un único proyecto ejecutable. Los ID del registro, esquemas, políticas y valores específicos de la aplicación como `user_id`, `config` y `content` debe definirlos el proyecto que los use.

## Qué es Wippy

Wippy es un runtime de aplicaciones de un solo binario construido sobre el modelo de actores. Ejecuta código Lua en procesos aislados con paso de mensajes — sin memoria compartida, sin locks. Existen tres modelos de cómputo: funciones (sin estado, con alcance de petición), procesos (actores de larga duración con estado) y workflows (actores durables respaldados por Temporal que sobreviven a caídas). El sistema está diseñado para que los agentes puedan generar código, registrarlo y mejorar aplicaciones sin redespliegue.

## Modelo mental

Todo en Wippy es una **entrada de registro** (registry entry). Las entradas tienen un ID (`namespace:name`), un tipo (que determina el comportamiento), metadatos y datos. Los archivos YAML son una forma de declarar entradas, pero el registro es la fuente de verdad en tiempo de ejecución y las entradas pueden crearse, actualizarse o eliminarse mientras el sistema está en funcionamiento.

Los tipos determinan lo que hace una entrada:

- `function.lua` — función invocable sin estado
- `process.lua` — actor de larga duración
- `workflow.lua` — workflow durable (Temporal)
- `http.service` — servidor HTTP
- `http.router` — grupo de rutas con middleware
- `http.endpoint` — manejador HTTP
- `db.sql.postgres` / `mysql` / `sqlite` — conexión a base de datos
- `store.memory` / `store.sql` — almacén clave-valor
- `queue.queue` — cola de mensajes
- `process.host` — host de ejecución de procesos
- `process.service` — proceso supervisado
- `contract.definition` / `contract.binding` — interfaces de servicio tipadas
- `registry.entry` — datos de configuración

## Estructura del proyecto

```
myapp/
├── .wippy.yaml              # Runtime configuration
├── wippy.lock               # Source directories
└── src/
    ├── _index.yaml          # Entry definitions (namespace: app)
    ├── api/
    │   ├── _index.yaml      # namespace: app.api
    │   └── handler.lua
    └── workers/
        ├── _index.yaml      # namespace: app.workers
        └── task.lua
```

Las definiciones de entradas viven en archivos `_index.yaml`:

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    source: file://handler.lua
    method: get_user
    modules: [sql]

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      router: app:api_router
    method: GET
    path: /users/{id}
    func: app.api:get_user
```

## Escribir funciones

Las funciones no tienen estado. Reciben argumentos, realizan trabajo y devuelven resultados. Heredan el contexto del llamador y se cancelan si el llamador cancela.

```lua
local sql = require("sql")

local function get_user(id)
    local db, err = sql.get("app:main_db")
    if err then return nil, err end

    local rows, err = db:query("SELECT * FROM users WHERE id = $1", {id})
    if err then
        local _, release_err = db:release()
        return nil, release_err or err
    end

    local _, release_err = db:release()
    if release_err then return nil, release_err end
    if #rows == 0 then
        return nil, errors.new({kind = errors.NOT_FOUND, message = "user not found"})
    end

    return rows[1]
end

return get_user
```

Para manejadores HTTP, usa el módulo `http`:

```lua
local http = require("http")
local funcs = require("funcs")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local id, param_err = req:param("id")
    if param_err then return nil, param_err end
    local user, err = funcs.call("app.api:get_user", id)
    if err then
        local status_err
        if errors.is(err, errors.NOT_FOUND) then
            status_err = res:set_status(404)
        else
            status_err = res:set_status(500)
        end
        if status_err then return nil, status_err end
        local write_err = res:write_json({error = err:message()})
        if write_err then return nil, write_err end
        return true
    end

    local write_err = res:write_json(user)
    if write_err then return nil, write_err end
    return true
end

return handler
```

## Escribir procesos

Los procesos son actores. Tienen su propio PID, reciben mensajes a través de un buzón y mantienen el estado entre mensajes. Ceden (yield) en I/O bloqueante, permitiendo que miles se ejecuten concurrentemente.

```lua
local function worker(initial_config)
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local r = channel.select {
            inbox:case_receive(),
            events:case_receive()
        }

        if not r.ok then break end

        if r.channel == events then
            local ev = r.value
            if ev.kind == process.event.CANCEL then
                break
            end
        elseif r.channel == inbox then
            local msg = r.value
            local topic = msg:topic()
            local data, err = msg:payload():data()
            if err then return nil, err end

            if topic == "work" then
                -- Perform the application-specific work here.
                print(data.item_id)
            end
        end
    end
end

return worker
```

Genera procesos desde otro código:

```lua
local pid, err = process.spawn("app.workers:task", "app:process_host", config)
if err then return nil, err end

local ok, send_err = process.send(pid, "work", {item_id = 123})
if send_err then return nil, send_err end
return ok
```

## Escribir workflows

Los workflows conservan el historial de ejecución para reanudarse tras fallos o reinicios. El código usa sintaxis Lua normal, mientras el runtime registra resultados de funciones, sleeps y valores aleatorios para reproducirlos de forma determinista.

Cada destino de `funcs.call()` que aparece a continuación debe registrarse como actividad en el mismo worker de Temporal mediante `meta.temporal.activity.worker`. Consulta [Actividades](../temporal/activities.md) para los metadatos de función requeridos.

```lua
local funcs = require("funcs")

local function compensate(inventory, payment)
    local _, refund_err = funcs.call("app:refund_payment", payment.id)
    local _, release_err = funcs.call("app:release_inventory", inventory.id)
    return refund_err or release_err
end

local function order_flow(order)
    local inventory, err = funcs.call("app:reserve_inventory", order.items)
    if err then return nil, err end

    local payment, payment_err = funcs.call("app:charge_payment", order.total)
    if payment_err then
        local _, release_err = funcs.call("app:release_inventory", inventory.id)
        return nil, release_err or payment_err
    end

    -- Wait for approval signal (can block for days)
    local msg, open = process.inbox():receive()
    if not open then
        local compensation_err = compensate(inventory, payment)
        return nil, compensation_err or errors.new("workflow inbox closed")
    end

    local decision, payload_err = msg:payload():data()
    if payload_err then
        local compensation_err = compensate(inventory, payment)
        return nil, compensation_err or payload_err
    end
    if not decision.approved then
        local compensation_err = compensate(inventory, payment)
        return nil, compensation_err or errors.new("rejected")
    end

    return funcs.call("app:fulfill_order", order.id)
end

return order_flow
```

## APIs clave

### Llamar funciones

```lua
local funcs = require("funcs")

-- Synchronous
local result, err = funcs.call("namespace:function_name", arg1, arg2)
if err then return nil, err end

-- Asynchronous (returns Future)
local future, future_err = funcs.async("namespace:function_name", arg1)
if future_err then return nil, future_err end
local response_ch = future:response()
local _, response_open = response_ch:receive()
if not response_open then
    return nil, errors.new("future response channel closed")
end
local async_payload, async_err = future:result()
if async_err then return nil, async_err end
local async_result, decode_err = async_payload:data()
if decode_err then return nil, decode_err end

-- With context
local contextual_exec, contextual_err = funcs.new():with_context({user_id = "123"})
if contextual_err then return nil, contextual_err end
local contextual_result, contextual_err = contextual_exec:call("namespace:function_name")
if contextual_err then return nil, contextual_err end
```

### Comunicación entre procesos

```lua
-- Send message (fire-and-forget)
local ok, err = process.send(pid, "topic", data)
if err then return nil, err end

-- Receive messages
local inbox = process.inbox()
local msg, ok = inbox:receive()
if not ok then return nil, errors.new("process inbox closed") end
local topic = msg:topic()
local data, payload_err = msg:payload():data()
if payload_err then return nil, payload_err end

-- Monitor another process (receive EXIT on death)
local monitored, monitor_err = process.monitor(pid)
if monitor_err then return nil, monitor_err end

-- Link processes (bidirectional failure notification)
local linked_pid, spawn_err = process.spawn_linked("namespace:name", "host")
if spawn_err then return nil, spawn_err end
```

### Canales

Canales al estilo Go para comunicación entre corrutinas:

```lua
local ch = channel.new(10)  -- buffered
ch:send(value)
local val, ok = ch:receive()

-- Select on multiple channels
local r = channel.select {
    ch1:case_receive(),
    ch2:case_receive(),
    timeout:case_receive()
}
```

### Manejo de errores

Las funciones devuelven pares `result, error`. Los errores son objetos tipados:

```lua
local result, err = some_operation()
if err then
    if errors.is(err, errors.NOT_FOUND) then
        -- handle not found
    end
    return nil, errors.wrap(err, "context message")
end
```

Tipos de error: `UNKNOWN`, `INVALID`, `NOT_FOUND`, `ALREADY_EXISTS`, `PERMISSION_DENIED`, `TIMEOUT`, `CANCELED`, `UNAVAILABLE`, `INTERNAL`, `CONFLICT`, `RATE_LIMITED`.

### Acceso a datos

```lua
-- SQL
local sql = require("sql")
local db, db_err = sql.get("app:main_db")
if db_err then return nil, db_err end
local rows, err = db:query("SELECT * FROM users WHERE active = $1", {true})
if err then
    local _, release_err = db:release()
    return nil, release_err or err
end
local _, release_err = db:release()
if release_err then return nil, release_err end

-- Key-value store
local store = require("store")
local cache, cache_err = store.get("app:cache")
if cache_err then return nil, cache_err end
local stored, set_err = cache:set("key", value, 3600)  -- TTL in seconds
if set_err then
    cache:release()
    return nil, set_err
end
local val, get_err = cache:get("key")
cache:release()
if get_err then return nil, get_err end

-- Queue
local queue = require("queue")
local published, publish_err = queue.publish("app:tasks", {task = "process", id = 123})
if publish_err then return nil, publish_err end

-- Filesystem
local fs = require("fs")
local vol, volume_err = fs.get("app:storage")
if volume_err then return nil, volume_err end
local data, read_err = vol:readfile("path/to/file.txt")
if read_err then return nil, read_err end
local written, write_err = vol:writefile("output.txt", content)
if write_err then return nil, write_err end
```

### Cliente HTTP

```lua
local http_client = require("http_client")

local resp, err = http_client.get("https://api.example.com/data", {
    headers = {Authorization = "Bearer token"},
    timeout = "10s"
})
if err then return nil, err end
local body = resp.body
```

### Seguridad

```lua
local security = require("security")

local actor = security.actor()       -- who is calling
local scope = security.scope()       -- what permissions apply
if not actor then return nil, errors.new("security actor unavailable") end
if not scope then return nil, errors.new("security scope unavailable") end
local allowed = security.can("read", "resource:users")

-- Token management
local ts, store_err = security.token_store("app:tokens")
if store_err then return nil, store_err end
local token, create_err = ts:create(actor, scope, {expiration = "24h"})
if create_err then
    ts:close()
    return nil, create_err
end
local validated_actor, validated_scope, validate_err = ts:validate(token)
ts:close()
if validate_err then return nil, validate_err end
```

### Tiempo

```lua
local time = require("time")

time.sleep("5s")
local now = time.now()
local timeout, timeout_err = time.after("30s")  -- channel that fires once
if timeout_err then return nil, timeout_err end
local ticker, ticker_err = time.ticker("10s")  -- repeating channel
if ticker_err then return nil, ticker_err end
-- Stop the ticker when its consumer finishes.
ticker:stop()
```

### Registro

```lua
local registry = require("registry")

local entry, entry_err = registry.get("app.api:get_user")
if entry_err then return nil, entry_err end
local tests, find_err = registry.find({["meta.type"] = "test"})
if find_err then return nil, find_err end

-- Create entries at runtime
local snap, snapshot_err = registry.snapshot()
if snapshot_err then return nil, snapshot_err end
local changes, changes_err = snap:changes()
if changes_err then return nil, changes_err end
local _, create_err = changes:create({id = "app:new_func", kind = "function.lua", data = {...}})
if create_err then return nil, create_err end
local version, apply_err = changes:apply()
if apply_err then return nil, apply_err end
```

### Eventos

```lua
local events = require("events")

-- Publish
local sent, send_err = events.send("orders", "order.created", "/orders/123", {order_id = "123"})
if send_err then return nil, send_err end

-- Subscribe (wildcards supported)
local sub, subscribe_err = events.subscribe("orders.*")
if subscribe_err then return nil, subscribe_err end
local ch = sub:channel()
local evt, open = ch:receive()
sub:close()
if not open then return nil, errors.new("event subscription closed") end
```

## Control de acceso a módulos

Cada entrada recibe el entorno base restringido y las bibliotecas estándar, y las entradas ejecutables también reciben el módulo ambiental `process`. Añade los módulos no ambientales del runtime a `modules:` y las bibliotecas respaldadas por el registro a `imports:`. Los módulos no ambientales no declarados no están disponibles. Las funciones Lua del host como `os.execute`, `io.open`, `debug.*`, la carga de módulos nativos y la resolución arbitraria mediante `package.path` no se exponen como módulos opcionales del runtime. El runtime controla la disponibilidad mediante su cargador de módulos, no escaneando el código fuente.

```yaml
modules: [sql, json, http, time, funcs, store]
```

Así es también como funciona el determinismo de los workflows — las entradas de workflow solo reciben módulos deterministas. El runtime intercepta `time.now()`, `uuid.v4()` y otras llamadas no deterministas a nivel de módulo, registrando los resultados para su reproducción.

## Módulos del framework

Wippy tiene módulos de framework instalados a través de dependencias:

- **wippy/llm** — integración con LLM (OpenAI, Anthropic, Google). `llm.generate()`, salida estructurada, embeddings, streaming.
- **wippy/agent** — framework de agentes con uso de herramientas, delegación, traits, memoria. Los agentes se definen como entradas del registro.
- **wippy/test** — testing BDD. Bloques `describe/it`, aserciones, mocking.
- **wippy/dataflow** — orquestación de workflows basada en DAG. Nodos Function, Agent, Cycle, Parallel.
- **wippy/relay** — relé WebSocket con hub central, hubs por usuario, enrutamiento de plugins.
- **wippy/views** — sistema de páginas y componentes con renderizado de plantillas.
- **wippy/facade** — fachada de iframe frontend con puente de autenticación.

## Convenciones

- Los IDs de entrada usan el formato `namespace:name`
- Los nombres usan puntos para separación semántica, guiones bajos para palabras: `get_user.endpoint`
- Las funciones devuelven `result, error` — siempre verifica el error
- Los procesos se comunican mediante paso de mensajes, nunca mediante estado compartido
- Usa `channel.select` para multiplexar múltiples fuentes de eventos
- Los árboles de supervisión manejan los fallos — diseña para "let it crash"
- El contexto (trace IDs, info de usuario, seguridad) se propaga automáticamente a través de llamadas a funciones
- Los workflows no deben usar operaciones no deterministas directamente — el runtime se encarga de esto para `funcs.call`, `time.sleep`, `uuid.v4`, `time.now`

## Documentación

La documentación completa está disponible en [docs.wippy.ai](https://docs.wippy.ai). Endpoints adecuados para LLM:

- Explorar estructura: `https://wippy.ai/llm/toc`
- Búsqueda: `https://wippy.ai/llm/search?q=query`
- Obtener página: `https://wippy.ai/llm/path/en/<path>`
- Obtención por lotes: `https://wippy.ai/llm/context?paths=path1,path2`
