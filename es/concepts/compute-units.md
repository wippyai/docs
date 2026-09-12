---
title: "Unidades de cómputo"
description: "Compara funciones, procesos y workflows de Wippy por duración, estado, comunicación y gestión de fallos."
---

# Unidades de cómputo

Wippy ofrece tres formas de ejecutar código: funciones, procesos y workflows. Comparten la misma maquinaria subyacente, pero difieren en cuánto viven, dónde se guarda su estado y qué sucede cuando algo falla.

## Funciones

Las funciones se ejecutan cuando se llaman y devuelven un resultado. Trata cada llamada como stateless: el estado durable o compartido pertenece a una base de datos o store. Los pools de funciones pueden reutilizar estados Lua, por lo que los globals de módulo y los upvalues de closures son locales al worker y no constituyen un almacén fiable entre llamadas.

```lua
local funcs = require("funcs")

local result, err = funcs.call("app.math:add", 2, 3)
if err then
    return nil, err
end
```

Las funciones se ejecutan en el contexto del caller. Si se cancela o termina el caller, también se cancelan sus llamadas de función en ejecución.

<tip>
Usa funciones para handlers HTTP, transformaciones de datos y cualquier operación que deba terminar rápidamente y devolver un resultado.
</tip>

## Procesos

Los procesos son actores. Mantienen estado entre varios mensajes, se ejecutan con independencia de quien los inició y se comunican mediante paso de mensajes.

```lua
local pid, err = process.spawn("app.workers:handler", "app:processes")
if err then return nil, err end

local ok, send_err = process.send(pid, "job", {task = "process_data"})
if send_err then return nil, send_err end
return ok
```

Una vez creado, un proceso se ejecuta de forma independiente del código que lo creó. Los procesos pueden monitorizarse o enlazarse entre sí y participar en árboles de supervisión que reinician los children fallidos.

El scheduler multiplexa miles de procesos sobre un pool de workers. Cada proceso cede la ejecución mientras espera I/O, lo que permite que otros se ejecuten.

<tip>
Usa procesos para trabajos en segundo plano, daemons de servicio y cualquier operación que deba sobrevivir a su creador o mantener estado entre mensajes.
</tip>

## Workflows

Los workflows sirven para operaciones durables que deben recuperarse de interrupciones. Un provider de workflows como Temporal registra el historial de ejecución y lo reproduce para reconstruir el estado después de crashes, reinicios o cambios de infraestructura.

```lua
-- The provider records this workflow so a worker restart can replay it.
local pid, err = process.spawn("app.orders:process", "app:temporal_worker", order_id)
if err then return nil, err end
return pid
```

La durabilidad añade latencia porque se registran las operaciones del workflow. Usa workflows cuando la recuperación sea más importante que la menor latencia de funciones o procesos, por ejemplo para procesos de negocio de varios pasos y orquestación de larga duración.

<note>
Wippy registra las operaciones de workflow compatibles para que produzcan los mismos resultados durante el replay. El código de workflow usa la misma sintaxis Lua que las demás unidades de cómputo.
</note>

## Comparación

| | Funciones | Procesos | Workflows |
|---|---|---|---|
| **Estado** | Local a la llamada; no dependas de la reutilización del worker | En memoria | Reconstruido desde historial persistido |
| **Duración** | Una llamada | Hasta terminar o fallar | Persiste entre reinicios |
| **Comunicación** | Valor de retorno + mensajes | Paso de mensajes | Llamadas de actividad + mensajes |
| **Gestión de fallos** | El caller gestiona | Árboles de supervisión | Recuperación del provider; los reintentos siguen la policy |
| **Latencia** | La más baja | Baja | Mayor |

## El mismo código, distinto comportamiento

Muchos módulos se adaptan automáticamente a su contexto. Por ejemplo, `time.sleep()` cede la ejecución tanto en funciones como en procesos para que pueda avanzar otro trabajo; en un workflow, el provider también registra el timer para que el replay no inicie otro.
