# Unidades de Cómputo

Wippy proporciona tres formas de ejecutar código: funciones, procesos y flujos de trabajo. Comparten la misma maquinaria subyacente pero difieren en cuánto tiempo viven, dónde va su estado, y qué sucede cuando las cosas fallan.

## Funciones

Las funciones son el modelo más simple. Las llama, se ejecutan, retornan un resultado. Ningún estado persiste entre llamadas.

```lua
local result = funcs.call("app.math:add", 2, 3)
```

Las funciones se ejecutan en el contexto del llamador. Si el llamador cancela o sale, cualquier función en ejecución también se cancela. Esto mantiene las cosas simples: no tiene que pensar en limpieza.

<tip>
Use funciones para manejadores HTTP, transformaciones de datos, y cualquier cosa que deba completarse rápidamente y retornar un resultado.
</tip>

## Procesos

Los procesos son actores. Mantienen estado a través de múltiples mensajes, se ejecutan independientemente de quien los inició, y se comunican mediante paso de mensajes.

```lua
local pid = process.spawn("app.workers:handler", "app:processes")
process.send(pid, "job", {task = "process_data"})
```

Cuando crea un proceso, sigue ejecutándose incluso después de que su código termine. Los procesos pueden monitorearse entre sí, enlazarse, y formar árboles de supervisión que reinician automáticamente hijos fallidos.

El planificador multiplexa miles de procesos a través de un pool de workers. Cada proceso cede cuando espera por I/O, permitiendo que otros se ejecuten.

<tip>
Use procesos para trabajos en segundo plano, demonios de servicio, y cualquier cosa que necesite sobrevivir a su creador o mantener estado a través de mensajes.
</tip>

## Flujos de Trabajo

Los flujos de trabajo son para operaciones que absolutamente no pueden fallar. Persisten su estado a un proveedor de flujos de trabajo (Temporal u otros) y pueden reanudar exactamente donde lo dejaron después de fallos, reinicios, o cambios de infraestructura.

```lua
-- Esto puede ejecutarse por días, sobrevivir reinicios, y nunca perder progreso
workflow.execute("app.orders:process", order_id)
```

El compromiso es la latencia. Cada paso se registra, así que los flujos de trabajo son más lentos que funciones o procesos. Pero para procesos de negocio de múltiples pasos u orquestaciones de larga duración, esa durabilidad vale la pena.

<note>
Wippy maneja automáticamente el determinismo para flujos de trabajo. No necesita aprender técnicas especiales: escriba código normal y el runtime asegura que se comporte correctamente durante el replay.
</note>

## Cómo se Comparan

| | Funciones | Procesos | Flujos de Trabajo |
|---|---|---|---|
| **Estado** | Ninguno | En memoria | Persistido |
| **Tiempo de vida** | Llamada única | Hasta salir o fallar | Sobrevive todo |
| **Comunicación** | Valor de retorno + mensajes | Paso de mensajes | Llamadas de actividad + mensajes |
| **Manejo de fallos** | El llamador maneja | Árboles de supervisión | Reintento automático |
| **Latencia** | Más baja | Baja | Mayor |

## Mismo Código, Diferente Comportamiento

Muchos módulos se adaptan a su contexto automáticamente. Por ejemplo, `time.sleep()` en una función bloquea el worker, en un proceso cede para permitir que otros se ejecuten, y en un flujo de trabajo registra un timer que se reproduce correctamente en la recuperación.
