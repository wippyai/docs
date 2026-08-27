---
title: "Errores"
description: "Crea, envuelve, inspecciona y clasifica errores estructurados en entradas Lua."
---

# Errores
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

La tabla global `errors` crea e inspecciona errores estructurados con categorías, detalles y metadatos de reintento. Está disponible sin `require`.

Esta es una referencia de API. Cada bloque de código es un fragmento aislado, no una entrada completa. Variables como `err` hacen referencia a un error devuelto o creado por el código circundante de la aplicación; el ejemplo de envoltura presupone que `db` es un cliente de base de datos proporcionado por la aplicación.

## Creación de errores

```lua
-- Simple message (kind defaults to UNKNOWN)
local err = errors.new("something went wrong")

-- With kind, retryable, and details
local err = errors.new({
    message = "user not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})
```

`errors.new` acepta un mensaje de cadena o una tabla con al menos un campo `message`. La forma `(kind, message)` no es compatible.

## Envoltura de errores

Envuelve un error para añadir contexto conservando su clase, los metadatos de reintento y los detalles:

```lua
local data, err = db:query("SELECT * FROM users")
if err then
    return nil, errors.wrap(err, "failed to load users")
end
```

## Métodos de error

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `err:kind()` | string | Categoría de error |
| `err:message()` | string | Mensaje de error |
| `err:retryable()` | boolean/nil | Si la operación puede reintentarse |
| `err:details()` | table/nil | Metadatos estructurados |
| `err:stack()` | string | Traza de pila Lua |
| `tostring(err)` | string | Representación completa |

## Comprobación de la clase

```lua
if errors.is(err, errors.INVALID) then
    -- handle invalid input
end

-- Or compare directly
if err:kind() == errors.NOT_FOUND then
    -- handle missing resource
end
```

## Clases de error

| Constante | Caso de uso |
|----------|----------|
| `errors.NOT_FOUND` | El recurso no existe |
| `errors.ALREADY_EXISTS` | Recurso ya existe |
| `errors.INVALID` | Entrada o argumentos no válidos |
| `errors.PERMISSION_DENIED` | Acceso denegado |
| `errors.UNAVAILABLE` | Servicio temporalmente no disponible |
| `errors.INTERNAL` | Error interno |
| `errors.CANCELED` | Operación cancelada |
| `errors.CONFLICT` | Conflicto de estado de recurso |
| `errors.TIMEOUT` | La operación agotó el tiempo de espera |
| `errors.RATE_LIMITED` | Demasiadas solicitudes |
| `errors.UNKNOWN` | Error no especificado |

## Pila de llamadas

Usa `errors.call_stack` para inspeccionar una pila de llamadas estructurada:

```lua
local stack = errors.call_stack(err)
if stack then
    print("Thread:", stack.thread)
    for _, frame in ipairs(stack.frames) do
        print(frame.source .. ":" .. frame.line, frame.name)
    end
end
```

## Errores reintentables

La posibilidad de reintentar es un metadato del error, no una propiedad garantizada por su clase. Comprueba el valor devuelto por `err:retryable()` en lugar de inferirlo de `err:kind()`. Un resultado `nil` significa que el error no especifica si resulta apropiado volver a intentarlo.

```lua
if err:retryable() then
    -- safe to retry
end
```

## Detalles del error

```lua
local err = errors.new({
    message = "validation failed",
    kind = errors.INVALID,
    details = {
        errors = {
            {field = "email", message = "invalid format"},
            {field = "age", message = "must be positive"}
        }
    }
})

local details = err:details()
for _, e in ipairs(details.errors) do
    print(e.field, e.message)
end
```
