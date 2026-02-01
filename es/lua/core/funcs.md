# Invocacion de Funciones
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

La forma principal de llamar otras funciones en Wippy. Ejecutar funciones registradas sincrona o asincronamente entre procesos, con soporte completo para propagacion de contexto, credenciales de seguridad y tiempos de espera. Este modulo es central para construir aplicaciones distribuidas donde los componentes necesitan comunicarse.

## Carga

```lua
local funcs = require("funcs")
```

## call

Llama una funcion registrada sincronamente. Use esto cuando necesite un resultado inmediato y pueda esperarlo.

```lua
local result, err = funcs.call("app.api:get_user", user_id)
if err then
    return nil, err
end
print(result.name)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `target` | string | ID de funcion en formato "namespace:name" |
| `...args` | any | Argumentos pasados a la funcion |

**Devuelve:** `result, error`

El string target sigue el patron `namespace:name` donde namespace identifica el modulo y name identifica la funcion especifica.

## async

Inicia una llamada de funcion asincrona y devuelve inmediatamente con un Future. Use esto para operaciones de larga duracion donde no quiere bloquear, o cuando quiere ejecutar multiples operaciones en paralelo.

```lua
-- Iniciar computo pesado sin bloquear
local future, err = funcs.async("app.process:analyze_data", large_dataset)
if err then
    return nil, err
end

-- Hacer otro trabajo mientras el computo se ejecuta...

-- Esperar resultado cuando este listo
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `target` | string | ID de funcion en formato "namespace:name" |
| `...args` | any | Argumentos pasados a la funcion |

**Devuelve:** `Future, error`

## new

Crea un nuevo Executor para construir llamadas de funcion con contexto personalizado. Use esto cuando necesite propagar contexto de solicitud, establecer credenciales de seguridad o configurar tiempos de espera.

```lua
local exec = funcs.new()
```

**Devuelve:** `Executor, error`

## Executor

Constructor para llamadas de funcion con opciones de contexto personalizado. Los metodos devuelven nuevas instancias de Executor (encadenamiento inmutable), por lo que puede reutilizar una configuracion base.

### with_context

Agrega valores de contexto que estaran disponibles para la funcion llamada. Use esto para propagar datos con alcance de solicitud como IDs de traza, sesiones de usuario o banderas de caracteristicas.

```lua
-- Propagar contexto de solicitud a servicios downstream
local exec = funcs.new():with_context({
    request_id = ctx.get("request_id"),
    feature_flags = {dark_mode = true}
})

local user, err = exec:call("app.api:get_user", user_id)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `values` | table | Pares clave-valor para agregar al contexto |

**Devuelve:** `Executor, error`

### with_actor

Establece el actor de seguridad para verificaciones de autorizacion en la funcion llamada. Use esto cuando llame una funcion en nombre de un usuario especifico.

```lua
local security = require("security")
local actor = security.actor()  -- Obtener actor del usuario actual

-- Llamar funcion admin con credenciales del usuario
local exec = funcs.new():with_actor(actor)
local result, err = exec:call("app.admin:delete_record", record_id)
if err and err:kind() == "PERMISSION_DENIED" then
    return nil, errors.new("PERMISSION_DENIED", "User cannot delete records")
end
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `actor` | Actor | Actor de seguridad (del modulo security) |

**Devuelve:** `Executor, error`

### with_scope

Establece el alcance de seguridad para funciones llamadas. Los alcances definen los permisos disponibles para la llamada.

```lua
local security = require("security")
local scope = security.new_scope()

local exec = funcs.new():with_scope(scope)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `scope` | Scope | Alcance de seguridad (del modulo security) |

**Devuelve:** `Executor, error`

### with_options

Establece opciones de llamada como tiempo de espera y prioridad. Use esto para operaciones que necesitan limites de tiempo.

```lua
-- Establecer tiempo de espera de 5 segundos para llamada API externa
local exec = funcs.new():with_options({timeout = 5000})
local result, err = exec:call("app.external:fetch_data", query)
if err then
    -- Manejar timeout u otro error
end
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `options` | table | Opciones especificas de implementacion |

**Devuelve:** `Executor, error`

### call / async

Versiones de Executor de call y async que usan el contexto configurado.

```lua
-- Construir executor reutilizable con contexto
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :with_options({timeout = 10000})

-- Hacer multiples llamadas con mismo contexto
local users, _ = exec:call("app.api:list_users")
local posts, _ = exec:call("app.api:list_posts")
```

## Future

Devuelto por llamadas `async()`. Representa una operacion asincrona en progreso.

### response / channel

Devuelve el canal subyacente para recibir el resultado.

```lua
local future, _ = funcs.async("app.api:slow_operation", data)
local ch = future:response()  -- o future:channel()

local result = channel.select {
    ch:case_receive(),
    timeout:case_receive()
}
```

**Devuelve:** `Channel`

### is_complete

Verificacion no bloqueante si el future ha completado.

```lua
while not future:is_complete() do
    -- hacer otro trabajo
    time.sleep("100ms")
end
local result, err = future:result()
```

**Devuelve:** `boolean`

### is_canceled

Devuelve true si `cancel()` fue llamado en este future.

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

**Devuelve:** `boolean`

### result

Devuelve el resultado cacheado si esta completo, o nil si aun esta pendiente.

```lua
local value, err = future:result()
if err then
    print("Failed:", err:message())
elseif value then
    print("Got:", value:data())
end
```

**Devuelve:** `Payload|nil, error|nil`

### error

Devuelve el error si el future fallo.

```lua
local err, has_error = future:error()
if has_error then
    print("Error kind:", err:kind())
end
```

**Devuelve:** `error|nil, boolean`

### cancel

Cancela la operacion asincrona.

```lua
future:cancel()
```

## Operaciones Paralelas

Ejecutar multiples operaciones concurrentemente usando async y channel.select.

```lua
-- Iniciar multiples operaciones en paralelo
local f1, _ = funcs.async("app.api:get_user", user_id)
local f2, _ = funcs.async("app.api:get_orders", user_id)
local f3, _ = funcs.async("app.api:get_preferences", user_id)

-- Esperar que todas completen usando canales
local user_ch = f1:channel()
local orders_ch = f2:channel()
local prefs_ch = f3:channel()

local results = {}
for i = 1, 3 do
    local r = channel.select {
        user_ch:case_receive(),
        orders_ch:case_receive(),
        prefs_ch:case_receive()
    }
    if r.channel == user_ch then
        results.user = r.value:data()
    elseif r.channel == orders_ch then
        results.orders = r.value:data()
    else
        results.prefs = r.value:data()
    end
end
```

## Permisos

Las operaciones de funcion estan sujetas a evaluacion de politica de seguridad.

| Accion | Recurso | Descripcion |
|--------|---------|-------------|
| `funcs.call` | ID de Funcion | Llamar una funcion especifica |
| `funcs.context` | `context` | Usar `with_context()` para establecer contexto personalizado |
| `funcs.security` | `security` | Usar `with_actor()` o `with_scope()` |

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Target vacio | `errors.INVALID` | no |
| Namespace faltante | `errors.INVALID` | no |
| Nombre faltante | `errors.INVALID` | no |
| Permiso denegado | `errors.PERMISSION_DENIED` | no |
| Suscripcion fallida | `errors.INTERNAL` | no |
| Error de funcion | varia | varia |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
