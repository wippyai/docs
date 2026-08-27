---
title: "Contratos"
description: "Abre bindings de servicios tipados, inspecciona contratos, llama implementaciones y propaga el contexto de llamada o seguridad."
---

# Contratos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

El módulo `contract` abre bindings de servicios tipados para API remotas, workflows y
funciones. Los contratos admiten validación de esquema, llamadas asíncronas y
propagación del contexto de llamada. Esta página es una referencia de API; los IDs y
valores como `current_user` representan entradas y estado circundante de la aplicación.

## Carga

```lua
local contract = require("contract")
```

## Abrir un Binding

Abrir un binding directamente por ID:

```lua
local greeter, err = contract.open("app.services:greeter")
if err then
    return nil, err
end

local result, err = greeter:say_hello("Alice")
if err then
    return nil, err
end
```

Con contexto de alcance o parametros de consulta:

```lua
-- With scope table
local svc, err = contract.open("app.services:user", {
    tenant_id = "acme",
    region = "us-east"
})

-- With query parameters (auto-converted: "true"→bool, numbers→int/float)
local api, err = contract.open("app.services:api?debug=true&timeout=5000")

-- With call options (third argument)
local inst, err = contract.open("app.services:flaky", nil, {
    retry = { max_attempts = 5, initial_delay = 100 }
})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `binding_id` | string | ID de binding, soporta parametros de consulta |
| `scope` | table | Valores de contexto (opcional, sobrescribe parametros de consulta) |
| `options` | table | Opciones de llamada (opcional) — ej. `retry.max_attempts`, `retry.initial_delay` |

**Devuelve:** `Instance, error`

## Obtener un Contrato

Recuperar definicion de contrato para introspeccion:

```lua
local c, err = contract.get("app.services:greeter")
if err then
    return nil, err
end

print(c:id())  -- "app.services:greeter"

local methods = c:methods()
for _, m in ipairs(methods) do
    print(m.name, m.description)
end

local method, err = c:method("say_hello")
if err then
    return nil, err
end
```

### Definicion de Método

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | string | Nombre del método |
| `description` | string | Descripción del método |
| `input_schemas` | table[] o nil | Definiciones de esquema de entrada; se omite si está vacío |
| `output_schemas` | table[] o nil | Definiciones de esquema de salida; se omite si está vacío |

Cada elemento de esquema contiene un string `format` y puede incluir un valor `definition`.

## Encontrar Implementaciones

Listar todos los bindings que implementan un contrato:

```lua
local bindings, err = contract.find_implementations("app.services:greeter")
if err then
    return nil, err
end

for _, binding_id in ipairs(bindings) do
    print(binding_id)
end
```

O via objeto de contrato:

```lua
local c, err = contract.get("app.services:greeter")
if err then
    return nil, err
end
local bindings, err = c:implementations()
if err then
    return nil, err
end
```

## Verificar Implementacion

Verificar si una instancia implementa un contrato:

```lua
if contract.is(instance, "app.services:greeter") then
    instance:say_hello("World")
end
```

## Llamar Metodos

Llamada sincrona - bloquea hasta completar:

```lua
local calc, err = contract.open("app.services:calculator")
if err then
    return nil, err
end

local sum, err = calc:add(10, 20)
if err then
    return nil, err
end
local product, err = calc:multiply(5, 6)
if err then
    return nil, err
end
```

## Llamadas Asincronas

Agregar sufijo `_async` para ejecución asincrona:

```lua
local processor, err = contract.open("app.services:processor")
if err then
    return nil, err
end

local future, err = processor:process_async(large_dataset)
if err then
    return nil, err
end

-- Do other work...

-- Wait for result
local ch = future:response()
local _, open = ch:receive()
if not open then
    return nil, errors.new("future response channel closed")
end

local payload, result_err = future:result()
if result_err then return nil, result_err end
local result, data_err = payload:data()
if data_err then return nil, data_err end
```

Consulta [Futures](./future.md) para conocer sus métodos.

## Abrir via Contrato

Abre un binding mediante un objeto de contrato. Las llamadas siguientes son
alternativas; comprueba el error de `contract.get()` y de la llamada `open()` elegida
antes de usar la instancia.

```lua
local c, err = contract.get("app.services:user")
if err then
    return nil, err
end

-- Default binding
local instance, err = c:open()

-- Specific binding
local instance, err = c:open("app.services:user_impl")

-- With scope
local instance, err = c:open(nil, {user_id = 123})
local instance, err = c:open("app.services:user_impl", {user_id = 123})
```

## Agregar Contexto

Crear envoltorio con contexto preconfigurado:

```lua
local ctx = require("ctx")
local c, err = contract.get("app.services:user")
if err then return nil, err end

local request_id, ctx_err = ctx.get("request_id")
if ctx_err then return nil, ctx_err end

local wrapped, err = c:with_context({
    request_id = request_id,
    user_id = current_user.id
})
if err then return nil, err end

local instance, err = wrapped:open()
```

## Opciones de Llamada

Configura reintentos y otro comportamiento de llamada vía `with_options`:

```lua
local c, err = contract.get("app.services:flaky")
if err then return nil, err end

local configured = c:with_options({
    retry = { max_attempts = 5, initial_delay = 100 }
})
local inst, err = configured:open("app.services:flaky_impl")
if err then return nil, err end

local result, err = inst:call()
```

Las opciones se aplican a cada llamada de método de la instancia devuelta. Solo los
errores reintentables disparan reintentos; los demás vuelven de inmediato.
`with_options` puede encadenarse con `with_context`, `with_actor` y `with_scope`.

| Opción | Tipo | Descripción |
|--------|------|-------------|
| `retry.max_attempts` | int | Intentos máximos incluyendo el primero (1 desactiva reintentos) |
| `retry.initial_delay` | int/duration | Retardo antes del primer reintento (ms o cadena de duración) |

## Contexto de Seguridad

Establecer actor y alcance para autorizacion:

```lua
local security = require("security")
local c, err = contract.get("app.services:admin")
if err then return nil, err end

local secured, err = c:with_actor(security.actor())
if err then return nil, err end

secured, err = secured:with_scope(security.scope())
if err then return nil, err end

local admin, err = secured:open()
if err then return nil, err end
```

Sin `with_actor`/`with_scope` explícitos, un contrato abierto hereda el actor y el scope ambientales del llamador. Cuando se establecen, se propagan a las funciones de implementación enlazadas — cada llamada de método en la instancia se ejecuta bajo esa identidad.

## Permisos

| Permiso | Recurso | Funciones |
|---------|---------|-----------|
| `contract.get` | id de contrato | `get()` |
| `contract.open` | id de binding | `open()`, `Contract:open()` |
| `contract.implementations` | id de contrato | `find_implementations()`, `Contract:implementations()` |
| `contract.call` | nombre de método | llamadas de método sync y async |
| `contract.context` | "context" | `Contract:with_context()` |
| `contract.security` | "security" | `Contract:with_actor()`, `Contract:with_scope()` |

## Errores

| Condición | Tipo |
|-----------|------|
| Formato de ID de binding invalido | `errors.INVALID` |
| Contrato no encontrado | `errors.NOT_FOUND` |
| Binding no encontrado | `errors.NOT_FOUND` |
| Método no encontrado | `errors.NOT_FOUND` |
| Sin binding por defecto | `errors.NOT_FOUND` |
| Permiso denegado | `errors.PERMISSION_DENIED` |
| Fallo del dispatcher del contrato o de conversión de respuesta | `errors.INTERNAL` |
| La implementación devolvió un error | Conserva el tipo de error de la implementación |
