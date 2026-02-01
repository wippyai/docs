# Contratos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

Invocar servicios a traves de contratos tipados. Llamar APIs remotas, flujos de trabajo y funciones con validacion de esquema y soporte de ejecucion asincrona.

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
```

Con contexto de alcance o parametros de consulta:

```lua
-- Con tabla de alcance
local svc, err = contract.open("app.services:user", {
    tenant_id = "acme",
    region = "us-east"
})

-- Con parametros de consulta (auto-convertidos: "true"->bool, numeros->int/float)
local api, err = contract.open("app.services:api?debug=true&timeout=5000")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `binding_id` | string | ID de binding, soporta parametros de consulta |
| `scope` | table | Valores de contexto (opcional, sobrescribe parametros de consulta) |

**Devuelve:** `Instance, error`

## Obtener un Contrato

Recuperar definicion de contrato para introspeccion:

```lua
local c, err = contract.get("app.services:greeter")

print(c:id())  -- "app.services:greeter"

local methods = c:methods()
for _, m in ipairs(methods) do
    print(m.name, m.description)
end

local method, err = c:method("say_hello")
```

### Definicion de Metodo

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `name` | string | Nombre del metodo |
| `description` | string | Descripcion del metodo |
| `input_schemas` | table[] | Definiciones de esquema de entrada |
| `output_schemas` | table[] | Definiciones de esquema de salida |

## Encontrar Implementaciones

Listar todos los bindings que implementan un contrato:

```lua
local bindings, err = contract.find_implementations("app.services:greeter")

for _, binding_id in ipairs(bindings) do
    print(binding_id)
end
```

O via objeto de contrato:

```lua
local c, err = contract.get("app.services:greeter")
local bindings, err = c:implementations()
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

local sum, err = calc:add(10, 20)
local product, err = calc:multiply(5, 6)
```

## Llamadas Asincronas

Agregar sufijo `_async` para ejecucion asincrona:

```lua
local processor, err = contract.open("app.services:processor")

local future, err = processor:process_async(large_dataset)

-- Hacer otro trabajo...

-- Esperar resultado
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

Consulte [Futures](lua-future.md) para metodos de future.

## Abrir via Contrato

Abrir binding a traves de objeto de contrato:

```lua
local c, err = contract.get("app.services:user")

-- Binding por defecto
local instance, err = c:open()

-- Binding especifico
local instance, err = c:open("app.services:user_impl")

-- Con alcance
local instance, err = c:open(nil, {user_id = 123})
local instance, err = c:open("app.services:user_impl", {user_id = 123})
```

## Agregar Contexto

Crear envoltorio con contexto preconfigurado:

```lua
local c, err = contract.get("app.services:user")

local wrapped = c:with_context({
    request_id = ctx.get("request_id"),
    user_id = current_user.id
})

local instance, err = wrapped:open()
```

## Contexto de Seguridad

Establecer actor y alcance para autorizacion:

```lua
local security = require("security")
local c, err = contract.get("app.services:admin")

local secured = c:with_actor(security.actor()):with_scope(security.scope())

local admin, err = secured:open()
```

## Permisos

| Permiso | Recurso | Funciones |
|---------|---------|-----------|
| `contract.get` | id de contrato | `get()` |
| `contract.open` | id de binding | `open()`, `Contract:open()` |
| `contract.implementations` | id de contrato | `find_implementations()`, `Contract:implementations()` |
| `contract.call` | nombre de metodo | llamadas de metodo sync y async |
| `contract.context` | "context" | `Contract:with_context()` |
| `contract.security` | "security" | `Contract:with_actor()`, `Contract:with_scope()` |

## Errores

| Condicion | Tipo |
|-----------|------|
| Formato de ID de binding invalido | `errors.INVALID` |
| Contrato no encontrado | `errors.NOT_FOUND` |
| Binding no encontrado | `errors.NOT_FOUND` |
| Metodo no encontrado | `errors.NOT_FOUND` |
| Sin binding por defecto | `errors.NOT_FOUND` |
| Permiso denegado | `errors.PERMISSION_DENIED` |
| Llamada fallida | `errors.INTERNAL` |
