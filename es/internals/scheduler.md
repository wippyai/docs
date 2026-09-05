---
title: "Scheduler"
description: "El scheduler ejecuta procesos usando un diseño de work-stealing. Los workers mantienen deques locales y roban de otros cuando están idle."
---

# Scheduler

El scheduler ejecuta procesos usando un diseño de work-stealing. Los workers mantienen deques locales y roban de otros cuando están idle.

## Interfaz de Proceso

El scheduler trabaja con cualquier tipo que implemente la interfaz `Process`:

```go
type Process interface {
    Init(ctx context.Context, method string, input payload.Payloads) error
    Step(events []Event, out *StepOutput) error
    Close()
}
```

| Método | Propósito |
|--------|-----------|
| `Init` | Preparar proceso con nombre de método de entrada y argumentos de entrada |
| `Step` | Avanzar máquina de estados con eventos entrantes, escribir yields a salida |
| `Close` | Liberar recursos |

El parámetro `method` en `Init` especifica qué punto de entrada invocar. Una instancia de proceso puede exponer múltiples puntos de entrada, y el llamador selecciona cuál ejecutar. Esto también sirve como verificación de que el scheduler está iniciando el proceso correctamente.

El scheduler llama `Step()` repetidamente, pasando eventos (completaciones de yield, mensajes) y recolectando yields (comandos a despachar). El proceso escribe su estado y cualquier yield al buffer `StepOutput`.

```go
type Event struct {
    Type  EventType  // EventYieldComplete o EventMessage
    Tag   uint64     // Tag de correlación para completaciones de yield
    Data  any        // Datos de resultado o payload de mensaje
    Error error      // Error si yield falló
}
```

## Estructura

El scheduler genera `GOMAXPROCS` workers por defecto. Cada worker tiene un deque local para acceso LIFO amigable con cache y una cola de inyección MPSC por worker para completaciones asíncronas que tienen afinidad con ese worker. Una cola FIFO global maneja nuevos envíos y re-encolados sin afinidad. Los procesos se rastrean por PID para routing de mensajes.

## Búsqueda de Trabajo

```mermaid
flowchart TD
    W[Worker necesita trabajo] --> L{Deque local?}
    L -->|tiene items| LP[Pop desde fondo LIFO]
    L -->|vacío| I{Cola de inyección?}
    I -->|tiene items| IP[Pop + drenar hasta 16 al local]
    I -->|vacía| G{Cola global?}
    G -->|tiene items| GP[Pop + transferencia batch hasta 16]
    G -->|vacía| S[Robar de víctima aleatoria]
    S --> SH[StealHalfInto deque de víctima]
```

Workers verifican fuentes en orden de prioridad:

| Prioridad | Fuente | Patrón |
|-----------|--------|--------|
| 1 | Deque local | Pop LIFO, sin lock, amigable con cache |
| 2 | Cola de inyección | Pop MPSC de completaciones asíncronas afines, drenar hasta 16 al local |
| 3 | Cola global | Pop FIFO con transferencia batch |
| 4 | Otros workers | Robar mitad del deque de víctima |

Al hacer pop de la cola de inyección o de la global, los workers toman un item y mueven hasta 16 más a su deque local.

## Deque Chase-Lev

Cada worker posee un deque Chase-Lev de work-stealing:

```go
type Deque struct {
    buffer atomic.Pointer[dequeBuffer]
    top    atomic.Int64  // Ladrones roban desde aquí (CAS)
    bottom atomic.Int64  // Dueño push/pop aquí
}
```

El dueño hace push y pop desde el fondo (LIFO) sin sincronización. Los ladrones roban desde arriba (FIFO) usando CAS. Esto da al dueño acceso amigable con cache a items recientemente pusheados mientras distribuye trabajo más viejo a stealers.

`StealHalfInto` toma la mitad de los items en una operación CAS, reduciendo contención.

## Spinning Adaptativo

Antes de bloquear en la variable de condición, workers giran adaptativamente:

| Contador de Spin | Acción |
|------------------|--------|
| < 4 | Loop cerrado |
| 4-15 | Yield thread (`runtime.Gosched`) |
| >= 16 | Bloquear en variable de condición |

## Estados de Proceso

```mermaid
stateDiagram-v2
    [*] --> Ready: Submit
    Ready --> Running: CAS por worker
    Running --> Complete: done
    Running --> Blocked: yields comandos
    Running --> Idle: esperando mensajes
    Blocked --> Ready: CompleteYield
    Idle --> Ready: Send llega
```

| Estado | Descripción |
|--------|-------------|
| Ready | Encolado para ejecución |
| Running | Worker está ejecutando Step() |
| Blocked | Esperando completación de yield |
| Idle | Esperando mensajes |
| Complete | Ejecución terminada |

Un flag de wakeup maneja races: si un handler llama `CompleteYield` mientras el worker todavía posee el proceso (Running), establece el flag. El worker verifica el flag después de despachar y re-encola si está establecido.

## Cola de Eventos

Cada proceso tiene una cola de eventos MPSC (multi-producer, single-consumer):

- **Productores**: Handlers de comandos (`CompleteYield`), remitentes de mensajes (`Send`)
- **Consumidor**: Worker drena eventos en `Step()`

Un contador de generación protege la cola. Cada productor se vincula a la generación que observó; `Reset` la incrementa, de modo que un remitente sobrante de una ejecución previa no puede pushear a una cola reutilizada.

El tráfico ordinario de eventos es ilimitado. La contabilidad es opt-in por mensaje: un mensaje que lleva `MaxItems` o `MaxBytes` se admite contra un presupuesto por topic, y gana el límite más estricto visto para ese topic. Un mensaje mantiene su reserva hasta que el proceso consumidor la libera, y los terminales nunca consumen capacidad de backlog.

Cuando se agota el presupuesto de un topic, la cola agrega un mensaje sintético en lugar del mensaje que desborda, con `message queue limit exceeded` seguido de un payload terminal. El tráfico posterior de ese topic se descarta hasta que se resetea la cola, de modo que una suscripción acotada termina con un terminal de error en vez de crecer sin límite.

## Routing de Mensajes

El scheduler implementa `relay.Receiver` para enrutar mensajes a procesos. `Send` delega en `SendContext` con un contexto de fondo; `SendContext` comprueba la cancelación antes de la búsqueda del destino y antes de la admisión, porque la admisión en sí no bloquea y es irreversible una vez que tiene éxito.

Ambos buscan el PID destino en el mapa `byPID` y pushean el paquete a la cola del proceso bajo la generación actual del procesador. La admisión tiene tres resultados:

| Resultado | Significado | Propiedad del paquete |
|-----------|-------------|-----------------------|
| Aceptado | La cola tomó el paquete | Cola, liberado por el scheduler tras el procesamiento |
| Descartado | Un presupuesto por topic desbordó y la cola no retuvo nada salvo su propio terminal de desbordamiento | Llamante, liberado inmediatamente |
| Rechazado | La cola está cerrada o la generación es obsoleta | Llamante; `SendContext` retorna `ErrProcessClosed` |

Un push aceptado o descartado despierta luego el proceso si está idle o bloqueado. Se re-encola mediante injectOrGlobal, que pushea a la cola de inyección del último worker cuando el proceso tiene afinidad de worker conocida, y recurre a la cola global en caso contrario.

## Shutdown

En shutdown, el scheduler envía eventos de cancelación a todos los procesos en ejecución y espera que completen o timeout. Workers salen una vez que no queda trabajo.

## Ver También

- [Command Dispatch](internals/dispatch.md) - Cómo yields llegan a handlers
- [Process Model](concepts/process-model.md) - Conceptos de alto nivel
