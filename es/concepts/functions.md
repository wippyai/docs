# Funciones

Las funciones son puntos de entrada síncronos y sin estado. Las llama, se ejecutan, retornan un resultado. Cuando una función se ejecuta, hereda el contexto del llamador: si el llamador cancela, la función también se cancela. Esto hace que las funciones sean ideales para manejadores HTTP, endpoints de API, y cualquier operación que deba completarse dentro del ciclo de vida de una solicitud.

## Llamando Funciones

Llame funciones síncronamente con `funcs.call()`:

```lua
local funcs = require("funcs")
local result, err = funcs.call("app.api:get_user", user_id)
```

Para ejecución no bloqueante, use `funcs.async()`:

```lua
local future = funcs.async("app.process:analyze", data)

local ch = future:response()
local result, ok = ch:receive()
```

Consulte el [módulo funcs](lua/core/funcs.md) para la API completa.

## Propagación de Contexto

Cada llamada crea un frame con su propio scope de contexto. Las funciones hijas heredan el contexto padre sin pasarlo explícitamente:

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

El contexto de seguridad se propaga de la misma manera. Las funciones llamadas ven el actor del llamador y pueden verificar permisos. Consulte el [módulo security](lua/security/security.md) para APIs de control de acceso.

## Definición en Registro

A nivel de registro, una entrada de función se ve así:

```yaml
- name: get_user
  kind: function.lua
  source: file://handlers/user.lua
  method: get
  pool:
    type: lazy
    max_size: 16
```

Las funciones pueden ser invocadas por otros componentes del runtime: manejadores HTTP, consumidores de cola, trabajos programados, y están sujetas a verificaciones de permisos basadas en el contexto de seguridad del llamador.

## Pools

Las funciones se ejecutan en pools que gestionan la ejecución. El tipo de pool determina el comportamiento de escalado.

**Inline** se ejecuta en la goroutine del llamador. Sin concurrencia, cero overhead de asignación. Usado para contextos embebidos.

**Static** mantiene un número fijo de workers. Las solicitudes se encolan cuando todos los workers están ocupados. Uso de recursos predecible.

```yaml
pool:
  type: static
  workers: 8
  buffer: 512
```

**Lazy** comienza vacío y crea workers bajo demanda. Los workers inactivos se destruyen después de un timeout. Eficiente para tráfico variable.

```yaml
pool:
  type: lazy
  max_size: 32
```

**Adaptive** escala automáticamente basado en throughput. El controlador mide el rendimiento y ajusta el conteo de workers para optimizar para la carga actual.

```yaml
pool:
  type: adaptive
  max_size: 256
```

<tip>
Si no especifica un tipo de pool, el runtime selecciona uno basado en su configuración. Establezca `workers` para static, `max_size` para lazy, o establezca `type` explícitamente para control total.
</tip>

## Interceptores

Las llamadas de función pasan a través de una cadena de interceptores. Los interceptores manejan preocupaciones transversales sin tocar la lógica de negocio.

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

Los interceptores incorporados incluyen reintento con backoff exponencial. Puede agregar interceptores personalizados para logging, métricas, tracing, autorización, circuit breaking, o transformación de solicitudes.

La cadena se ejecuta antes y después de cada llamada. Cada interceptor puede modificar la solicitud, cortocircuitar la ejecución, o envolver la respuesta.

## Contratos

Las funciones pueden exponer sus esquemas de entrada/salida como contratos. Los contratos definen firmas de métodos que habilitan validación en tiempo de ejecución y generación de documentación.

```lua
local contract = require("contract")
local email = contract.get("app.email:sender")
email:send({to = "user@example.com", subject = "Hola"})
```

Esta abstracción le permite intercambiar implementaciones sin cambiar el código que las llama, útil para pruebas, despliegues multi-tenant, o migraciones graduales.

## Funciones vs Procesos

Las funciones heredan el contexto del llamador y se vinculan al ciclo de vida del llamador. Cuando el llamador cancela, las funciones cancelan. Esto habilita la ejecución en el borde: ejecutar directamente en manejadores HTTP y consumidores de cola.

Los procesos se ejecutan independientemente con el contexto del host. Sobreviven a su creador y se comunican mediante mensajes. Use procesos para trabajo en segundo plano; use funciones para operaciones con scope de solicitud.
