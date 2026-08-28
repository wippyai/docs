---
title: "Bus de eventos"
description: "Acciones del bus de eventos, suscripciones con comodines, entrega, puente a procesos Lua, funciones auxiliares de solicitud-respuesta y apagado."
---

# Bus de eventos :id=event-bus

El bus de eventos procesa acciones pub/sub encoladas en una goroutine despachadora y entrega los eventos coincidentes a los canales de los suscriptores.

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

Todas las mutaciones pasan por la goroutine despachadora, lo que elimina las condiciones de carrera sin bloqueos complejos.

## Acciones

Cuatro tipos de acciones fluyen a través de la cola:

| Acción | Comportamiento |
|--------|----------------|
| Subscribe | Agrega subscriber al mapa, responde en canal done |
| Unsubscribe | Remueve subscriber, responde en canal done |
| `Send` | Entrega el evento a los suscriptores coincidentes |
| `Stop` | Limpia los suscriptores, drena la cola y sale del bucle |

`Subscribe` y `Unsubscribe` bloquean hasta que el despachador confirma. `Send` envía sin esperar respuesta. El bus acepta como máximo `DefaultMaxSubscribers` suscripciones (4096 de forma predeterminada); las que superan el límite fallan con `ErrSubscribersCapReached`.

## Intercambio de Cola

El despachador intercambia segmentos para evitar asignaciones en estado estable:

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

Se alternan dos segmentos: uno para el procesamiento y otro para las nuevas llegadas. El canal `actionReady` tiene un búfer de 1, por lo que la señalización nunca bloquea y múltiples operaciones de encolado se agrupan en una sola activación.

## Coincidencia de patrones :id=pattern-matching

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

El paquete de comodines admite cuatro tipos de patrón:

| Patrón | Matchea |
|--------|---------|
| `registry` | Solo match exacto |
| `*` | Cualquier segmento único |
| `**` | Cero o más segmentos |
| `(a\|b)` | Alternación dentro de segmento |

Los patrones se dividen en `.` así que `registry.*` matchea `registry.create` pero no `registry.entry.create`. El patrón `registry.**` matchea los tres: `registry`, `registry.create`, y `registry.entry.create`.

## Entrega de Eventos

Durante el procesamiento de `Send`, el despachador recorre los suscriptores:

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

## Puente de procesos Lua :id=bridge-de-proceso-lua

El despachador de eventos conecta eventos de Go con procesos de Lua. Se suscribe una vez a todos los eventos (`"**"`) y enruta internamente según las suscripciones de los procesos:

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

Cuando un proceso Lua se suscribe mediante `events.subscribe()`, el despachador almacena el patrón y el PID de destino. Los eventos coincidentes se empaquetan y envían mediante el relé:

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

## Tipos auxiliares :id=tipos-helper

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

Proporciona solicitud-respuesta sobre pub/sub. Mantiene una sola suscripción por `(system, kind)` y enruta los eventos a procesos en espera mediante `Path`:

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

`Prepare` registra el proceso en espera antes de enviar el evento que lo desencadena, lo que evita la carrera en la que la respuesta llega antes de registrar la espera. `Wait` bloquea hasta que llega un evento con un `Path` coincidente o vence el tiempo de espera (de forma predeterminada `DefaultAwaitTimeout`, 30 s, cuando no es positivo). `Accepted` es `true` cuando el `kind` del evento es `accept`, `*.accept` o `*.accepted`; de lo contrario, el `kind` se trata como rechazo y cualquier `error` de `Data` aparece como `Error`. El método auxiliar `Await(ctx, system, kind, path, timeout)` combina `Prepare` y `Wait`. La infraestructura de arranque registra un `AwaitService` en el contexto (`event.GetAwaitService`).

## Apagado :id=shutdown

1. `Stop()` atómicamente establece flag closed y encola acción Stop
2. El despachador limpia el mapa de suscriptores
3. Acciones restantes en cola son drenadas:
   - Solicitudes Subscribe obtienen error "bus is closed"
   - Solicitudes Unsubscribe completan inmediatamente
   - Los eventos `Send` se descartan
4. WaitGroup completa

## Ver También

- [Registry](internals/registry.md) - Productor principal de eventos
- [Command Dispatch](internals/dispatch.md) - Routing proceso-a-handler
