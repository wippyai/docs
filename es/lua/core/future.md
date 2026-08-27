---
title: "Futures"
description: "Recibe, inspecciona y cancela resultados de llamadas asíncronas a funciones y contratos."
---

# Futures
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Los futures representan resultados de operaciones asíncronas. Los devuelven
`funcs.async()` y las llamadas asíncronas a contratos. Esta página es una referencia
de API; los identificadores de destino y argumentos de sus patrones los define la aplicación.

## Carga

No es un módulo cargable. Los futures son creados por operaciones asincronas:

```lua
local funcs = require("funcs")
local future, err = funcs.async("app.compute:task", data)
if err then
    return nil, err
end
```

## Canal de Respuesta

Usa el canal de respuesta para esperar a que termine la operación y lee después el
resultado almacenado en el future:

```lua
local ch = future:response()
local _, open = ch:receive()
if not open then
    return nil, errors.new("future response channel closed")
end

local payload, err = future:result()
if err then
    return nil, err
end
local result, data_err = payload:data()
if data_err then return nil, data_err end
```

`channel()` es un alias para `response()`.

El valor del canal es el payload, la tabla de payloads o el error de la operación.
Llamar a `result()` después de que el canal esté listo proporciona una única interfaz
para éxito y error y devuelve el valor almacenado incluso después de consumir el canal.

## Verificacion de Completitud

Comprueba sin bloquear si el future ha terminado:

```lua
if future:is_complete() then
    local result, err = future:result()
end
```

## Verificacion de Cancelacion

Comprueba si el proveedor marcó el future como cancelado:

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

## Obtener Resultado

Lee sin bloquear el resultado almacenado:

```lua
local val, err = future:result()
```

**Devuelve:**
- No completo: `nil, nil`
- Cancelado: `nil, error` (tipo `CANCELED`)
- Error: `nil, error`
- Exito: `Payload, nil` o `table, nil` (multiples payloads)

## Obtener Error

Lee el error cuando el future ha fallado:

```lua
local err, has_error = future:error()
if has_error then
    print("Failed:", err:message())
end
```

**Devuelve:** `error, boolean`

Cuando una operación falla, `error()` devuelve un wrapper `INTERNAL` no reintentable.
Usa `result()` cuando deban conservarse el tipo y la reintentabilidad del error original.

## Cancelar

Solicita la cancelación de la operación asíncrona con semántica de mejor esfuerzo:

```lua
local canceled, err = future:cancel()
```

La operación puede aun completarse si ya esta en progreso.

**Devuelve:** `boolean, error`

<warning>
En el runtime v0.3.32a, los futures de funciones y contratos comparten un único
callback de cancelación global al proceso. Cuando se cargan ambos proveedores,
<code>cancel()</code> y <code>is_canceled()</code> no son un contrato estable entre
proveedores. No uses la cancelación para la corrección de la aplicación; aplica un
timeout local e ignora un resultado tardío hasta que el runtime separe la cancelación
de los proveedores.
</warning>

## Patrón de Timeout

```lua
local time = require("time")

local future, err = funcs.async("app.compute:slow", data)
if err then
    return nil, err
end

local timeout, err = time.after("5s")
if err then
    return nil, err
end

local r = channel.select {
    future:channel():case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    -- The operation may still complete; this caller ignores the late result.
    return nil, errors.new({
        message = "Operation timed out",
        kind = errors.TIMEOUT
    })
end

local payload, result_err = future:result()
if result_err then
    return nil, result_err
end
local value, data_err = payload:data()
if data_err then return nil, data_err end
return value
```

## Primero en Completar

```lua
local f1, err = funcs.async("app.cache:get", key)
if err then
    return nil, err
end
local f2, err = funcs.async("app.db:get", key)
if err then
    return nil, err
end

local ch1 = f1:channel()
local ch2 = f2:channel()

local r = channel.select {
    ch1:case_receive(),
    ch2:case_receive()
}

-- The slower operation may still complete; this caller ignores its result.
local winner
if r.channel == ch1 then
    winner = f1
else
    winner = f2
end

local payload, result_err = winner:result()
if result_err then
    return nil, result_err
end
local value, data_err = payload:data()
if data_err then return nil, data_err end
return value
```

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Operación cancelada mediante `result()` | `errors.CANCELED` | no |
| Fallo de operación devuelto por `result()` | varía | se conserva del error de la función |
| Fallo de operación devuelto por `error()` | `errors.INTERNAL` | no |
| Fallo del dispatch de cancelación | `errors.INTERNAL` | no |
