---
title: "Invocación de funciones"
description: "Llama funciones registradas de forma síncrona o asíncrona y propaga la solicitud, la seguridad y las opciones de llamada."
---

# Invocación de funciones
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

El módulo `funcs` llama funciones registradas de forma síncrona o asíncrona. Un
executor puede propagar el contexto de la solicitud, la identidad de seguridad y las
opciones de llamada específicas de la implementación. Esta página es una referencia
de API; los identificadores de destino, argumentos y datos de aplicación representan
el código circundante.

## Carga

```lua
local funcs = require("funcs")
```

## `call`

Llama una función registrada de forma síncrona y espera su resultado.

```lua
local result, err = funcs.call("app.api:get_user", user_id)
if err then
    return nil, err
end
print(result.name)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `target` | string | ID de función en formato "namespace:name" |
| `...args` | any | Argumentos pasados a la función |

**Devuelve:** `result, error`

El destino utiliza el formato `namespace:name`.

## `async`

Inicia una llamada a función y devuelve de inmediato un `Future`. Los futures permiten
continuar otro trabajo mientras se ejecuta la llamada y admiten varias llamadas concurrentes.

```lua
-- Start heavy computation without blocking
local future, err = funcs.async("app.process:analyze_data", large_dataset)
if err then
    return nil, err
end

-- Do other work while computation runs...

-- Wait for result when ready
local ch = future:response()
local _, open = ch:receive()
if not open then
    return nil, errors.new("future response channel closed")
end

local payload, result_err = future:result()
if result_err then
    return nil, result_err
end
local result, data_err = payload:data()
if data_err then return nil, data_err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `target` | string | ID de función en formato "namespace:name" |
| `...args` | any | Argumentos pasados a la función |

**Devuelve:** `Future, error`

## `new`

Crea un `Executor` para llamadas que necesitan contexto, identidad de seguridad u
opciones de llamada personalizados.

```lua
local exec = funcs.new()
```

**Devuelve:** `Executor`

## Executor

Un executor almacena el contexto y las opciones de llamada. Sus métodos de
configuración devuelven instancias nuevas, por lo que puede reutilizarse una
configuración base.

### `with_context`

Añade valores vinculados a la solicitud que estarán disponibles para la función
llamada, como identificadores de traza, datos de sesión o indicadores de funciones.

```lua
local ctx = require("ctx")

-- Propagate request context to downstream services
local request_id, ctx_err = ctx.get("request_id")
if ctx_err then return nil, ctx_err end

local exec, err = funcs.new():with_context({
    request_id = request_id,
    feature_flags = {dark_mode = true}
})
if err then return nil, err end

local user, err = exec:call("app.api:get_user", user_id)
if err then return nil, err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `values` | table | Pares clave-valor para agregar al contexto |

**Devuelve:** `Executor, error`

### `with_actor`

Establece el actor de seguridad que se usa en las comprobaciones de autorización de
la función llamada.

```lua
local security = require("security")
local actor = security.actor()  -- Get current user's actor

-- Call admin function with user's credentials
local exec, err = funcs.new():with_actor(actor)
if err then return nil, err end
local result, err = exec:call("app.admin:delete_record", record_id)
if err and err:kind() == errors.PERMISSION_DENIED then
    return nil, errors.new({
        message = "User cannot delete records",
        kind = errors.PERMISSION_DENIED
    })
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `actor` | Actor | Actor de seguridad (del módulo security) |

**Devuelve:** `Executor, error`

### `with_scope`

Establece el alcance de seguridad para funciones llamadas. Los alcances definen los permisos disponibles para la llamada.

```lua
local security = require("security")
local scope = security.new_scope()

local exec, err = funcs.new():with_scope(scope)
if err then return nil, err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `scope` | Scope | Alcance de seguridad (del módulo security) |

**Devuelve:** `Executor, error`

### `with_options`

Establece opciones de llamada. Las implementaciones pueden definir las suyas; el
runtime también reconoce `network` para seleccionar una red saliente.

```lua
-- Set a 5 second timeout for external API call
local exec, err = funcs.new():with_options({timeout = 5000})
if err then return nil, err end
local result, err = exec:call("app.external:fetch_data", query)
if err then
    -- Handle timeout or other error
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `options` | table | Opciones especificas de implementacion |

La opción definida por el runtime es:

| Opción reconocida | Tipo | Descripción |
|-------------------|------|-------------|
| `network` | string | ID de registro de la entrada `network.*` saliente |

**Devuelve:** `Executor, error`

Seleccionar una red requiere el permiso `network.select` sobre su identificador.

### `call` y `async`

Las versiones del executor de `call` y `async` usan su contexto y opciones configurados.

```lua
-- Build reusable executor with context
local exec, err = funcs.new():with_context({trace_id = "abc-123"})
if err then return nil, err end
exec, err = exec:with_options({timeout = 10000})
if err then return nil, err end

-- Make multiple calls with same context
local users, users_err = exec:call("app.api:list_users")
if users_err then return nil, users_err end
local posts, posts_err = exec:call("app.api:list_posts")
if posts_err then return nil, posts_err end
```

## Resumen de invocación con Future

`async()` devuelve un future que representa una invocación en curso. Los métodos de
abajo cubren los pasos del caller para recibir, inspeccionar o cancelar esa invocación.
Consulta [Future](./future.md) para la referencia del objeto Future.

### `response` y `channel`

Devuelve el canal subyacente para recibir el resultado.

```lua
local time = require("time")

local future, err = funcs.async("app.api:slow_operation", data)
if err then
    return nil, err
end
local ch = future:response()  -- or future:channel()

local timeout, err = time.after("5s")
if err then
    return nil, err
end

local result = channel.select {
    ch:case_receive(),
    timeout:case_receive()
}
```

**Devuelve:** `Channel`

El canal de respuesta indica que la operación terminó. Cuando esté listo, llama a
`future:result()` para obtener el valor almacenado o el error de la función llamada.

### `is_complete`

Verificacion no bloqueante si el future ha completado.

```lua
while not future:is_complete() do
    -- do other work
    local _, sleep_err = time.sleep("100ms")
    if sleep_err then return nil, sleep_err end
end
local result, err = future:result()
```

**Devuelve:** `boolean`

### `is_canceled`

Devuelve `true` si el proveedor marcó el future como cancelado. Consulta la
limitación de cancelación de abajo.

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

**Devuelve:** `boolean`

### `result`

Devuelve el resultado almacenado si está completo o `nil` si la operación sigue pendiente.

```lua
local value, err = future:result()
if err then
    print("Failed:", err:message())
elseif value then
    local data, data_err = value:data()
    if data_err then return nil, data_err end
    print("Got:", data)
end
```

**Devuelve:** `Payload|table|nil, error|nil`

### `error`

Devuelve el error si el future fallo.

```lua
local err, has_error = future:error()
if has_error then
    print("Error kind:", err:kind())
end
```

**Devuelve:** `error|nil, boolean`

Este método devuelve un wrapper `INTERNAL` no reintentable para una operación fallida.
Usa `result()` para conservar los metadatos originales del error de la función llamada.

### `cancel`

Cancela la operación asincrona.

```lua
local canceled, err = future:cancel()
if err then return nil, err end
```

**Devuelve:** `boolean, error`

<warning>
En el runtime v0.3.32a, los futures de funciones y contratos comparten un único
callback de cancelación global al proceso. Cuando se cargan ambos proveedores,
<code>cancel()</code> y <code>is_canceled()</code> no son un contrato estable entre
proveedores. No uses la cancelación para la corrección de la aplicación; aplica un
timeout local e ignora un resultado tardío hasta que el runtime separe la cancelación
de los proveedores.
</warning>

## Operaciones Paralelas

Combina `async` con `channel.select` para ejecutar y recopilar varias llamadas concurrentes.

```lua
-- Start multiple operations in parallel
local f1, err = funcs.async("app.api:get_user", user_id)
if err then return nil, err end
local f2, err = funcs.async("app.api:get_orders", user_id)
if err then return nil, err end
local f3, err = funcs.async("app.api:get_preferences", user_id)
if err then return nil, err end

-- Wait for all to complete using channels
local user_ch = f1:channel()
local orders_ch = f2:channel()
local prefs_ch = f3:channel()

local pending = {
    [user_ch] = {name = "user", future = f1},
    [orders_ch] = {name = "orders", future = f2},
    [prefs_ch] = {name = "preferences", future = f3}
}
local results = {}
while next(pending) do
    local cases = {}
    for ch in pairs(pending) do
        cases[#cases + 1] = ch:case_receive()
    end

    local r = channel.select(cases)
    local completed = pending[r.channel]
    pending[r.channel] = nil

    local payload, result_err = completed.future:result()
    if result_err then
        return nil, result_err
    end
    local data, data_err = payload:data()
    if data_err then
        return nil, data_err
    end
    results[completed.name] = data
end
```

## Permisos

Las operaciones de función estan sujetas a evaluacion de politica de seguridad.

| Accion | Recurso | Descripción |
|--------|---------|-------------|
| `funcs.call` | ID de Función | Llamar una función especifica |
| `funcs.context` | `context` | Usar `with_context()` para establecer contexto personalizado |
| `funcs.security` | `security` | Usar `with_actor()` o `with_scope()` |
| `network.select` | ID de red | Seleccionar una red saliente con `with_options()` |

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Target vacio | `errors.INVALID` | no |
| Namespace faltante | `errors.INVALID` | no |
| Nombre faltante | `errors.INVALID` | no |
| Permiso denegado | `errors.PERMISSION_DENIED` | no |
| Suscripcion fallida | `errors.INTERNAL` | no |
| Fallo al iniciar el dispatch asíncrono | `errors.INTERNAL` | no |
| Error de función | varia | varia |

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.
