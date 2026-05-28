# Cluster

A single Wippy node is a complete runtime. A **cluster** joins several nodes into one coordinated system: processes can be named and reached from any node, coordinate through locks and groups, and rely on a shared consensus core — without your code changing how it spawns, sends, or supervises.

Clustering is opt-in (`cluster.enabled`). This page explains the model your code sees; for topology, configuration, and operations see the [Cluster Guide](guides/cluster.md).

## The model

Nodes discover each other through **gossip** (SWIM) — a node joins by pointing at a seed, and membership and failure detection converge without a coordinator. On top of gossip sits a small, bounded **Raft** core: a fixed set of voters provides linearizable consensus, while the rest of the fleet rides gossip. Most nodes never carry consensus load, so the cluster scales out while keeping a single source of truth for the things that need one.

What the cluster gives your code reduces to three ideas: **names**, **routing**, and **coordination primitives**.

## Naming

A process is normally addressed by its PID. In a cluster it can also be registered under a **name** and reached by that name from anywhere. The one decision that matters is the **scope** — the consistency guarantee you want, traded against cost:

| Scope | Visibility | Guarantee | Use it for |
|-------|------------|-----------|------------|
| **Local** | this node | instant, no coordination | node-local helpers |
| **Eventual** | cluster-wide | converges after gossip; conflicts resolve and notify the loser | high-volume presence/session names |
| **Consistent** | cluster-wide | linearizable singleton via Raft | the standard cluster-wide named service |
| **Strong** | cluster-wide | Consistent, plus every live node acknowledges before the name is active | control-plane singletons and locks |

The scopes form a strict ordering — `Local < Eventual < Consistent < Strong` — on the consistency-versus-cost axis. You pick the weakest scope that still meets the guarantee you need. Names are registered through [`process.registry`](lua/core/process.md) and released automatically when the owning process exits (or its node leaves).

## Routing

Naming is only useful if a name reliably reaches the right process. Routing is what connects the two, and it follows a few consistent rules:

- **Reads are local.** Every node resolves a name from its own replica or gossip-disseminated cache — no network round-trip to look up a name. This keeps resolution fast and keeps working during partitions.
- **Resolution has a fixed order.** A name is resolved across the planes most-authoritative first — Consistent and Strong (Raft), then Eventual (gossip), then Local — so a cluster-wide name shadows a local one of the same string.
- **Writes route to the authority.** A Consistent or Strong registration goes through the Raft leader; a node that isn't the leader forwards the write and waits for the result. Once committed, the active binding is disseminated over gossip so every node — including those not in the Raft core — can resolve the name locally afterward.
- **Messaging routes by PID.** When you `process.send` to a name, it resolves to a PID and the relay delivers the message to the owning node. Your code addresses a process the same way whether it lives on this node or another — location is transparent.

The effect: you register and look up names without thinking about which node holds the authority, and messages find their target across the cluster the same way they do locally.

## Primitives

Clustering exposes a small set of building blocks. Each is documented in full on its own page; the concept is what they let you build:

- **Membership and identity** — the live set of nodes and this node's identity and role. Use it to discover peers or shard work. See [`system.cluster`](lua/system/system.md) and [`system.node`](lua/system/system.md).
- **Consensus state** — the Raft leader, term, and this node's role, for diagnostics and leader-aware logic. See [`system.raft`](lua/system/system.md).
- **Cluster-wide names** — register and resolve processes by name and scope, the foundation everything else builds on. See [`process.registry`](lua/core/process.md).
- **Distributed locks** — cluster-wide mutual exclusion with at most one holder, released automatically if the holder dies. See [`system.lock`](lua/system/system.md).
- **Process groups** — join named groups and broadcast to every member across all nodes, Erlang-style. See [Process Groups](lua/core/pg.md).

These are deliberately primitive: locks and named singletons are built on the Strong naming scope, process groups on gossip, and all of them on the same membership and routing described above — so they compose predictably rather than each inventing its own distribution.

## See Also

- [Cluster Guide](guides/cluster.md) - Topology, configuration, and operations
- [Process Management](lua/core/process.md) - Spawning, messaging, and the name registry
- [Process Groups](lua/core/pg.md) - Named groups and broadcast
- [System](lua/system/system.md) - `system.cluster`, `system.node`, `system.raft`, `system.lock`
- [Process Model](concepts/process-model.md) - Processes, PIDs, and messaging
