# Resumen para LLM

Esta página es para agentes de IA y LLM. Si estás construyendo sobre Wippy o generando código para un proyecto Wippy, lee esto primero.

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
    modules: [sql, json]

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
local json = require("json")
local http = require("http")

local function get_user(id)
    local db, err = sql.get("app:main_db")
    if err then return nil, err end

    local rows, err = db:query("SELECT * FROM users WHERE id = $1", id)
    if err then return nil, err end
    if #rows == 0 then return nil, errors.new(errors.NOT_FOUND, "user not found") end

    return rows[1]
end

return get_user
```

Para manejadores HTTP, usa el módulo `http`:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    local id = req:param("id")
    local user, err = funcs.call("app.api:get_user", id)
    if err then
        res:set_status(404)
        res:write_json({error = err:message()})
        return
    end

    res:write_json(user)
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

        if r.channel == events then
            local ev = r.value
            if ev.type == process.event.CANCEL then
                break
            end
        elseif r.channel == inbox then
            local msg = r.value
            local topic = msg:topic()
            local data = msg:payload():data()
            handle_message(topic, data)
        end
    end
end

return worker
```

Genera procesos desde otro código:

```lua
local pid = process.spawn("app.workers:task", "app:process_host", config)
process.send(pid, "work", {item_id = 123})
```

## Escribir workflows

Los workflows son durables — sobreviven a caídas y reinicios. El código parece Lua normal. El runtime registra automáticamente los resultados de las llamadas a funciones, sleeps y valores aleatorios para que la reproducción sea determinista.

```lua
local function order_flow(order)
    local inventory = funcs.call("app:reserve_inventory", order.items)
    if not inventory then
        return nil, errors.new("out of stock")
    end

    local payment = funcs.call("app:charge_payment", order.total)
    if not payment then
        funcs.call("app:release_inventory", inventory.id)
        return nil, errors.new("payment failed")
    end

    -- Wait for approval signal (can block for days)
    local msg = process.inbox():receive()
    if not msg:payload():data().approved then
        funcs.call("app:refund_payment", payment.id)
        funcs.call("app:release_inventory", inventory.id)
        return nil, errors.new("rejected")
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

-- Asynchronous (returns Future)
local future = funcs.async("namespace:function_name", arg1)
local result, err = future:result()

-- With context
local exec = funcs.new():with_context({user_id = "123"})
exec:call("namespace:function_name")
```

### Comunicación entre procesos

```lua
-- Send message (fire-and-forget)
process.send(pid, "topic", data)

-- Receive messages
local inbox = process.inbox()
local msg, ok = inbox:receive()
local topic = msg:topic()
local data = msg:payload():data()

-- Monitor another process (receive EXIT on death)
process.monitor(pid)

-- Link processes (bidirectional failure notification)
process.spawn_linked("namespace:name", "host")
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
local db = sql.get("app:main_db")
local rows, err = db:query("SELECT * FROM users WHERE active = $1", true)
db:execute("INSERT INTO users (name) VALUES ($1)", name)

-- Key-value store
local store = require("store")
local cache = store.get("app:cache")
cache:set("key", value, 3600)  -- TTL in seconds
local val = cache:get("key")

-- Queue
local queue = require("queue")
queue.publish("app:tasks", {task = "process", id = 123})

-- Filesystem
local fs = require("fs")
local vol = fs.get("app:storage")
local data = vol:readfile("path/to/file.txt")
vol:writefile("output.txt", content)
```

### Cliente HTTP

```lua
local http_client = require("http_client")

local resp, err = http_client.get("https://api.example.com/data", {
    headers = {Authorization = "Bearer token"},
    timeout = "10s"
})
local body = resp.body
```

### Seguridad

```lua
local security = require("security")

local actor = security.actor()       -- who is calling
local scope = security.scope()       -- what permissions apply
local allowed = security.can("read", "resource:users")

-- Token management
local ts = security.token_store("app:tokens")
local token = ts:create(actor, scope, {expiration = "24h"})
local validated_actor, validated_scope = ts:validate(token)
```

### Tiempo

```lua
local time = require("time")

time.sleep("5s")
local now = time.now()
local timeout = time.after("30s")  -- channel that fires once
local ticker = time.ticker("10s")  -- repeating channel
```

### Registro

```lua
local registry = require("registry")

local entry = registry.get("app.api:get_user")
local tests = registry.find({["meta.type"] = "test"})

-- Create entries at runtime
local snap = registry.snapshot()
local changes = snap:changes()
changes:create({id = "app:new_func", kind = "function.lua", data = {...}})
changes:apply()
```

### Eventos

```lua
local events = require("events")

-- Publish
events.send("orders", "order.created", "/orders/123", {order_id = "123"})

-- Subscribe (wildcards supported)
local sub = events.subscribe("orders.*")
local ch = sub:channel()
local evt = ch:receive()
```

## Control de acceso a módulos

Cada entrada declara qué módulos puede hacer `require()`. Los módulos no listados simplemente no están disponibles — no hay `os.execute`, `io.open`, `debug.*` ni `package.*` a menos que los concedas explícitamente. El runtime no escanea ni valida el código fuente; controla el acceso a nivel de módulo. Si un módulo no está en la lista, no existe para esa entrada.

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

La documentación completa está disponible en [wippy.ai/docs](https://wippy.ai/docs). Endpoints amigables para LLM:

- Explorar estructura: `https://wippy.ai/llm/toc`
- Búsqueda: `https://wippy.ai/llm/search?q=query`
- Obtener página: `https://wippy.ai/llm/path/en/<path>`
- Obtención por lotes: `https://wippy.ai/llm/context?paths=path1,path2`
