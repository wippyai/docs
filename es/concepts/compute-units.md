# Unidades de Computo

Wippy proporciona tres formas de ejecutar codigo: funciones, procesos y flujos de trabajo. Comparten la misma maquinaria subyacente pero difieren en cuanto tiempo viven, donde va su estado, y que sucede cuando las cosas fallan.

## Funciones

Las funciones son el modelo mas simple. Las llama, se ejecutan, retornan un resultado. Ningun estado persiste entre llamadas.

```lua
local result = funcs.call("app.math:add", 2, 3)
```

Las funciones se ejecutan en el contexto del llamador. Si el llamador cancela o sale, cualquier funcion en ejecucion tambien se cancela. Esto mantiene las cosas simples: no tiene que pensar en limpieza.

<tip>
Use funciones para manejadores HTTP, transformaciones de datos, y cualquier cosa que deba completarse rapidamente y retornar un resultado.
</tip>

## Procesos

Los procesos son actores. Mantienen estado a traves de multiples mensajes, se ejecutan independientemente de quien los inicio, y se comunican mediante paso de mensajes.

```lua
local pid = process.spawn("app.workers:handler", "app:processes")
process.send(pid, "job", {task = "process_data"})
```

Cuando crea un proceso, sigue ejecutandose incluso despues de que su codigo termine. Los procesos pueden monitorearse entre si, enlazarse, y formar arboles de supervision que reinician automaticamente hijos fallidos.

El planificador multiplexa miles de procesos a traves de un pool de workers. Cada proceso cede cuando espera por I/O, permitiendo que otros se ejecuten.

<tip>
Use procesos para trabajos en segundo plano, demonios de servicio, y cualquier cosa que necesite sobrevivir a su creador o mantener estado a traves de mensajes.
</tip>

## Flujos de Trabajo

Los flujos de trabajo son para operaciones que absolutamente no pueden fallar. Persisten su estado a un proveedor de flujos de trabajo (Temporal u otros) y pueden reanudar exactamente donde lo dejaron despues de fallos, reinicios, o cambios de infraestructura.

```lua
-- Esto puede ejecutarse por dias, sobrevivir reinicios, y nunca perder progreso
workflow.execute("app.orders:process", order_id)
```

El compromiso es la latencia. Cada paso se registra, asi que los flujos de trabajo son mas lentos que funciones o procesos. Pero para procesos de negocio de multiples pasos u orquestaciones de larga duracion, esa durabilidad vale la pena.

<note>
Wippy maneja automaticamente el determinismo para flujos de trabajo. No necesita aprender tecnicas especiales: escriba codigo normal y el runtime asegura que se comporte correctamente durante el replay.
</note>

## Como se Comparan

| | Funciones | Procesos | Flujos de Trabajo |
|---|---|---|---|
| **Estado** | Ninguno | En memoria | Persistido |
| **Tiempo de vida** | Llamada unica | Hasta salir o fallar | Sobrevive todo |
| **Comunicacion** | Valor de retorno + mensajes | Paso de mensajes | Llamadas de actividad + mensajes |
| **Manejo de fallos** | El llamador maneja | Arboles de supervision | Reintento automatico |
| **Latencia** | Mas baja | Baja | Mayor |

## Mismo Codigo, Diferente Comportamiento

Muchos modulos se adaptan a su contexto automaticamente. Por ejemplo, `time.sleep()` en una funcion bloquea el worker, en un proceso cede para permitir que otros se ejecuten, y en un flujo de trabajo registra un timer que se reproduce correctamente en la recuperacion.
