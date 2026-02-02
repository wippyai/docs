# Errores
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Manejo de errores estructurados con categorizacion y metadatos de reintento. Tabla global `errors` disponible sin require.

## Crear Errores

```lua
-- Mensaje simple (tipo por defecto UNKNOWN)
local err = errors.new("something went wrong")

-- Con tipo
local err = errors.new(errors.NOT_FOUND, "user not found")

-- Constructor completo
local err = errors.new({
    message = "user not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})
```

## Envolver Errores

Agregar contexto preservando tipo, reintentable y detalles:

```lua
local data, err = db.query("SELECT * FROM users")
if err then
    return nil, errors.wrap(err, "failed to load users")
end
```

## Metodos de Error

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `err:kind()` | string | Categoria de error |
| `err:message()` | string | Mensaje de error |
| `err:retryable()` | boolean/nil | Si la operación puede reintentarse |
| `err:details()` | table/nil | Metadatos estructurados |
| `err:stack()` | string | Traza de pila Lua |
| `tostring(err)` | string | Representacion completa |

## Verificar Tipo

```lua
if errors.is(err, errors.INVALID) then
    -- manejar entrada invalida
end

-- O comparar directamente
if err:kind() == errors.NOT_FOUND then
    -- manejar recurso faltante
end
```

## Tipos de Error

| Constante | Caso de Uso |
|----------|----------|
| `errors.NOT_FOUND` | Recurso no existe |
| `errors.ALREADY_EXISTS` | Recurso ya existe |
| `errors.INVALID` | Entrada o argumentos invalidos |
| `errors.PERMISSION_DENIED` | Acceso denegado |
| `errors.UNAVAILABLE` | Servicio temporalmente caido |
| `errors.INTERNAL` | Error interno |
| `errors.CANCELED` | Operación cancelada |
| `errors.CONFLICT` | Conflicto de estado de recurso |
| `errors.TIMEOUT` | Operación agoto tiempo |
| `errors.RATE_LIMITED` | Demasiadas solicitudes |
| `errors.UNKNOWN` | Error no especificado |

## Pila de Llamadas

Obtener pila de llamadas estructurada:

```lua
local stack = errors.call_stack(err)
if stack then
    print("Thread:", stack.thread)
    for _, frame in ipairs(stack.frames) do
        print(frame.source .. ":" .. frame.line, frame.name)
    end
end
```

## Errores Reintentables

| Tipicamente Reintentable | No Reintentable |
|--------------------------|-----------------|
| `TIMEOUT` | `INVALID` |
| `UNAVAILABLE` | `NOT_FOUND` |
| `RATE_LIMITED` | `PERMISSION_DENIED` |
| | `ALREADY_EXISTS` |

```lua
if err:retryable() then
    -- seguro para reintentar
end
```

## Detalles de Error

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
