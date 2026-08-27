---
title: "Funciones"
description: "Cómo definir y llamar funciones, propagar contexto, configurar pools y aplicar interceptors."
---

# Funciones

Las funciones son puntos de entrada de llamada y retorno. Una función hereda el contexto de su caller y se cancela cuando este se cancela. Los pools pueden reutilizar estados Lua, por lo que los globals de módulo y los upvalues de closures pueden sobrevivir en un worker, pero no se comparten de forma coherente entre llamadas. Guarda fuera de la función el estado durable o compartido. Usa funciones para handlers HTTP, endpoints de API y otras operaciones que terminen dentro del ciclo de vida de un request.

## Llamar funciones

Llama funciones de forma síncrona con `funcs.call()`:

```lua
local funcs = require("funcs")
local result, err = funcs.call("app.api:get_user", user_id)
if err then return nil, err end
return result
```

Para ejecución no bloqueante, usa `funcs.async()`:

```lua
local future, err = funcs.async("app.process:analyze", data)
if err then
    return nil, err
end

local ch = future:response()
local payload, open = ch:receive()
if not open then
    return nil, "future response channel closed"
end

local result, err = payload:data()
if err then
    return nil, err
end
```

Consulta el [módulo funcs](../lua/core/funcs.md) para la invocación de funciones y las opciones del executor.

## Propagación del contexto

Cada llamada crea un frame con su propio scope de contexto. Las funciones child heredan el contexto del parent sin pasarlo de forma explícita:

```lua
local ctx = require("ctx")

local trace_id = ctx.get("trace_id")
local user_id = ctx.get("user_id")
```

Añade contexto al llamar:

```lua
local funcs = require("funcs")

local exec, err = funcs.new():with_context({trace_id = "abc-123"})
if err then return nil, err end

local result, err = exec:call("app.api:process", data)
if err then return nil, err end
return result
```

El contexto de seguridad se propaga igual. Las funciones llamadas ven el actor del caller y pueden comprobar permisos. Consulta el [módulo security](../lua/security/security.md) para las API de control de acceso.

## Definición en el registro

En el registro, una entrada de función tiene esta forma:

```yaml
- name: get_user
  kind: function.lua
  source: file://handlers/user.lua
  method: get
  pool:
    type: lazy
    max_size: 16
```

Otros componentes del runtime pueden invocar funciones — handlers HTTP, queue consumers, scheduled jobs — y las llamadas están sujetas a comprobaciones de permisos basadas en el contexto de seguridad del caller.

## Pools

Las funciones se ejecutan en pools que gestionan la ejecución. El tipo de pool determina el comportamiento de scaling.

**Inline** se ejecuta en la goroutine del caller sin un pool de workers. Se usa para contextos embebidos.

**Static** mantiene un número fijo de workers. Los requests esperan en queue cuando todos están ocupados, manteniendo fija la concurrencia.

```yaml
pool:
  type: static
  size: 8
  buffer: 512
```

**Lazy** comienza sin workers y los crea bajo demanda. Los workers idle se eliminan tras un timeout.

```yaml
pool:
  type: lazy
  max_size: 32
```

**Adaptive** ajusta el número de workers según el throughput medido y la carga actual.

```yaml
pool:
  type: adaptive
  max_size: 256
```

<tip>
Prefiere un `type` de pool explícito. Para `type: static`, establece `size`; si también existe `workers`, proporciona el número de workers y aun así requiere un `size` positivo. En el modo implícito legacy, `workers > 0` junto con `size > 0` selecciona un pool static, `max_size > 0` sin workers selecciona uno lazy y `size` por sí solo deriva a ejecución inline.
</tip>

## Interceptors

Las llamadas a funciones pasan por una chain de interceptors. Estos pueden gestionar concerns transversales separados de la implementación de la función.

```yaml
- name: my_function
  kind: function.lua
  source: file://handler.lua
  method: main
  meta:
    options:
      retry:
        max_attempts: 3
        initial_delay: 100
        backoff_factor: 2.0
```

Los interceptors integrados incluyen reintentos con exponential backoff. Las integraciones del runtime escritas en Go pueden registrar interceptors adicionales para logging, métricas, tracing, autorización, circuit breaking o transformación de requests; las entradas de aplicación Lua solo pueden configurar interceptors instalados por el runtime.

La chain se ejecuta antes y después de cada llamada. Cada interceptor puede modificar el request, cortocircuitar la ejecución o envolver la response.

## Contratos

Las funciones pueden exponer sus schemas de entrada/salida como contratos. Los contratos definen signatures de métodos que permiten la validación en runtime y la generación de documentación.

```lua
local contract = require("contract")
local sender, err = contract.get("app.email:sender")
if err then return nil, err end

local email, err = sender:open("app.email:sender_impl")
if err then return nil, err end

local result, err = email:send({to = "user@example.com", subject = "Hello"})
if err then return nil, err end
return result
```

Los contratos permiten que los callers usen una interfaz mientras eligen por separado una implementación. Esto facilita pruebas, deployments multi-tenant y migraciones graduales.

## Funciones frente a procesos

Las funciones heredan el contexto y ciclo de vida del caller. Cuando este se cancela, también se cancelan sus llamadas. Esto es adecuado para la ejecución dentro de handlers HTTP y queue consumers.

Los procesos se ejecutan independientemente con contexto del host. Sobreviven a su creador y se comunican mediante mensajes. Usa procesos para trabajo en segundo plano y funciones para operaciones con scope de request.
