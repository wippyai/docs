---
title: "Clúster"
description: "Cómo descubren peers los nodos de Wippy, enrutan mensajes de procesos y se coordinan mediante gossip y Raft."
---

# Clúster

Un solo nodo de Wippy es un runtime completo. Un **clúster** conecta varios nodos para que los procesos puedan usar nombres de ámbito global, enrutar mensajes entre nodos y coordinarse mediante locks, grupos y un núcleo de consenso compartido.

El clustering es opcional (`cluster.enabled`). Esta página explica el modelo que observa el código; para la topología, configuración y operaciones, consulta la [Guía de clúster](../guides/cluster.md).

## Modelo de clúster

Los nodos se descubren mediante **gossip** (SWIM). Un nodo se une a través de un seed y, después, la información de membership y fallos converge sin un coordinador central. Un núcleo **Raft** limitado proporciona consenso linealizable mediante un conjunto de voters reconciliado dinámicamente, mientras los demás nodos participan mediante gossip.

El modelo visible para la aplicación tiene tres partes: **nombres**, **routing** y **primitivas de coordinación**.

## Nombres

Normalmente se dirige un proceso por su PID. En un clúster también puede registrarse con un **nombre** y alcanzarse por ese nombre desde otros nodos. El **scope** elegido determina la garantía de consistencia y el coste de coordinación:

| Ámbito | Visibilidad | Garantía | Úsalo para |
|-------|------------|-----------|------------|
| **Local** | este nodo | instantánea, sin coordinación | helpers locales del nodo |
| **Eventual** | todo el clúster | converge tras gossip; los conflictos se resuelven y notifican al perdedor | nombres de servicios, grupos y presencia acotada |
| **Consistent** | todo el clúster | singleton linealizable mediante Raft | servicio con nombre global estándar |
| **Strong** | todo el clúster | Consistent, y además cada nodo activo confirma antes de activar el nombre | singletons del control plane y locks |

Los scopes se ordenan como `Local < Eventual < Consistent < Strong` por consistencia y coste de coordinación. Elige el menos costoso que cumpla la garantía necesaria. Los nombres se registran mediante [`process.registry`](../lua/core/process.md). Los nombres Local se eliminan cuando termina el proceso; los Consistent y Strong también se recolectan cuando termina el proceso o abandona el nodo. Los Eventual se eliminan de forma explícita o cuando abandona su nodo de origen, no automáticamente cuando solo termina el proceso propietario.

## Routing

El routing conecta un nombre registrado con el proceso propietario:

- **Las lecturas son locales.** Cada nodo resuelve nombres desde su propia réplica o cache distribuida por gossip, sin round-trip de red. Esto mantiene rápida la resolución y permite que siga funcionando durante particiones.
- **La resolución sigue un orden fijo.** Se consultan primero los planes con mayor autoridad — Consistent y Strong (Raft), después Eventual (gossip) y finalmente Local —, por lo que un nombre global oculta uno local con la misma cadena.
- **Las escrituras se enrutan a la autoridad.** Un registro Consistent o Strong pasa por el líder de Raft; un nodo que no es líder reenvía la escritura y espera el resultado. Tras el commit, el binding activo se distribuye por gossip para que cada nodo, incluso fuera del núcleo Raft, pueda resolverlo localmente.
- **Los mensajes se enrutan por PID.** Al usar `process.send` con un nombre, este se resuelve a un PID y el relay entrega el mensaje al nodo propietario. El código se dirige igual a procesos locales o remotos; la ubicación es transparente.

Las aplicaciones registran y resuelven nombres sin dirigirse al nodo de autoridad. Después de resolverlos, los mensajes se encaminan al nodo propietario del PID.

## Primitivas

El clustering expone un conjunto pequeño de bloques de coordinación:

- **Membership e identidad** — el conjunto de nodos activos y la identidad y rol del nodo actual. Úsalos para descubrir peers o repartir trabajo. Consulta [`system.cluster`](../lua/system/system.md) y [`system.node`](../lua/system/system.md).
- **Estado de consenso** — líder y term de Raft, además del rol del nodo actual, para diagnóstico y lógica dependiente del líder. Consulta [`system.raft`](../lua/system/system.md).
- **Nombres globales** — registrar y resolver procesos por nombre y scope, la base del resto. Consulta [`process.registry`](../lua/core/process.md).
- **Locks distribuidos** — exclusión mutua global con un solo holder como máximo, liberada automáticamente si este muere. Consulta [`system.lock`](../lua/system/system.md).
- **Grupos de procesos** — unirse a grupos con nombre y transmitir a todos sus miembros en todos los nodos, al estilo de Erlang. Consulta [Grupos de procesos](../lua/core/pg.md).

Estas primitivas comparten la infraestructura de membership y routing. Los nombres Consistent y Strong y los locks distribuidos usan el núcleo Raft. Los grupos de procesos usan gossip membership para descubrir peers, envían cambios por relay e intercambian periódicamente el estado completo para converger.

## Véase también

- [Guía de clúster](../guides/cluster.md) — Topología, configuración y operaciones
- [Gestión de procesos](../lua/core/process.md) — Creación, mensajería y registro de nombres
- [Grupos de procesos](../lua/core/pg.md) — Grupos con nombre y broadcast
- [Sistema](../lua/system/system.md) — `system.cluster`, `system.node`, `system.raft`, `system.lock`
- [Modelo de procesos](./process-model.md) — Procesos, PID y mensajería
