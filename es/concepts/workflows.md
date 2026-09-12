---
title: "Flujos de trabajo"
description: "Cómo Wippy persiste flujos de trabajo de larga duración, reproduce la ejecución, recibe señales y se recupera de fallos."
---

# Flujos de Trabajo

Los flujos de trabajo persisten el estado de las operaciones de larga duración para que la ejecución pueda recuperarse después de fallos y reinicios. Son adecuados para procesos como pagos, cumplimiento de pedidos y aprobaciones de múltiples pasos.

## Por qué Flujos de Trabajo

Las funciones conservan el estado en curso en memoria, mientras que los flujos de trabajo persisten el estado de ejecución:

| Aspecto | Funciones | Flujos de Trabajo |
|--------|-----------|-----------|
| Estado | Local a la llamada | Reconstruido a partir del historial persistido |
| Fallo del worker | La llamada en curso falla | Se reproduce desde el historial registrado |
| Duración | Segundos a minutos | Horas a meses |
| Fallo de la aplicación | Se devuelve al llamador | Termina o se reintenta según la política del proveedor |

## Cómo Funcionan los Flujos de Trabajo

El código del flujo de trabajo parece código Lua regular:

```lua
local funcs = require("funcs")
local time = require("time")

local result, err = funcs.call("app.api:charge_card", payment)
if err then return nil, err end

time.sleep("24h")

local status, err = funcs.call("app.api:check_status", result.id)
if err then return nil, err end

if status == "failed" then
    local _, refund_err = funcs.call("app.api:refund", result.id)
    if refund_err then return nil, refund_err end
end

return status
```

El motor de flujos de trabajo intercepta las llamadas y registra sus resultados. Después de un fallo, reproduce la ejecución desde el historial registrado.

Dentro de un flujo de trabajo, cada destino de `funcs.call()` se ejecuta como una actividad de Temporal. Una entrada `function.*` de destino debe registrarse con un worker mediante `meta.temporal.activity.worker`; las entradas no registradas no están disponibles para el flujo de trabajo. Un destino de actividad `process.*` también necesita `meta.options.default_host` (o el campo heredado `meta.default_host`) para registrarse en el registro de funciones que usa el worker de Temporal. Consulte [Actividades](../temporal/activities.md) para ver un ejemplo de actividad de función y sus opciones.

<note>
Los autores de flujos de trabajo deben escribir código determinista. Wippy limita los módulos del flujo de trabajo a los clasificados como Deterministic o Workflow y proporciona implementaciones seguras para replay de las operaciones compatibles. <code>funcs.call()</code> ejecuta una actividad registrada, <code>time.sleep()</code> usa un temporizador del flujo de trabajo, <code>uuid.v4()</code> registra un efecto secundario y <code>time.now()</code> lee la referencia temporal determinista del flujo de trabajo.
</note>

## Patrones de Flujo de Trabajo

### Patrón Saga

Compensar en caso de fallo:

```lua
local funcs = require("funcs")

local inventory, err = funcs.call("app.inventory:reserve", items)
if err then return nil, err end

local payment, err = funcs.call("app.payments:charge", amount)
if err then
    local _, compensation_err = funcs.call("app.inventory:release", inventory.id)
    return nil, compensation_err or err
end

local shipping, err = funcs.call("app.shipping:create", order)
if err then
    local _, refund_err = funcs.call("app.payments:refund", payment.id)
    local _, release_err = funcs.call("app.inventory:release", inventory.id)
    return nil, refund_err or release_err or err
end

return {inventory = inventory, payment = payment, shipping = shipping}
```

### Esperando Señales

Esperar eventos externos (decisiones de aprobación, webhooks, acciones de usuario):

```lua
local funcs = require("funcs")

local _, err = funcs.call("app.approvals:submit", request)
if err then return nil, err end

local inbox = process.inbox()
local msg, open = inbox:receive()  -- blocks until signal arrives
if not open then return nil, errors.new("workflow inbox closed") end

local decision, payload_err = msg:payload():data()
if payload_err then return nil, payload_err end

if decision.approved then
    return funcs.call("app.orders:fulfill", request.order_id)
else
    return funcs.call("app.notifications:send_rejection", request)
end
```

## Elegir un modelo de cómputo :id=choosing-a-compute-model

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
-- Spawn workflow on temporal worker
local pid, err = process.spawn("app.workflows:order_processor", "app:temporal_worker", order_data)
if err then return nil, err end

-- Send signals to workflow
local ok, err = process.send(pid, "update", {status = "approved"})
if err then return nil, err end
return ok
```

El llamador usa la misma API de spawn. El host determina si la entrada se ejecuta en un `temporal.worker` o en un `process.host`. El historial persistido y el replay se aplican solo en la ruta alojada por Temporal. Una entrada de flujo de trabajo ejecutada mediante un host de procesos normal tiene semántica de proceso en memoria y no obtiene la durabilidad de Temporal.

<tip>
Cuando un flujo de trabajo crea hijos via <code>process.spawn()</code>, se convierten en flujos de trabajo hijos en el mismo proveedor, manteniendo las garantías de durabilidad.
</tip>

## Fallo y Supervisión

Los procesos pueden ejecutarse como servicios supervisados usando `process.service`:

```yaml
# Process definition
- name: session_handler
  kind: process.lua
  source: file://session_handler.lua
  method: main

# Supervised service wrapping the process
- name: session_manager
  kind: process.service
  process: app:session_handler
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

Los flujos de trabajo no usan árboles de supervisión de procesos. El proveedor administra la persistencia y la recuperación; los reintentos de la aplicación siguen las políticas configuradas para el flujo de trabajo y sus actividades.

## Configuración

Definición de proceso (creado dinámicamente):

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_processor.lua
  method: main
  meta:
    temporal:
      workflow:
        worker: app:temporal_worker
  modules:
    - funcs
    - time
```

Cada función o proceso invocado mediante `funcs.call()` también declara el worker de actividad. Por ejemplo:

```yaml
- name: charge_card
  kind: function.lua
  source: file://charge_card.lua
  method: main
  meta:
    temporal:
      activity:
        worker: app:temporal_worker
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

## Véase también :id=see-also

- [Funciones](concepts/functions.md) — Llamadas con ámbito de solicitud
- [Modelo de procesos](concepts/process-model.md) — Trabajo en segundo plano con estado
- [Supervisión](guides/supervision.md) — Políticas de reinicio de procesos
