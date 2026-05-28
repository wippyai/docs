# Cluster

Wippy runs as a single node by default. Enabling the cluster turns a set of nodes into one coordinated system that shares membership, cluster-wide process names, distributed locks, and process-group messaging on top of a bounded Raft consensus core.

Clustering is off until you set `cluster.enabled: true`. Everything below is inert on a single node.

## What clustering gives you

- **Membership** — every node knows the live set of peers through gossip, with fast failure detection.
- **Cluster-wide process names** — register a process under a name that resolves from any node, with a choice of consistency guarantees (see [Naming](#naming-and-name-scopes)).
- **Distributed locks** — `system.lock` provides cluster-wide mutual exclusion with automatic release when the holder dies (see [Distributed locks](#distributed-locks)).
- **Process groups** — publish to every member of a named group across all nodes (see [Process groups](#process-groups)).
- **A consensus core** — a small, bounded Raft cluster provides the linearizable backbone the naming and lock primitives build on.

## Architecture: bounded Raft

Making every node a Raft peer scales poorly: the leader replicates every log entry to every peer, so idle leader cost grows with cluster size. Wippy bounds Raft to a fixed-size core and lets the rest of the cluster ride gossip. Each node occupies one of three roles in the Raft configuration:

| Role | Count (default) | In Raft config | Receives log replication | Votes |
|------|-----------------|----------------|--------------------------|-------|
| **Voter** | up to 5 (`max_voters`, odd) | yes | yes | yes |
| **Standby** | up to 4 (`max_standbys`) | yes | yes | no |
| **Client** | unbounded | no | no | no |

- **Voters** form the quorum. Writes commit once a majority of voters acknowledge them. The voter count is always odd so a majority is well-defined.
- **Standbys** are non-voting members kept fully replicated and warm. When a voter departs, the leader promotes the highest-ranked standby into the open voter slot, so quorum recovers without waiting for a fresh node to catch up.
- **Clients** are every node beyond `voters + standbys`. They are not in the Raft configuration at all, so the leader never sends them log entries. They participate in gossip and route writes to a Raft member. This keeps idle leader CPU flat (O(1)) no matter how large the cluster grows.

Because standbys and clients can absorb the rest of the fleet, a cluster of hundreds of nodes still has a 5-voter consensus core. The `max_voters`/`max_standbys` caps are what make the design "bounded."

### Voter selection

The leader runs a reconciler that, on every membership change (debounced by `raft.reconcile_debounce`, default 2s), recomputes which nodes should be voters and applies the minimal set of promote/demote operations. Selection is deterministic — every node derives the same ordering from the same gossip view — and is driven by three gossip-advertised hints:

- `raft.eligible` — a node with `eligible: false` is never chosen as a voter (use for nodes you want to stay clients or standbys).
- `raft.priority` — lower value is preferred when filling voter slots; ties break by node ID.
- `failure_domain` — voters are spread across distinct domains (zones/racks) first, so losing one domain cannot take out a voter majority.

Operations are applied in a quorum-preserving order: adds and promotions first, then demotions, then removals.

## Membership and gossip

Membership uses SWIM gossip (HashiCorp memberlist). Each node binds a gossip port (default **7946**) and continuously exchanges small messages with peers to detect failures and disseminate metadata.

A node joins by pointing at one or more existing nodes:

```yaml
cluster:
  enabled: true
  name: node-2
  membership:
    join_addrs: "node-1:7946"
```

The first node needs no `join_addrs` — it starts as a seed. Joins retry with backoff, and a node that finds itself isolated periodically re-attempts to rejoin, so a node restarted with a new IP (common in Kubernetes) reconverges quickly.

Gossip can be encrypted with a shared key, supplied inline or from a file:

```yaml
cluster:
  membership:
    secret_file: /etc/wippy/cluster.key
```

Membership changes (`NodeJoined`, `NodeLeft`, `NodeUpdated`) are the events that drive Raft bootstrap, voter reconciliation, process-group sync, and automatic cleanup of names owned by a departed node.

## Bootstrap

The initial cluster forms by gossip, not a static peer list. This follows the Consul/Nomad `bootstrap_expect` pattern: you tell each starting node how many nodes to expect, and they wait until they can all see each other before forming quorum together.

| `bootstrap_expect` | Behavior |
|--------------------|----------|
| `0` | Never self-bootstrap; only join a cluster that already exists |
| `1` | Single-node; bootstrap immediately with self as the only voter |
| `N` | Wait until `N` eligible peers are stably visible in gossip, then all derive the same voter list and form quorum |

For an `N`-node bootstrap, set the same `bootstrap_expect: N` on every initial node. Each advertises a "pre-bootstrap" status in gossip; once exactly `N` such peers are visible for a short stability window, every node independently computes the identical sorted voter set and forms the cluster. The stability window prevents a brief, partial view from triggering bootstrap early.

Nodes that start later see an already-formed cluster and skip bootstrap entirely — the leader's reconciler adds them as voters or standbys.

## Raft consensus core

The consensus core is **diskless**: Raft logs and snapshots live in memory only, so there is no data directory to provision. On restart, a node rejoins gossip and replays state from its peers. This deliberately removes the persistence-versus-quorum failure modes that on-disk Raft introduces, and matches the model of in-memory coordination systems (Erlang global, Akka distributed data). The trade-off: the cluster's durability comes from having a live quorum, not from disk — see [Recovery](#recovery-and-failure-modes).

Raft does not open its own listening port. It rides the **internode mesh** — the same TCP connections used for relay traffic between nodes — multiplexed with yamux. The internode port is auto-selected at boot (range 7950-7959, then ephemeral), pinned, and advertised in gossip so peers can reach it. The only port you normally expose is the gossip port.

The Raft FSM holds the global name registry: active `name -> PID` bindings plus in-flight strong reservations. That is what the naming primitives below read and write.

## Naming and name scopes

A process can be registered under a name and reached by that name instead of its raw PID. The key decision is the **scope**, which selects the consistency guarantee. Four scopes are available, from cheapest/weakest to strongest:

| Scope | Backed by | Visibility | Guarantee |
|-------|-----------|------------|-----------|
| **Local** | per-node map | this node only | Instant, node-local; no coordination |
| **Eventual** | gossip CRDT | cluster-wide | Eventually consistent; converges after gossip rounds |
| **Consistent** | Raft | cluster-wide | Linearizable writes; unique singleton across the cluster |
| **Strong** | Raft + all-node ack | cluster-wide | Consistent, plus every live node acknowledges before the name is active |

How to choose:

- **Local** — names meaningful only on one node (a per-node helper). Released the moment the process exits. Zero cost.
- **Eventual** — high-volume presence/session names where a brief stale window is acceptable. Scales to very large name counts. When two origins register the same name, conflict resolution picks a winner and the losing process receives a cancel event (`process.event.CANCEL`) carrying the reason `name revoked: <name>`; it keeps running and can re-register. Names release when the owning node leaves.
- **Consistent** — the standard choice for cluster-wide named singletons. First-write-wins: a second registration of the same name to a different PID fails with "already exists" and returns the current owner. Writes need a quorum, so they stall in a minority partition. Reads come from the local Raft replica and may lag a write by a few milliseconds.
- **Strong** — the small set of control-plane singletons where even a momentary stale read is dangerous. On top of the Consistent guarantee, the registration opens a reservation that every live node must acknowledge before the name becomes authoritative; any node already holding a conflicting binding rejects it immediately. If the deadline passes before all nodes ack, the registration expires and reports which nodes were missing. This is the basis for [distributed locks](#distributed-locks).

Names are released automatically: Local on process exit; Consistent and Strong on process exit (via topology monitoring) and on node departure; Eventual on node departure. Resolution for messaging (`process.send`, `process.terminate`, and similar) consults the planes most-authoritative first — Consistent and Strong (Raft), then Eventual (gossip), then Local — so a cluster-wide name shadows a local one with the same string.

The Lua surface for naming lives on `process.registry` (register/lookup/unregister with a scope) — see the [Process](lua/core/process.md) reference.

## Process groups

Process groups are a cluster-aware publish/subscribe and membership facility modeled on Erlang's `pg`. A process joins a named group; a broadcast to that group reaches every member across all nodes. Groups are gossip-backed and eventually consistent — independent of Raft — so they keep working even while the consensus core is converging.

Typical operations: join/leave a group, broadcast to all members (or local members only), list members, and monitor a group for join/leave events. On a new node joining, groups reconcile their membership through a direct sync handshake, and a background anti-entropy loop repairs any divergence over time.

See [Process Groups](lua/core/pg.md) for the Lua API and the [`pg.scope` entry kind](system/process-groups.md) for configuration.

## Distributed locks

`system.lock` is cluster-wide mutual exclusion built directly on the Strong name scope. Acquiring a lock registers its name under Strong scope owned by the calling process; releasing unregisters it. Because Strong requires every live node to acknowledge, at most one holder can exist cluster-wide.

```lua
local ok, err = system.lock.acquire("orders.migration")
if ok then
  -- critical section: only one holder cluster-wide
  system.lock.release("orders.migration")
end
```

Acquire is fail-fast (non-blocking): if the lock is held it returns immediately, so callers add their own retry/backoff. The lock auto-releases if the holder process exits or its node leaves, so cleanup is automatic. See the [System](lua/system/system.md) reference for the exact signatures.

## Configuration

The full key-by-key reference is in [Configuration](guides/configuration.md#cluster). The minimal shapes:

Single node (development):

```yaml
cluster:
  enabled: true
  name: dev
  raft:
    bootstrap_expect: 1
```

Three-node voting cluster:

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

Gossip-only client (joins for naming/messaging, never runs Raft):

```yaml
cluster:
  enabled: true
  name: edge-7
  membership:
    join_addrs: "node-1:7946,node-2:7946"
  raft:
    role: client
```

## Ports

| Purpose | Port | Protocol | Config key |
|---------|------|----------|------------|
| Gossip (membership) | 7946 | TCP + UDP | `cluster.membership.bind_port` |
| Internode mesh (relay + Raft) | auto | TCP | `cluster.internode.bind_port` |

There is no separate Raft port — Raft is multiplexed over the internode mesh. The internode port is auto-assigned and advertised through gossip, so only the gossip port needs predictable exposure.

## Observability

Cluster health is exposed through the standard [Prometheus endpoint](guides/observability.md) and through liveness health checks.

Key metrics to watch:

| Metric | Meaning |
|--------|---------|
| `raft_state` | 0 = follower, 1 = candidate, 2 = leader |
| `raft_term` | Current Raft term; rapid increases signal election churn |
| `raft_voters` / `raft_non_voters` | Live voters and standbys in the configuration |
| `raft_leader_changes_total` | Leader transitions; should be near-flat in a healthy cluster |
| `raft_voter_churn_burst_total` | Bursts of voter add/remove operations; sustained churn is a red flag |
| `gossip_members{state}` | Counts by state (alive/suspect/dead/left) |
| `gossip_convergence_seconds` | Time between gossip events |

Built-in liveness checks (wired to the liveness endpoint):

- **gossip** — healthy while the node's gossip health score stays low, with a boot grace window so a rejoining node is not killed prematurely.
- **raft last-contact** — a voting follower fails if it has not heard from a leader recently; a standby tolerates a much longer gap; leaders always pass.
- **process-group broadcast** — fails if a group sees no broadcast traffic for an extended period, catching a wedged event loop or a persistent partition.

## Recovery and failure modes

Because the consensus core is diskless, durability comes from a live quorum rather than from disk. The practical rules:

- Keep a voter majority alive. With 5 voters you tolerate 2 simultaneous voter failures; standbys are promoted to refill open slots. Drop below a majority and writes (new Consistent/Strong registrations and lock acquisitions) stall until quorum returns. Existing names and lookups continue to serve from local replicas.
- The leader proactively evicts a voter that is both heartbeat-silent and gossip-dead, so a dead voter does not permanently block quorum while a standby is promoted in.
- To recover a cluster that has lost quorum, restart the failed nodes. They rejoin gossip and the surviving members fold them back in. Spreading voters across `failure_domain`s is what prevents a single zone failure from causing quorum loss in the first place.

## See also

- [Configuration](guides/configuration.md#cluster) — every cluster config key
- [Process](lua/core/process.md) — registering and resolving processes by name
- [System](lua/system/system.md) — `system.cluster`, `system.raft`, `system.node`, `system.lock`
- [Observability](guides/observability.md) — metrics and health endpoints
- [Process Model](concepts/process-model.md) — actors, PIDs, and messaging
