---
title: "Grupos de Proceso"
description: "Configura grupos de procesos con nombre y reconocimiento del clúster, con pertenencia descentralizada, difusiones, supervisión y reconciliación."
---

# Grupos de Proceso

Un ámbito `pg.scope` permite que los procesos se unan a grupos con nombre y reciban difusiones dirigidas a un grupo. El modelo sigue `pg` de Erlang/OTP: los grupos se crean con la primera incorporación, un proceso puede pertenecer a muchos grupos y unirse varias veces al mismo, y cada nodo del clúster mantiene su propio estado de pertenencia y lo reconcilia con sus pares a través de la malla entre nodos. Esta página es una referencia de configuración y comportamiento; los bloques YAML son fragmentos de entrada.

La API Lua está documentada en [Grupos de procesos](lua/core/pg.md); esta página cubre el tipo de entrada de ámbito y su configuración. Consulta la [guía de clústeres](guides/cluster.md) para conocer el modelo de pertenencia que la rodea.

## Tipo de Entrada

| Tipo | Descripción |
|------|-------------|
| `pg.scope` | Un espacio de nombres de grupos de proceso independiente con su propio estado de membresía y malla de cluster |

Cada ámbito está aislado: los grupos y miembros en un ámbito son invisibles para otro. Un proceso abre un ámbito por su ID de entrada (`pg.open("app:pg")`) y opera dentro de él.

```yaml
- name: pg
  kind: pg.scope
  lifecycle:
    auto_start: true
```

## Configuración

Todos los campos son opcionales. La tabla muestra sus valores predeterminados.

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `protocol_timeout` | duration | 5s | Tiempo de espera para operaciones de sincronización/descubrimiento entre nodos |
| `broadcast_timeout` | duration | 5s | Tiempo de espera para entregar una difusión a un solo miembro |
| `anti_entropy_interval` | duration | 30s | Cadencia del bucle de reconciliación; se sincroniza un par por ciclo |
| `circuit_breaker_failures` | int | 3 | Fallos de envío consecutivos a un nodo antes de que su circuito se abra |
| `circuit_breaker_reset_time` | duration | 10s | Espera antes de que un circuito abierto pase a semi-abierto para un envío de prueba |
| `max_retries` | int | 3 | Intentos de reintento para una difusión fallida |
| `retry_base_delay` | duration | 100ms | Retraso de backoff inicial entre reintentos |
| `retry_max_delay` | duration | 1s | Retraso de backoff máximo |
| `action_queue_size` | int | 256 | Profundidad en la que se registra una advertencia de "aproximándose a la capacidad" |
| `action_queue_max_size` | int | 1024 | Capacidad máxima de la cola del bucle de eventos interno; las operaciones se descartan cuando está llena |
| `monitor_buffer` | int | 64 | Capacidad del canal de eventos por suscripción; los eventos se descartan para un suscriptor cuyo buffer se llena |
| `max_groups` | int | 0 | Máximo de grupos distintos (0 = ilimitado) |
| `max_members_per_group` | int | 0 | Máximo de miembros por grupo, contando multi-joins (0 = ilimitado) |

```yaml
- name: pg
  kind: pg.scope
  anti_entropy_interval: 30s
  circuit_breaker_failures: 3
  max_members_per_group: 10000
  lifecycle:
    auto_start: true
```

## Cómo Funciona

**Estado de escritor único.** Cada ámbito ejecuta un bucle de eventos de una sola goroutine (el patrón gen_server). Todas las mutaciones se serializan a través de él; las lecturas de miembros y grupos se sirven desde instantáneas publicadas atómicamente, por lo que nunca bloquean el bucle.

**Propagación de join/leave.** Un join o leave local se aplica al bucle y luego se distribuye en abanico hacia la unión de los peers de membresía activos y cualquier nodo remoto descubierto previamente. Enviar a esa unión asegura que un nodo recién unido o aún no convergido reciba el cambio.

**Difusión.** `broadcast` toma una instantánea de la lista completa de miembros del cluster dentro del bucle, luego entrega a cada miembro fuera del bucle para que un receptor lento no pueda detener el ámbito. `broadcast_local` hace lo mismo pero solo para miembros en el nodo local.

**Monitor y eventos.** Suscribirse y tomar instantánea de los miembros actuales ocurren en un tick del bucle de eventos, por lo que un suscriptor nunca pierde ni cuenta doble un cambio que compite con la suscripción. Los suscriptores reciben eventos `member.joined` / `member.left`; un leave para un proceso que se unió N veces reporta el PID N veces, preservando la multiplicidad.

**Anti-entropía y descubrimiento.** Al arrancar, un ámbito envía mensajes de descubrimiento a un pequeño subconjunto aleatorio de peers (limitado para evitar una tormenta N² cuando muchos nodos se reinician a la vez). Cuando un nodo se une, recibe una sincronización de estado completo. El bucle de anti-entropía luego periódicamente empuja una sincronización completa a un peer a la vez, de modo que cualquier difusión que un peer haya perdido eventualmente converge. El receptor aplica una sincronización diferencial — solo los miembros realmente añadidos o eliminados emiten eventos.

**Circuit breakers.** Un circuit breaker por nodo rastrea los fallos de envío consecutivos. Tras `circuit_breaker_failures` fallos se abre y los envíos a ese nodo se omiten hasta que transcurre `circuit_breaker_reset_time`, cuando se permite un envío de prueba. Las difusiones de join/leave que encuentran un breaker abierto se reintentan con backoff exponencial hasta `max_retries`.

## Observabilidad

Una comprobación de actividad (`pg.broadcast_recent.<scope>`) informa de un estado no saludable si un ámbito no observa tráfico de difusión durante un período prolongado, lo que permite detectar un bucle de eventos bloqueado o una partición persistente. Consulta la [guía de observabilidad](guides/observability.md).

## Ver También

- [Grupos de procesos](lua/core/pg.md) - La API Lua
- [Clúster](guides/cluster.md) - La pertenencia y el modelo de clúster
- [Modelo de procesos](concepts/process-model.md) - Procesos, PID y mensajería
