# Funciones

Las funciones son puntos de entrada sincronos y sin estado. Las llama, se ejecutan, retornan un resultado. Cuando una funcion se ejecuta, hereda el contexto del llamador: si el llamador cancela, la funcion tambien se cancela. Esto hace que las funciones sean ideales para manejadores HTTP, endpoints de API, y cualquier operacion que deba completarse dentro del ciclo de vida de una solicitud.

## Llamando Funciones

Llame funciones sincronamente con `funcs.call()`:

```lua
local funcs = require("funcs")
local result, err = funcs.call("app.api:get_user", user_id)
```

Para ejecucion no bloqueante, use `funcs.async()`:

```lua
local future = funcs.async("app.process:analyze", data)

local ch = future:response()
local result, ok = ch:receive()
```

Consulte el [modulo funcs](lua-funcs.md) para la API completa.

## Propagacion de Contexto

Cada llamada crea un frame con su propio scope de contexto. Las funciones hijas heredan el contexto padre sin pasarlo explicitamente:

```lua
local ctx = require("ctx")

local trace_id = ctx.get("trace_id")
local user_id = ctx.get("user_id")
```

Agregue contexto al llamar:

```lua
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :call("app.api:process", data)
```

El contexto de seguridad se propaga de la misma manera. Las funciones llamadas ven el actor del llamador y pueden verificar permisos. Consulte el [modulo security](lua-security.md) para APIs de control de acceso.

## Definicion en Registro

A nivel de registro, una entrada de funcion se ve asi:

```yaml
- name: get_user
  kind: function.lua
  source: file://handlers/user.lua
  method: get
  pool:
    type: lazy
    max_size: 16
```

Las funciones pueden ser invocadas por otros componentes del runtime: manejadores HTTP, consumidores de cola, trabajos programados, y estan sujetas a verificaciones de permisos basadas en el contexto de seguridad del llamador.

## Pools

Las funciones se ejecutan en pools que gestionan la ejecucion. El tipo de pool determina el comportamiento de escalado.

**Inline** se ejecuta en la goroutine del llamador. Sin concurrencia, cero overhead de asignacion. Usado para contextos embebidos.

**Static** mantiene un numero fijo de workers. Las solicitudes se encolan cuando todos los workers estan ocupados. Uso de recursos predecible.

```yaml
pool:
  type: static
  workers: 8
  buffer: 512
```

**Lazy** comienza vacio y crea workers bajo demanda. Los workers inactivos se destruyen despues de un timeout. Eficiente para trafico variable.

```yaml
pool:
  type: lazy
  max_size: 32
```

**Adaptive** escala automaticamente basado en throughput. El controlador mide el rendimiento y ajusta el conteo de workers para optimizar para la carga actual.

```yaml
pool:
  type: adaptive
  max_size: 256
```

<tip>
Si no especifica un tipo de pool, el runtime selecciona uno basado en su configuracion. Establezca `workers` para static, `max_size` para lazy, o establezca `type` explicitamente para control total.
</tip>

## Interceptores

Las llamadas de funcion pasan a traves de una cadena de interceptores. Los interceptores manejan preocupaciones transversales sin tocar la logica de negocio.

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

Los interceptores incorporados incluyen reintento con backoff exponencial. Puede agregar interceptores personalizados para logging, metricas, tracing, autorizacion, circuit breaking, o transformacion de solicitudes.

La cadena se ejecuta antes y despues de cada llamada. Cada interceptor puede modificar la solicitud, cortocircuitar la ejecucion, o envolver la respuesta.

## Contratos

Las funciones pueden exponer sus esquemas de entrada/salida como contratos. Los contratos definen firmas de metodos que habilitan validacion en tiempo de ejecucion y generacion de documentacion.

```lua
local contract = require("contract")
local email = contract.get("app.email:sender")
email:send({to = "user@example.com", subject = "Hola"})
```

Esta abstraccion le permite intercambiar implementaciones sin cambiar el codigo que las llama, util para pruebas, despliegues multi-tenant, o migraciones graduales.

## Funciones vs Procesos

Las funciones heredan el contexto del llamador y se vinculan al ciclo de vida del llamador. Cuando el llamador cancela, las funciones cancelan. Esto habilita la ejecucion en el borde: ejecutar directamente en manejadores HTTP y consumidores de cola.

Los procesos se ejecutan independientemente con el contexto del host. Sobreviven a su creador y se comunican mediante mensajes. Use procesos para trabajo en segundo plano; use funciones para operaciones con scope de solicitud.
