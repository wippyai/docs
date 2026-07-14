---
title: "Cluster"
---

# Cluster

Un solo nodo Wippy es un runtime completo. Un **cluster** une varios nodos en un sistema coordinado: los procesos pueden ser nombrados y alcanzados desde cualquier nodo, coordinarse mediante bloqueos y grupos, y apoyarse en un núcleo de consenso compartido — sin que su código cambie la forma en que genera, envía o supervisa.

El clustering es opcional (`cluster.enabled`). Esta página explica el modelo que ve su código; para topología, configuración y operaciones consulte la [Guía de Cluster](guides/cluster.md).

## El modelo

Los nodos se descubren entre sí mediante **gossip** (SWIM) — un nodo se une apuntando a una semilla, y la membresía y la detección de fallos convergen sin un coordinador. Sobre gossip se asienta un pequeño núcleo **Raft** acotado: un conjunto fijo de votantes proporciona consenso linearizable, mientras el resto de la flota opera por gossip. La mayoría de los nodos nunca cargan con consenso, por lo que el cluster escala horizontalmente manteniendo una única fuente de verdad para lo que la necesita.

Lo que el cluster aporta a su código se reduce a tres ideas: **nombres**, **enrutamiento** y **primitivas de coordinación**.

## Nomenclatura

Un proceso se direcciona normalmente por su PID. En un cluster también puede registrarse bajo un **nombre** y ser alcanzado por ese nombre desde cualquier lugar. La decisión relevante es el **alcance** — la garantía de consistencia que desea, negociada frente al costo:

| Alcance | Visibilidad | Garantía | Úselo para |
|---------|-------------|----------|------------|
| **Local** | este nodo | instantáneo, sin coordinación | helpers locales del nodo |
| **Eventual** | todo el cluster | converge tras el gossip; los conflictos se resuelven y notifican al perdedor | nombres de servicio, grupo y presencia acotada |
| **Consistent** | todo el cluster | singleton linearizable vía Raft | el servicio con nombre estándar en todo el cluster |
| **Strong** | todo el cluster | Consistent, más el reconocimiento de cada nodo activo antes de que el nombre esté activo | singletons y bloqueos del plano de control |

Los alcances forman un ordenamiento estricto — `Local < Eventual < Consistent < Strong` — sobre el eje consistencia-versus-costo. Se elige el alcance más débil que aún cumpla la garantía requerida. Los nombres se registran a través de [`process.registry`](lua/core/process.md) y se liberan automáticamente cuando el proceso propietario termina (o su nodo abandona el cluster).

## Enrutamiento

La nomenclatura solo es útil si un nombre alcanza de forma confiable el proceso correcto. El enrutamiento es lo que conecta ambos, y sigue algunas reglas consistentes:

- **Las lecturas son locales.** Cada nodo resuelve un nombre desde su propia réplica o caché diseminada por gossip — sin viaje de red para buscar un nombre. Esto mantiene la resolución rápida y funcional durante particiones.
- **La resolución tiene un orden fijo.** Un nombre se resuelve a través de los planos en orden — Consistent (Raft), luego Eventual (gossip), luego Local — de modo que un nombre de todo el cluster sombrea a uno local con la misma cadena.
- **Las escrituras se enrutan hacia la autoridad.** Un registro Consistent o Strong pasa por el líder Raft; un nodo que no es el líder reenvía la escritura y espera el resultado. Una vez confirmado, el enlace activo se disemina por gossip para que cada nodo — incluidos los que no forman parte del núcleo Raft — pueda resolver el nombre localmente.
- **Los mensajes se enrutan por PID.** Cuando se usa `process.send` hacia un nombre, este se resuelve a un PID y el relay entrega el mensaje al nodo propietario. Su código direcciona un proceso de la misma forma ya sea que viva en este nodo o en otro — la ubicación es transparente.

El efecto: se registran y buscan nombres sin pensar en qué nodo tiene la autoridad, y los mensajes encuentran su destino en todo el cluster de la misma forma que lo hacen localmente.

## Primitivas

El clustering expone un pequeño conjunto de bloques de construcción. Cada uno está documentado en su propia página; el concepto es lo que permiten construir:

- **Membresía e identidad** — el conjunto activo de nodos y la identidad y rol de este nodo. Úselo para descubrir pares o distribuir trabajo. Vea [`system.cluster`](lua/system/system.md) y [`system.node`](lua/system/system.md).
- **Estado de consenso** — el líder Raft, el término y el rol de este nodo, para diagnósticos y lógica consciente del líder. Vea [`system.raft`](lua/system/system.md).
- **Nombres en todo el cluster** — registre y resuelva procesos por nombre y alcance, el fundamento sobre el que se construye todo lo demás. Vea [`process.registry`](lua/core/process.md).
- **Bloqueos distribuidos** — exclusión mutua en todo el cluster con como máximo un titular, liberado automáticamente si el titular muere. Vea [`system.lock`](lua/system/system.md).
- **Grupos de procesos** — únase a grupos con nombre y transmita a cada miembro en todos los nodos, al estilo Erlang. Vea [Grupos de Procesos](lua/core/pg.md).

Estas son deliberadamente primitivas: los bloqueos y los singletons con nombre se construyen sobre el alcance de nomenclatura Strong, los grupos de procesos sobre gossip, y todos ellos sobre la misma membresía y enrutamiento descritos anteriormente — por lo que se componen de forma predecible en lugar de que cada uno invente su propia distribución.

## Véase También

- [Guía de Cluster](guides/cluster.md) - Topología, configuración y operaciones
- [Gestión de Procesos](lua/core/process.md) - Generación, mensajería y el registro de nombres
- [Grupos de Procesos](lua/core/pg.md) - Grupos con nombre y broadcast
- [Sistema](lua/system/system.md) - `system.cluster`, `system.node`, `system.raft`, `system.lock`
- [Modelo de Procesos](concepts/process-model.md) - Procesos, PIDs y mensajería
