# Flujos de Trabajo

Los flujos de trabajo son operaciones durables y de larga duración que sobreviven fallos y reinicios. Proporcionan garantías de confiabilidad para procesos de negocio críticos como pagos, cumplimiento de pedidos, y aprobaciones de múltiples pasos.

## Por qué Flujos de Trabajo

Las funciones son efímeras: si el host falla, el trabajo en progreso se pierde. Los flujos de trabajo persisten su estado:

| Aspecto | Funciones | Flujos de Trabajo |
|--------|-----------|-----------|
| Estado | En memoria | Persistido |
| Fallo | Trabajo perdido | Se reanuda |
| Duración | Segundos a minutos | Horas a meses |
| Completación | Mejor esfuerzo | Garantizada |

## Cómo Funcionan los Flujos de Trabajo

El código del flujo de trabajo parece código Lua regular:

```lua
local funcs = require("funcs")
local time = require("time")

local result = funcs.call("app.api:charge_card", payment)
time.sleep("24h")
local status = funcs.call("app.api:check_status", result.id)

if status == "failed" then
    funcs.call("app.api:refund", result.id)
end
```

El motor de flujos de trabajo intercepta las llamadas y registra los resultados. Si el proceso falla, la ejecución se reproduce desde el historial: mismo código, mismos resultados.

<note>
Wippy maneja el determinismo automáticamente. Operaciones como <code>funcs.call()</code>, <code>time.sleep()</code>, <code>uuid.v4()</code>, y <code>time.now()</code> son interceptadas y sus resultados registrados. En el replay, los valores registrados se retornan en lugar de re-ejecutar.
</note>

## Patrones de Flujo de Trabajo

### Patrón Saga

Compensar en caso de fallo:

```lua
local funcs = require("funcs")

local inventory = funcs.call("app.inventory:reserve", items)
if inventory.error then
    return nil, inventory.error
end

local payment = funcs.call("app.payments:charge", amount)
if payment.error then
    funcs.call("app.inventory:release", inventory.id)
    return nil, payment.error
end

local shipping = funcs.call("app.shipping:create", order)
if shipping.error then
    funcs.call("app.payments:refund", payment.id)
    funcs.call("app.inventory:release", inventory.id)
    return nil, shipping.error
end

return {inventory = inventory, payment = payment, shipping = shipping}
```

### Esperando Señales

Esperar eventos externos (decisiones de aprobación, webhooks, acciones de usuario):

```lua
local funcs = require("funcs")

funcs.call("app.approvals:submit", request)

local inbox = process.inbox()
local msg = inbox:receive()  -- bloquea hasta que llega la señal

if msg.approved then
    funcs.call("app.orders:fulfill", request.order_id)
else
    funcs.call("app.notifications:send_rejection", request)
end
```

## Cuándo Usar Qué

| Caso de Uso | Elegir |
|----------|--------|
| Manejo de solicitudes HTTP | Funciones |
| Transformación de datos | Funciones |
| Trabajos en segundo plano | Procesos |
| Estado de sesión de usuario | Procesos |
| Mensajería en tiempo real | Procesos |
| Procesamiento de pagos | Flujos de Trabajo |
| Cumplimiento de pedidos | Flujos de Trabajo |
| Aprobaciones de varios días | Flujos de Trabajo |

## Iniciando Flujos de Trabajo

Los flujos de trabajo se crean de la misma manera que los procesos: usando `process.spawn()` con un host diferente:

```lua
-- Crear flujo de trabajo en worker temporal
local pid = process.spawn("app.workflows:order_processor", "app:temporal_worker", order_data)

-- Enviar señales al flujo de trabajo
process.send(pid, "update", {status = "approved"})
```

Desde la perspectiva del llamador, la API es idéntica. La diferencia es el host: los flujos de trabajo se ejecutan en un `temporal.worker` en lugar de un `process.host`.

<tip>
Cuando un flujo de trabajo crea hijos via <code>process.spawn()</code>, se convierten en flujos de trabajo hijos en el mismo proveedor, manteniendo las garantías de durabilidad.
</tip>

## Fallo y Supervisión

Los procesos pueden ejecutarse como servicios supervisados usando `process.service`:

```yaml
# Definición del proceso
- name: session_handler
  kind: process.lua
  source: file://session_handler.lua
  method: main

# Servicio supervisado envolviendo el proceso
- name: session_manager
  kind: process.service
  process: app:session_handler
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

Los flujos de trabajo no usan árboles de supervisión: son automáticamente gestionados por el proveedor de flujos de trabajo (Temporal). El proveedor maneja la persistencia, reintentos y recuperación.

## Configuración

Definición de proceso (creado dinámicamente):

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_processor.lua
  method: main
  modules:
    - funcs
    - time
```

Proveedor de flujos de trabajo:

```yaml
- name: temporal_worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "orders"
  lifecycle:
    auto_start: true
```

Consulte [Temporal](https://temporal.io) para infraestructura de flujos de trabajo en producción.

## Ver También

- [Funciones](concepts/functions.md) - Manejo de solicitudes sin estado
- [Modelo de Procesos](concepts/process-model.md) - Trabajo en segundo plano con estado
- [Supervisión](guides/supervision.md) - Políticas de reinicio de procesos
