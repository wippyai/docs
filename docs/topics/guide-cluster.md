# Cluster Mode

Wippy supports multi-node clustering with gossip-based discovery and direct inter-node communication.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Cluster                                 │
│                                                              │
│  ┌─────────┐    gossip (7946)    ┌─────────┐               │
│  │ Node A  │◄───────────────────►│ Node B  │               │
│  │         │                      │         │               │
│  │ :7950   │◄────── TCP ────────►│ :7951   │               │
│  └─────────┘    (internode)       └─────────┘               │
│       ▲                                ▲                     │
│       │          gossip (7946)         │                     │
│       └────────────┬───────────────────┘                     │
│                    ▼                                         │
│              ┌─────────┐                                    │
│              │ Node C  │                                    │
│              │ :7952   │                                    │
│              └─────────┘                                    │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

```yaml
cluster:
  enabled: true
  name: node-1              # Defaults to hostname

  membership:
    bind_addr: "0.0.0.0"
    bind_port: 7946
    join_addrs: "10.0.0.1:7946,10.0.0.2:7946"
    secret_key: "base64-encoded-key"   # Optional encryption

  internode:
    bind_addr: "0.0.0.0"
    bind_port: 7950         # 0 = auto-select
```

## Membership Discovery

Uses HashiCorp memberlist (gossip protocol):

- Nodes discover each other via seed addresses
- Membership changes propagate automatically
- Optional encryption with shared secret key

### Events

Published to event bus:

| Event | Description |
|-------|-------------|
| `cluster.node.joined` | New node discovered |
| `cluster.node.left` | Node departed |
| `cluster.node.updated` | Node metadata changed |

## Inter-Node Communication

Direct TCP connections for message passing:

- Binary protocol with MessagePack encoding
- Persistent connections with automatic reconnect
- Exponential backoff retry (10ms → 5s)
- Message queuing during reconnect

### Routing

Messages route automatically:

1. Local node - direct delivery
2. Registered peers - via peer connection
3. Cluster nodes - via internode TCP

## Bootstrap

### First Node

```yaml
# node-1.yaml
cluster:
  enabled: true
  name: node-1
  membership:
    bind_port: 7946
    # No join_addrs - becomes bootstrap node
```

### Additional Nodes

```yaml
# node-2.yaml
cluster:
  enabled: true
  name: node-2
  membership:
    bind_port: 7946
    join_addrs: "10.0.0.1:7946"   # Join existing cluster
```

## NAT / Cloud

For nodes behind NAT or in cloud environments:

```yaml
cluster:
  membership:
    bind_addr: "0.0.0.0"
    bind_port: 7946
    advertise_addr: "203.0.113.10:7946"   # Public address
```

## Encryption

Generate a secret key:

```bash
openssl rand -base64 32 > /etc/wippy/cluster.key
```

Configure:

```yaml
cluster:
  membership:
    secret_file: /etc/wippy/cluster.key
    # Or inline:
    # secret_key: "your-base64-key"
```

All nodes must use the same key.

## Port Summary

| Port | Protocol | Purpose |
|------|----------|---------|
| 7946 | UDP/TCP | Gossip membership |
| 7950-7959 | TCP | Inter-node messages |

## See Also

- [Configuration Reference](guide-configuration.md) - All config options
- [Process Model](concept-process-model.md) - Process communication
