# Futures
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Resultados de operaciones asincronas. Los futures son devueltos por `funcs.async()` y llamadas async de contrato.

## Carga

No es un módulo cargable. Los futures son creados por operaciones asincronas:

```lua
local funcs = require("funcs")
local future, err = funcs.async("app.compute:task", data)
```

## Canal de Respuesta

Obtener canal para recibir resultado:

```lua
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

`channel()` es un alias para `response()`.

## Verificacion de Completitud

Verificacion no bloqueante si el future completo:

```lua
if future:is_complete() then
    local result, err = future:result()
end
```

## Verificacion de Cancelacion

Verificar si `cancel()` fue llamado:

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

## Obtener Resultado

Obtener resultado cacheado (no bloqueante):

```lua
local val, err = future:result()
```

**Devuelve:**
- No completo: `nil, nil`
- Cancelado: `nil, error` (tipo `CANCELED`)
- Error: `nil, error`
- Exito: `Payload, nil` o `table, nil` (multiples payloads)

## Obtener Error

Obtener error si el future fallo:

```lua
local err, has_error = future:error()
if has_error then
    print("Failed:", err:message())
end
```

**Devuelve:** `error, boolean`

## Cancelar

Cancelar operación asincrona (mejor esfuerzo):

```lua
future:cancel()
```

La operación puede aun completarse si ya esta en progreso.

## Patrón de Timeout

```lua
local future = funcs.async("app.compute:slow", data)
local timeout = time.after("5s")

local r = channel.select {
    future:channel():case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    future:cancel()
    return nil, errors.new("TIMEOUT", "Operation timed out")
end

return r.value:data()
```

## Primero en Completar

```lua
local f1 = funcs.async("app.cache:get", key)
local f2 = funcs.async("app.db:get", key)

local r = channel.select {
    f1:channel():case_receive(),
    f2:channel():case_receive()
}

-- Cancelar el mas lento
if r.channel == f1:channel() then
    f2:cancel()
else
    f1:cancel()
end

return r.value:data()
```

## Errores

| Condición | Tipo |
|-----------|------|
| Operación cancelada | `CANCELED` |
| Operación asincrona fallida | varia |
