---
title: "Event Bus"
description: "Acciones del event bus, suscripciones wildcard, entrega, puente a procesos Lua, helpers request-response y shutdown."
---

# Event Bus

El event bus procesa acciones pub/sub encoladas en una goroutine dispatcher y entrega los eventos coincidentes a los canales de los suscriptores.

Los fragmentos Go son partes de implementación y extensión. Suponen un contexto de componentes, logger, handlers y tipos de eventos de la aplicación ya existentes.

## Estructura de Evento

```go
type Event struct {
    System string  // Component/module (e.g., "registry", "process")
    Kind   string  // Event type (e.g., "create", "update", "exit")
    Path   string  // Entity identifier
    Data   any     // Payload
    Aux    any     // In-process dispatcher context; not propagated to processes
}
```

## Arquitectura del Bus

```mermaid
flowchart LR
    subgraph Publishers
        P1[Component]
        P2[Component]
    end

    subgraph Bus
        Q[actionQueue]
        D[dispatcher goroutine]
        S[subscribers map]
    end

    subgraph Subscribers
        S1[chan Event]
        S2[chan Event]
    end

    P1 & P2 -->|enqueue| Q
    Q -->|signal| D
    D -->|match & deliver| S1 & S2
    D <-->|manage| S
```

El bus almacena estado en una estructura simple:

```go
type Bus struct {
    subscribers       map[SubscriberID]sub
    subscriberCounter uint64

    actionQueue []action
    spareQueue  []action
    actionMu    sync.Mutex
    actionReady chan struct{}  // buffered=1

    closed atomic.Bool
}
```

Todas las mutaciones pasan por la goroutine dispatcher, eliminando condiciones de carrera sin locking complejo.

## Acciones

Cuatro tipos de acciones fluyen a través de la cola:

| Acción | Comportamiento |
|--------|----------------|
| Subscribe | Agrega subscriber al mapa, responde en canal done |
| Unsubscribe | Remueve subscriber, responde en canal done |
| Send | Entrega evento a subscribers matcheados |
| Stop | Limpia subscribers, drena cola, sale del loop |

Subscribe y Unsubscribe bloquean hasta que el dispatcher confirma. Send es fire-and-forget. El bus acepta como máximo `DefaultMaxSubscribers` suscripciones (4096 de forma predeterminada); las que superan el límite fallan con `ErrSubscribersCapReached`.

## Intercambio de Cola

El dispatcher usa intercambio de slices para evitar asignaciones en estado estable:

```go
func (b *Bus) processActions() bool {
    b.actionMu.Lock()
    actions := b.actionQueue
    b.actionQueue = b.spareQueue[:0]
    b.spareQueue = nil
    b.actionMu.Unlock()

    for i := range actions {
        // process action
    }

    clear(actions)
    b.actionMu.Lock()
    b.spareQueue = actions[:0]
    b.actionMu.Unlock()
    return true
}
```

Dos slices alternan: uno para procesamiento, uno para nuevas llegadas. El canal `actionReady` tiene buffer de 1, así que la señalización nunca bloquea y múltiples encolas colapsan en un solo wakeup.

## Pattern Matching

Las suscripciones compilan patrones una vez en tiempo de subscribe:

```go
type sub struct {
    subID   SubscriberID
    ctx     context.Context
    system  *wildcard.Wildcard
    kind    *wildcard.Wildcard
    eventCh chan<- Event
}
```

El paquete wildcard soporta cuatro tipos de patrón:

| Patrón | Matchea |
|--------|---------|
| `registry` | Solo match exacto |
| `*` | Cualquier segmento único |
| `**` | Cero o más segmentos |
| `(a\|b)` | Alternación dentro de segmento |

Los patrones se dividen en `.` así que `registry.*` matchea `registry.create` pero no `registry.entry.create`. El patrón `registry.**` matchea los tres: `registry`, `registry.create`, y `registry.entry.create`.

## Entrega de Eventos

Durante procesamiento de Send, el dispatcher itera subscribers:

```go
for id, s := range b.subscribers {
    if s.system != nil && !s.system.Match(a.event.System) {
        continue
    }
    if s.kind != nil && !s.kind.Match(a.event.Kind) {
        continue
    }

    select {
    case <-a.ctx.Done():
        goto cleanup
    case <-s.ctx.Done():
        expiredSubs = append(expiredSubs, id)
    case s.eventCh <- a.event:
    }
}
```

Si el contexto de un subscriber es cancelado, se marca para remoción durante ese pase de entrega. El contexto del evento también puede cancelar entrega a mitad de iteración.

## Bridge de Proceso Lua

El dispatcher de eventos conecta eventos Go a procesos Lua. Se suscribe una vez a todos los eventos (`"**"`) y enruta internamente basado en suscripciones de procesos:

```go
type Dispatcher struct {
    bus    event.Bus
    node   relay.Node
    subID  SubscriberID
    eventC chan event.Event

    mu   sync.RWMutex
    subs map[string]*subscription  // topic -> subscription
}
```

Cuando un proceso Lua se suscribe vía `events.subscribe()`, el dispatcher almacena el patrón y PID destino. Eventos matcheados son empaquetados y enviados vía relay:

```go
func (d *Dispatcher) routeEvent(evt event.Event) {
    d.mu.RLock()
    defer d.mu.RUnlock()

    for _, sub := range d.subs {
        if !matchPattern(sub.system, evt.System) {
            continue
        }
        if sub.kind != "" && sub.kind != "*" && !matchPattern(sub.kind, evt.Kind) {
            continue
        }

        data := map[string]any{
            "system": evt.System,
            "kind":   evt.Kind,
            "path":   evt.Path,
        }
        if evt.Data != nil {
            data["data"] = evt.Data
        }

        pkg := relay.NewPackage(pid.PID{}, sub.pid, sub.topic, payload.New(data))
        d.node.Send(pkg)
    }
}
```

## Tipos Helper

### Subscriber

Envuelve suscripción de canal con callback:

```go
handler, err := eventbus.NewSubscriber(ctx, bus, "registry", "entry.*",
    func(evt Event) {
        // handle
    })
if err != nil {
    return err
}
defer handler.Close()
```

Genera dos goroutines: una lee eventos y llama al handler, otra espera cancelación de contexto para desuscribir.

### EventRouter

Gestiona múltiples handlers con ciclo de vida centralizado:

```go
router, err := eventbus.StartRouter(ctx, bus,
    WithHandlers(handler1, handler2),
    WithLogger(log))
if err != nil {
    return err
}
defer router.Stop()
```

Cada handler implementa `Pattern()` y `Handle()`. El router crea un Subscriber para cada uno y cierra todos en Stop.

### AwaitService

Proporciona request-response sobre pub/sub. Mantiene una sola suscripción por `(system, kind)` y enruta eventos a waiters mediante `Path`:

```go
svc := eventbus.NewAwaitService(bus)
if err := svc.Start(ctx); err != nil {
    return err
}
defer svc.Stop()

waiter, err := svc.Prepare(ctx, "test", "response.(accept|reject)", "test/path", 5*time.Second)
if err != nil {
    return err
}
defer waiter.Close()

bus.Send(ctx, triggeringEvent)

result := waiter.Wait()  // returns AwaitResult{Event, Accepted, Error}
```

`Prepare` registra el waiter antes de enviar el evento que lo desencadena, evitando la carrera en la que la respuesta llega antes de registrar la espera. `Wait` bloquea hasta que llega un evento con `Path` coincidente o vence el timeout (de forma predeterminada `DefaultAwaitTimeout`, 30 s, cuando no es positivo). `Accepted` es true cuando el kind del evento es `accept`, `*.accept` o `*.accepted`; de lo contrario, el kind se trata como rechazo y cualquier `error` en `Data` aparece como `Error`. El método auxiliar `Await(ctx, system, kind, path, timeout)` combina Prepare y Wait. La infraestructura de boot registra un AwaitService en el contexto (`event.GetAwaitService`).

## Shutdown

1. `Stop()` atómicamente establece flag closed y encola acción Stop
2. Dispatcher limpia mapa de subscribers
3. Acciones restantes en cola son drenadas:
   - Solicitudes Subscribe obtienen error "bus is closed"
   - Solicitudes Unsubscribe completan inmediatamente
   - Eventos Send son descartados
4. WaitGroup completa

## Ver También

- [Registry](./registry.md) - Productor principal de eventos
- [Command Dispatch](./dispatch.md) - Routing proceso-a-handler
