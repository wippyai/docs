---
title: "Cluster"
description: "Configure Wippy nodes for gossip membership, bounded Raft consensus, process naming, distributed locks, and process groups."
---

# Cluster

Wippy runs as a single node by default. Enabling clustering connects nodes through gossip membership and a bounded Raft consensus core, supporting cluster-wide process names, distributed locks, and process-group messaging.

Clustering is disabled until `cluster.enabled` is set to `true`.

## Cluster Capabilities

- **Membership** — every node knows the live set of peers through gossip, with fast failure detection.
- **Cluster-wide process names** — register a process under a name that resolves from any node, with a choice of consistency guarantees (see [Naming](#naming-and-name-scopes)).
- **Distributed locks** — `system.lock` provides cluster-wide mutual exclusion with automatic release when the holder dies (see [Distributed locks](#distributed-locks)).
- **Process groups** — publish to every member of a named group across all nodes (see [Process groups](#process-groups)).
- **Replicated key-value stores** — `store.kv.raft` (strong) and `store.kv.crdt` (eventual) replicate KV data across nodes (see [Store](system/store.md#cluster-kv-stores)).
- **A consensus core** — a small, bounded Raft cluster provides the linearizable backbone the naming and lock primitives build on.

## Architecture: Bounded Raft

Wippy limits Raft membership to a fixed-size core so the leader does not replicate every log entry to every node. Other nodes participate through gossip. Each node has one of three roles in the Raft configuration:

| Role | Count (default) | In Raft config | Receives log replication | Votes |
|------|-----------------|----------------|--------------------------|-------|
| **Voter** | up to 5 (`max_voters`, odd) | yes | yes | yes |
| **Standby** | up to 4 (`max_standbys`) | yes | yes | no |
| **Client** | unbounded | no | no | no |

- **Voters** form the quorum. Writes commit once a majority of voters acknowledge them. `max_voters` is normalized to an odd cap (default 5). With at least three eligible nodes, the reconciler also chooses an odd voter count. With two eligible nodes and a cap greater than one, both are voters; `max_voters: 1` keeps a single voter.
- **Standbys** are non-voting members kept fully replicated and warm. When a voter departs, the leader promotes the highest-ranked standby into the open voter slot, so quorum recovers without waiting for a fresh node to catch up.
- **Clients** are nodes beyond `voters + standbys`. They are not in the Raft configuration, so the leader does not send them log entries. They participate in gossip and route writes to a Raft member, keeping Raft replication bounded by the configured core size.

The `max_voters` and `max_standbys` settings cap the consensus core independently of the total cluster size.

### Voter Selection

The leader runs a reconciler that, on every membership change (debounced by `raft.reconcile_debounce`, default 2s), recomputes which nodes should be voters and applies the minimal set of promote/demote operations. Selection is deterministic — every node derives the same ordering from the same gossip view — and is driven by three gossip-advertised hints:

- `raft.eligible` — a node with `eligible: false` is excluded from both voter and standby selection and remains outside Raft as a client. Keep a node eligible but below the voter cutoff when it should serve as a standby.
- `raft.priority` — lower value is preferred when filling voter slots; ties break by node ID.
- `failure_domain` — voters are spread across distinct domains (zones/racks) first, reducing the risk that one domain failure removes a voter majority.

Operations are applied in a quorum-preserving order: adds and promotions first, then demotions, then removals.

## Membership and Gossip

Membership uses SWIM gossip (HashiCorp memberlist). Each node binds a gossip port (default **7946**) and continuously exchanges small messages with peers to detect failures and disseminate metadata.

A node joins by pointing at one or more existing nodes:

```yaml
cluster:
  enabled: true
  name: node-2
  membership:
    join_addrs: "node-1:7946"
  internode:
    identity_key_file: /etc/wippy/node-2.identity
    trusted_peer_keys:
      node-1: "${env:NODE_1_PUBLIC_KEY}"
      node-2: "${env:NODE_2_PUBLIC_KEY}"
```

The first node needs no `join_addrs`; it starts as a seed. Joins retry with backoff, and an isolated node periodically attempts to rejoin. This supports nodes that restart with a new IP, as commonly occurs in Kubernetes.

Gossip can be encrypted with a shared key, supplied inline or from a file:

```yaml
cluster:
  membership:
    secret_file: /etc/wippy/cluster.key
```

The gossip key protects membership traffic. Internode TCP connections use a separate Ed25519 identity. Every clustered node must provide either `internode.identity_key` or `internode.identity_key_file`, and `trusted_peer_keys` must contain the matching public key for the local node as well as every peer it can connect to. `identity_key` contains a base64-encoded 32-byte seed or 64-byte private key; trusted peer values are base64-encoded public keys. Give each node its own private key and deploy the same trusted-public-key map to all nodes.

Membership changes (`NodeJoined`, `NodeLeft`, `NodeUpdated`) are the events that drive Raft bootstrap, voter reconciliation, process-group sync, and automatic cleanup of names owned by a departed node.

## Bootstrap

The initial cluster forms through gossip rather than a static peer list. With the Consul/Nomad-style `bootstrap_expect` setting, each starting node waits until the configured number of eligible nodes, including itself, is visible before forming quorum.

| `bootstrap_expect` | Behavior |
|--------------------|----------|
| `0` | Never self-bootstrap; only join a cluster that already exists |
| `1` | Single-node; bootstrap immediately with self as the only voter |
| `N` | Wait until `N` eligible nodes, including the local node, are stably visible in gossip, then all derive the same voter list and form quorum |

For an `N`-node bootstrap, set the same `bootstrap_expect: N` on every initial node. Each advertises a "pre-bootstrap" status in gossip; once exactly `N` such nodes, including itself, are visible for a short stability window, every node independently computes the identical sorted voter set and forms the cluster. The stability window prevents a brief, partial view from triggering bootstrap early.

Nodes that start later see an already-formed cluster and skip bootstrap entirely — the leader's reconciler adds them as voters or standbys.

## Raft Consensus Core

Raft state is **fs-durable by default**: logs and snapshots are persisted under `cluster.raft.data_dir` (default `~/.wippy/store`, in `_sys/raft`), and [`store.kv.raft`](system/store.md#cluster-kv-stores) replicates through the same core. A restarting node still rejoins gossip and catches up from its peers, so the cluster also tolerates losing a node's disk; durability comes from both the live quorum and on-disk state. A node runs diskless only when no data directory resolves (no configured path and no home directory) — see [Recovery](#recovery-and-failure-modes).

Raft does not open its own listening port. It rides the **internode mesh** — the same TCP connections used for relay traffic between nodes — carrying its RPCs as internode request/reply frames over the mesh's reliable per-class channels. The internode port is auto-selected at boot (range 7950-7959, then ephemeral), pinned, and advertised in gossip so peers can reach it. Nodes must be mutually reachable on both the gossip port and their advertised internode TCP ports.

The Raft FSM holds the global name registry: active `name -> PID` bindings plus in-flight strong reservations. That is what the naming primitives below read and write.

## Naming and Name Scopes

A process can be registered and addressed by name instead of its raw PID. Its **scope** selects the consistency and coordination behavior. Four scopes are available, ordered from local to strongest:

| Scope | Backed by | Visibility | Guarantee |
|-------|-----------|------------|-----------|
| **Local** | per-node map | this node only | Instant, node-local; no coordination |
| **Eventual** | gossip CRDT | cluster-wide | Eventually consistent; converges after gossip rounds |
| **Consistent** | Raft | cluster-wide | Linearizable writes; unique singleton across the cluster |
| **Strong** | Raft + all-node ack | cluster-wide | Consistent, plus every live node acknowledges before the name is active |

How to choose:

- **Local** — names meaningful only on one node, such as a per-node helper. Released when the process exits and requires no cluster coordination.
- **Eventual** — cluster-wide service, group, and presence names where a brief stale window is acceptable. The binding set is fully replicated to every node, so it fits a bounded namespace — not one name per high-cardinality entity such as a per-session process (address those directly by PID). When two origins register the same name, conflict resolution picks a winner and the losing process receives a cancel event (`process.event.CANCEL`) carrying the reason `name revoked: <name>`; it keeps running and can re-register. Names release when the owning node leaves.
- **Consistent** — the standard choice for cluster-wide named singletons. First-write-wins: a second registration of the same name to a different PID fails with "already exists" and returns the current owner. Writes need a quorum, so they stall in a minority partition. Reads come from the local Raft replica and may lag a write by a few milliseconds.
- **Strong** — the small set of control-plane singletons where even a momentary stale read is dangerous. On top of the Consistent guarantee, the registration opens a reservation that every live node must acknowledge before the name becomes authoritative; any node already holding a conflicting binding rejects it immediately. If the deadline passes before all nodes ack, the registration expires and reports which nodes were missing.

Names are released automatically: Local on process exit; Consistent and Strong on process exit (via topology monitoring) and on node departure; Eventual on node departure. Resolution for messaging (`process.send`, `process.terminate`, and similar) consults the planes most-authoritative first — Consistent and Strong (Raft), then Eventual (gossip), then Local — so a cluster-wide name shadows a local one with the same string.

The Lua surface for naming lives on `process.registry` (register/lookup/unregister with a scope) — see the [Process](lua/core/process.md) reference.

## Process Groups

Process groups are a cluster-aware publish/subscribe and membership facility modeled on Erlang's `pg`. A process joins a named group; a broadcast fans out over the internode mesh to the group's members across all nodes, delivered best-effort. Groups are eventually consistent and independent of Raft — they use the gossip membership view to choose recipients — so they keep working even while the consensus core is converging.

Typical operations: join/leave a group, broadcast to all members (or local members only), list members, and monitor a group for join/leave events. On a new node joining, groups reconcile their membership through a direct sync handshake, and a background anti-entropy loop repairs any divergence over time.

See [Process Groups](lua/core/pg.md) for the Lua API and the [`pg.scope` entry kind](system/process-groups.md) for configuration.

## Distributed Locks

`system.lock` is cluster-wide mutual exclusion built on a raft-linearizable conditional write in the shared key-value store. Acquiring a lock performs a set-if-absent of the holder PID at `_sys:lock:<name>`; releasing deletes that entry if it is still held by the caller. Because the conditional write goes through Raft (with off-leader writes forwarded to the leader), it is linearizable, so at most one holder can exist cluster-wide.

```lua
local ok, err = system.lock.acquire("orders.migration")
if ok then
  -- critical section: only one holder cluster-wide
  system.lock.release("orders.migration")
end
```

Acquire is fail-fast (non-blocking): if the lock is held, it returns immediately, so callers provide their own retry and backoff. The lock is released if the holder process exits or its node leaves. See the [System](lua/system/system.md) reference for exact signatures.

## Configuration

See [Configuration](guides/configuration.md#cluster) for related cluster settings. These minimal shapes include the mandatory internode identity settings.

Single node (development):

```yaml
cluster:
  enabled: true
  name: dev
  internode:
    identity_key: "${env:DEV_PRIVATE_KEY}"
    trusted_peer_keys:
      dev: "${env:DEV_PUBLIC_KEY}"
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
  internode:
    identity_key_file: /etc/wippy/node-1.identity
    trusted_peer_keys:
      node-1: "${env:NODE_1_PUBLIC_KEY}"
      node-2: "${env:NODE_2_PUBLIC_KEY}"
      node-3: "${env:NODE_3_PUBLIC_KEY}"
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
  internode:
    identity_key_file: /etc/wippy/edge-7.identity
    trusted_peer_keys:
      node-1: "${env:NODE_1_PUBLIC_KEY}"
      node-2: "${env:NODE_2_PUBLIC_KEY}"
      edge-7: "${env:EDGE_7_PUBLIC_KEY}"
  raft:
    role: client
```

## Ports

| Purpose | Port | Protocol | Config key |
|---------|------|----------|------------|
| Gossip (membership) | 7946 | TCP + UDP | `cluster.membership.bind_port` |
| Internode mesh (relay + Raft) | auto | TCP | `cluster.internode.bind_port` |

Raft is multiplexed over the internode mesh rather than using a separate port. The internode port is assigned automatically and advertised through gossip. The gossip port is predictable by default, but peers must also be able to reach each node's advertised internode TCP port.

## Observability

Cluster health is exposed through the standard [Prometheus endpoint](guides/observability.md) and through liveness health checks.

Key metrics to watch:

| Metric | Meaning |
|--------|---------|
| `raft_state` | 0 = follower, 1 = candidate, 2 = leader |
| `raft_term` | Current Raft term; rapid increases signal election churn |
| `raft_voters` / `raft_non_voters` | Live voters and standbys in the configuration |
| `raft_leader_changes_total` | Leader transitions; should be near-flat in a healthy cluster |
| `raft_voter_churn_burst_total` | Bursts of voter add/remove operations; sustained churn indicates instability |
| `gossip_members{state}` | Counts by state (alive/suspect/dead/left) |
| `gossip_convergence_seconds` | Time between gossip events |

Built-in liveness checks (wired to the liveness endpoint):

- **gossip** — healthy while the node's gossip health score stays low, with a boot grace window so a rejoining node is not killed prematurely.
- **raft last-contact** — a voting follower fails if it has not heard from a leader recently; a standby tolerates a much longer gap; leaders always pass.
- **process-group broadcast** — fails when the process-group service has neither sent nor received any broadcast for its activity ceiling, catching a wedged service or a persistent partition.

## Recovery and Failure Modes

Raft state is fs-durable, but the cluster's primary durability still comes from a live quorum. The practical rules:

- Keep a voter majority alive. With 5 voters you tolerate 2 simultaneous voter failures; standbys are promoted to refill open slots. Drop below a majority and writes (new Consistent/Strong registrations and lock acquisitions) stall until quorum returns. Locally replicated state can still answer some reads, but do not treat those reads as proof that a partitioned node has the latest value.
- The leader proactively evicts a voter that is both heartbeat-silent and gossip-dead, so a dead voter does not permanently block quorum while a standby is promoted in.
- To recover a cluster that has lost quorum, restart the failed nodes. They rejoin gossip and the surviving members fold them back in. Spreading voters across `failure_domain`s reduces the chance that a single zone failure causes quorum loss.

## See Also

- [Configuration](guides/configuration.md#cluster) — related cluster settings
- [Process](lua/core/process.md) — registering and resolving processes by name
- [System](lua/system/system.md) — `system.cluster`, `system.raft`, `system.node`, `system.lock`
- [Observability](guides/observability.md) — metrics and health endpoints
- [Process Model](concepts/process-model.md) — actors, PIDs, and messaging
