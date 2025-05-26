# Supervision Trees

<!--
TOC: Core Concepts > Actor Model in Wippy > Supervision Trees
Audience: Developers new to actor model
Duration: 25 minutes
Prerequisites: Message Passing understanding
-->

## Purpose

Learn how to build fault-tolerant systems using Wippy's supervision trees, process linking, monitoring, and failure recovery strategies.

## Plan

1. **Supervision principles** - Fault tolerance through process hierarchies
2. **Process linking** - Bi-directional failure propagation
3. **Process monitoring** - One-way failure notifications
4. **Restart strategies** - Handling process failures gracefully
5. **Tree architectures** - Designing supervision hierarchies

This guide shows how to build resilient systems that can recover from failures automatically.

<!--
Implementation will cover:
- spawn_linked() and spawn_monitored() functions
- process.link() and process.monitor() operations
- trap_links option for custom failure handling
- System events: EXIT, CANCEL, LINK_DOWN
- Supervisor process patterns and restart policies
-->
