# Cluster

Wippy se ejecuta como un nodo único por defecto. Habilitar el cluster convierte un conjunto de nodos en un sistema coordinado que comparte membresía, nombres de proceso a nivel de cluster, bloqueos distribuidos y mensajería de grupos de proceso sobre un núcleo de consenso Raft acotado.

El clustering está desactivado hasta que se establece `cluster.enabled: true`. Todo lo que se describe a continuación es inerte en un nodo único.

## Qué ofrece el clustering

- **Membresía** — cada nodo conoce el conjunto activo de peers a través de gossip, con detección rápida de fallos.
- **Nombres de proceso a nivel de cluster** — registrar un proceso bajo un nombre que se resuelve desde cualquier nodo, con una elección de garantías de consistencia (ver [Naming](#naming-and-name-scopes)).
- **Bloqueos distribuidos** — `system.lock` proporciona exclusión mutua a nivel de cluster con liberación automática cuando el titular falla (ver [Bloqueos distribuidos](#distributed-locks)).
- **Grupos de proceso** — publicar a todos los miembros de un grupo con nombre en todos los nodos (ver [Grupos de proceso](#process-groups)).
- **Un núcleo de consenso** — un cluster Raft pequeño y acotado proporciona el soporte linealizable sobre el que se construyen las primitivas de naming y bloqueo.

## Arquitectura: Raft acotado

Hacer que cada nodo sea un peer de Raft escala mal: el líder replica cada entrada de log a cada peer, por lo que el coste del líder inactivo crece con el tamaño del cluster. Wippy limita Raft a un núcleo de tamaño fijo y deja que el resto del cluster viaje por gossip. Cada nodo ocupa uno de tres roles en la configuración Raft:

| Rol | Cantidad (por defecto) | En configuración Raft | Recibe replicación de log | Vota |
|-----|------------------------|----------------------|--------------------------|------|
| **Voter** | hasta 5 (`max_voters`, impar) | sí | sí | sí |
| **Standby** | hasta 4 (`max_standbys`) | sí | sí | no |
| **Client** | ilimitado | no | no | no |

- Los **voters** forman el quórum. Las escrituras se confirman una vez que la mayoría de los voters las reconoce. El número de voters es siempre impar para que la mayoría esté bien definida.
- Los **standbys** son miembros no votantes mantenidos completamente replicados y en espera. Cuando un voter se va, el líder promueve el standby de mayor rango al slot abierto, de modo que el quórum se recupera sin esperar a que un nodo nuevo se ponga al día.
- Los **clients** son todos los nodos más allá de `voters + standbys`. No están en la configuración Raft en absoluto, por lo que el líder nunca les envía entradas de log. Participan en gossip y enrutan escrituras a un miembro Raft. Esto mantiene la CPU del líder inactivo plana (O(1)) sin importar cuánto crezca el cluster.

Dado que los standbys y los clients pueden absorber el resto de la flota, un cluster de cientos de nodos sigue teniendo un núcleo de consenso de 5 voters. Los límites `max_voters`/`max_standbys` son lo que hace "acotado" al diseño.

### Selección de voters

El líder ejecuta un reconciliador que, en cada cambio de membresía (con debounce de `raft.reconcile_debounce`, por defecto 2s), recalcula qué nodos deben ser voters y aplica el conjunto mínimo de operaciones de promoción/degradación. La selección es determinista — cada nodo deriva el mismo orden a partir de la misma vista de gossip — y se guía por tres sugerencias anunciadas en gossip:

- `raft.eligible` — un nodo con `eligible: false` nunca es elegido como voter (usar para nodos que se desea que permanezcan como clients o standbys).
- `raft.priority` — un valor menor es preferido al llenar slots de voter; los empates se rompen por ID de nodo.
- `failure_domain` — los voters se distribuyen primero entre dominios distintos (zonas/racks), de modo que perder un dominio no pueda eliminar la mayoría de voters.

Las operaciones se aplican en un orden que preserva el quórum: primero adiciones y promociones, luego degradaciones, luego eliminaciones.

## Membresía y gossip

La membresía usa gossip SWIM (HashiCorp memberlist). Cada nodo enlaza un puerto de gossip (por defecto **7946**) e intercambia continuamente pequeños mensajes con los peers para detectar fallos y diseminar metadatos.

Un nodo se une apuntando a uno o más nodos existentes:

```yaml
cluster:
  enabled: true
  name: node-2
  membership:
    join_addrs: "node-1:7946"
```

El primer nodo no necesita `join_addrs` — arranca como semilla. Las uniones se reintentan con backoff, y un nodo que se encuentra aislado intenta periódicamente reintegrarse, por lo que un nodo reiniciado con una nueva IP (común en Kubernetes) reconverge rápidamente.

El gossip puede cifrarse con una clave compartida, proporcionada en línea o desde un archivo:

```yaml
cluster:
  membership:
    secret_file: /etc/wippy/cluster.key
```

Los cambios de membresía (`NodeJoined`, `NodeLeft`, `NodeUpdated`) son los eventos que impulsan el bootstrap de Raft, la reconciliación de voters, la sincronización de grupos de proceso y la limpieza automática de nombres pertenecientes a un nodo que se fue.

## Bootstrap

El cluster inicial se forma por gossip, no por una lista de peers estática. Esto sigue el patrón `bootstrap_expect` de Consul/Nomad: se indica a cada nodo inicial cuántos nodos se esperan, y esperan hasta que puedan verse todos entre sí antes de formar quórum juntos.

| `bootstrap_expect` | Comportamiento |
|--------------------|----------------|
| `0` | Nunca se auto-bootstrapea; solo se une a un cluster que ya existe |
| `1` | Nodo único; se bootstrapea inmediatamente con sí mismo como único voter |
| `N` | Espera hasta que `N` peers elegibles estén establemente visibles en gossip, luego todos derivan la misma lista de voters y forman quórum |

Para un bootstrap de `N` nodos, establecer el mismo `bootstrap_expect: N` en cada nodo inicial. Cada uno anuncia un estado "pre-bootstrap" en gossip; una vez que exactamente `N` peers de este tipo son visibles durante una breve ventana de estabilidad, cada nodo computa independientemente el conjunto de voters ordenado idéntico y forma el cluster. La ventana de estabilidad previene que una vista parcial y breve active el bootstrap prematuramente.

Los nodos que arrancan más tarde ven un cluster ya formado y omiten el bootstrap por completo — el reconciliador del líder los añade como voters o standbys.

## Núcleo de consenso Raft

El núcleo de consenso es **sin disco**: los logs y snapshots de Raft residen solo en memoria, por lo que no hay directorio de datos que aprovisionar. Al reiniciar, un nodo se reintegra al gossip y repite el estado desde sus peers. Esto elimina deliberadamente los modos de fallo de persistencia-versus-quórum que introduce el Raft en disco, y coincide con el modelo de sistemas de coordinación en memoria (Erlang global, Akka distributed data). El compromiso: la durabilidad del cluster proviene de tener un quórum activo, no del disco — ver [Recuperación](#recovery-and-failure-modes).

Raft no abre su propio puerto de escucha. Viaja por la **malla internodo** — las mismas conexiones TCP usadas para el tráfico de relay entre nodos — multiplexado con yamux. El puerto internodo se selecciona automáticamente al arrancar (rango 7950-7959, luego efímero), se fija y se anuncia en gossip para que los peers puedan alcanzarlo. El único puerto que normalmente se expone es el puerto de gossip.

El FSM de Raft contiene el registro de nombres global: bindings activos `nombre -> PID` más reservas strong en vuelo. Eso es lo que las primitivas de naming que se describen a continuación leen y escriben.

## Naming y ámbitos de nombre

Un proceso puede registrarse bajo un nombre y ser alcanzado por ese nombre en lugar de su PID raw. La decisión clave es el **ámbito**, que selecciona la garantía de consistencia. Hay cuatro ámbitos disponibles, de más barato/débil a más fuerte:

| Ámbito | Respaldado por | Visibilidad | Garantía |
|--------|----------------|-------------|----------|
| **Local** | mapa por nodo | solo este nodo | Instantáneo, local al nodo; sin coordinación |
| **Eventual** | gossip CRDT | en todo el cluster | Eventualmente consistente; converge tras rondas de gossip |
| **Consistent** | Raft | en todo el cluster | Escrituras linealizables; singleton único en el cluster |
| **Strong** | Raft + ack de todos los nodos | en todo el cluster | Consistente, más reconocimiento de cada nodo activo antes de que el nombre esté activo |

Cómo elegir:

- **Local** — nombres significativos solo en un nodo (un helper por nodo). Se libera en el momento en que el proceso sale. Coste cero.
- **Eventual** — nombres de servicio, grupo y presencia en todo el cluster donde una breve ventana de datos obsoletos es aceptable. El conjunto de vínculos se replica por completo en cada nodo, por lo que conviene a un espacio de nombres acotado, no a un nombre por entidad de alta cardinalidad como un proceso por sesión (direccione esos directamente por PID). Cuando dos orígenes registran el mismo nombre, la resolución de conflictos elige un ganador y el proceso perdedor recibe un evento de cancelación (`process.event.CANCEL`) con el motivo `name revoked: <name>`; continúa ejecutándose y puede volver a registrarse. Los nombres se liberan cuando el nodo propietario se va.
- **Consistent** — la elección estándar para singletons con nombre a nivel de cluster. Primero en escribir gana: un segundo registro del mismo nombre a un PID diferente falla con "already exists" y devuelve el propietario actual. Las escrituras necesitan quórum, por lo que se detienen en una partición de minoría. Las lecturas provienen de la réplica Raft local y pueden retrasarse una escritura por unos pocos milisegundos.
- **Strong** — el pequeño conjunto de singletons del plano de control donde incluso una lectura momentáneamente obsoleta es peligrosa. Además de la garantía Consistent, el registro abre una reserva que cada nodo activo debe reconocer antes de que el nombre sea autoritativo; cualquier nodo que ya tenga un binding conflictivo lo rechaza inmediatamente. Si el plazo vence antes de que todos los nodos confirmen, el registro expira e informa qué nodos faltaban. Esto es la base de los [bloqueos distribuidos](#distributed-locks).

Los nombres se liberan automáticamente: Local al salir el proceso; Consistent y Strong al salir el proceso (mediante monitoreo de topología) y al irse el nodo; Eventual al irse el nodo. La resolución para mensajería (`process.send`, `process.terminate` y similares) consulta los planos en orden — Consistent, luego Eventual, luego Local — de modo que un nombre Consistent sombrea uno Eventual con la misma cadena.

La superficie Lua para naming reside en `process.registry` (register/lookup/unregister con un ámbito) — ver la referencia de [Process](lua/core/process.md).

## Grupos de proceso

Los grupos de proceso son una facilidad de publish/subscribe y membresía consciente del cluster modelada en `pg` de Erlang. Un proceso se une a un grupo con nombre; una difusión a ese grupo alcanza a todos los miembros en todos los nodos. Los grupos están respaldados por gossip y son eventualmente consistentes — independientes de Raft — por lo que siguen funcionando incluso mientras el núcleo de consenso está convergiendo.

Operaciones típicas: unirse/abandonar un grupo, difundir a todos los miembros (o solo miembros locales), listar miembros y monitorear un grupo para eventos de unión/salida. Cuando un nuevo nodo se une, los grupos reconcilian su membresía a través de un handshake de sincronización directa, y un bucle de anti-entropía en segundo plano repara cualquier divergencia con el tiempo.

Ver [Grupos de Proceso](lua/core/pg.md) para la API Lua y el [tipo de entrada `pg.scope`](system/process-groups.md) para la configuración.

## Bloqueos distribuidos

`system.lock` es exclusión mutua a nivel de cluster construida directamente sobre el ámbito de nombre Strong. Adquirir un bloqueo registra su nombre bajo el ámbito Strong propiedad del proceso que llama; liberarlo lo desregistra. Dado que Strong requiere que cada nodo activo reconozca, puede existir como máximo un titular en todo el cluster.

```lua
local ok, err = system.lock.acquire("orders.migration")
if ok then
  -- sección crítica: solo un titular en todo el cluster
  system.lock.release("orders.migration")
end
```

Acquire es fail-fast (no bloqueante): si el bloqueo está tomado, devuelve inmediatamente, por lo que los callers añaden su propio retry/backoff. El bloqueo se libera automáticamente si el proceso titular sale o su nodo se va, por lo que la limpieza es automática. Ver la referencia de [System](lua/system/system.md) para las firmas exactas.

## Configuración

La referencia completa clave por clave está en [Configuración](guides/configuration.md#cluster). Las formas mínimas:

Nodo único (desarrollo):

```yaml
cluster:
  enabled: true
  name: dev
  raft:
    bootstrap_expect: 1
```

Cluster de votación de tres nodos:

```yaml
cluster:
  enabled: true
  name: node-1
  failure_domain: us-east-1a
  membership:
    join_addrs: "node-2:7946,node-3:7946"
    secret_file: /etc/wippy/cluster.key
  raft:
    bootstrap_expect: 3
```

Cliente solo-gossip (se une para naming/mensajería, nunca ejecuta Raft):

```yaml
cluster:
  enabled: true
  name: edge-7
  membership:
    join_addrs: "node-1:7946,node-2:7946"
  raft:
    role: client
```

## Puertos

| Propósito | Puerto | Protocolo | Clave de configuración |
|-----------|--------|-----------|------------------------|
| Gossip (membresía) | 7946 | TCP + UDP | `cluster.membership.bind_port` |
| Malla internodo (relay + Raft) | automático | TCP | `cluster.internode.bind_port` |

No hay un puerto Raft separado — Raft se multiplexa sobre la malla internodo. El puerto internodo se asigna automáticamente y se anuncia a través de gossip, por lo que solo el puerto de gossip necesita exposición predecible.

## Observabilidad

La salud del cluster se expone a través del [endpoint estándar de Prometheus](guides/observability.md) y mediante verificaciones de liveness.

Métricas clave a monitorear:

| Métrica | Significado |
|---------|-------------|
| `raft_state` | 0 = follower, 1 = candidate, 2 = leader |
| `raft_term` | Término Raft actual; incrementos rápidos señalan rotación de elecciones |
| `raft_voters` / `raft_non_voters` | Voters y standbys activos en la configuración |
| `raft_leader_changes_total` | Transiciones de líder; debería ser casi plano en un cluster saludable |
| `raft_voter_churn_burst_total` | Ráfagas de operaciones de añadir/eliminar voters; la rotación sostenida es una señal de alerta |
| `gossip_members{state}` | Recuentos por estado (alive/suspect/dead/left) |
| `gossip_convergence_seconds` | Tiempo entre eventos de gossip |

Verificaciones de liveness incorporadas (conectadas al endpoint de liveness):

- **gossip** — saludable mientras la puntuación de salud de gossip del nodo se mantiene baja, con una ventana de gracia al arrancar para que un nodo que se reintegra no sea eliminado prematuramente.
- **raft last-contact** — un follower votante falla si no ha escuchado de un líder recientemente; un standby tolera un intervalo mucho mayor; los líderes siempre pasan.
- **process-group broadcast** — falla si un grupo no ve tráfico de difusión durante un período prolongado, detectando un bucle de eventos bloqueado o una partición persistente.

## Recuperación y modos de fallo

Dado que el núcleo de consenso no tiene disco, la durabilidad proviene de un quórum activo en lugar del disco. Las reglas prácticas:

- Mantener una mayoría de voters activos. Con 5 voters se toleran 2 fallos simultáneos de voters; los standbys se promueven para llenar los slots abiertos. Caer por debajo de una mayoría detiene las escrituras (nuevos registros Consistent/Strong y adquisiciones de bloqueos) hasta que el quórum regresa. Los nombres existentes y las búsquedas continúan sirviéndose desde réplicas locales.
- El líder desaloja proactivamente un voter que está silente en heartbeat y muerto en gossip, de modo que un voter muerto no bloquee permanentemente el quórum mientras se promueve un standby.
- Para recuperar un cluster que ha perdido quórum, reiniciar los nodos fallidos. Se reintegran al gossip y los miembros supervivientes los incorporan de nuevo. Distribuir voters entre `failure_domain`s es lo que previene que un fallo en una sola zona cause pérdida de quórum.

## Ver también

- [Configuración](guides/configuration.md#cluster) — cada clave de configuración del cluster
- [Process](lua/core/process.md) — registrar y resolver procesos por nombre
- [System](lua/system/system.md) — `system.cluster`, `system.raft`, `system.node`, `system.lock`
- [Observabilidad](guides/observability.md) — métricas y endpoints de salud
- [Modelo de Procesos](concepts/process-model.md) — actores, PIDs y mensajería
