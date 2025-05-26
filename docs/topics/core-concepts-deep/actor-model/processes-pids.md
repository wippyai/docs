# Processes & PIDs

<!-- Metadata -->
<!-- 
Topic: Process Fundamentals
Type: Conceptual Guide
Audience: Developers new to actor model
Estimated Reading Time: 15 minutes
Prerequisites: Basic understanding of concurrency
TOC: w.tree → core-concepts-deep → actor-model → processes-pids.md
-->

**Purpose:** Deep dive into Wippy's process model, process identification, lifecycle management, and how PIDs work in distributed systems.

## Plan

This guide will cover:

1. **Process Anatomy** - Structure and internal organization of Wippy processes
2. **PID Format** - Understanding process identifiers and addressing scheme
3. **Process Spawning** - Creating processes and managing parent-child relationships
4. **Process States** - Running, stopped, failed states and state transitions
5. **Distributed PIDs** - Cross-node process identification and routing
6. **Process Registry** - Name-based addressing and service discovery
7. **Lifecycle Management** - Controlling process creation, monitoring, and termination

## Implementation Notes

- Detail PID structure: {node@host|namespace:name|procname}
- Explain spawn(), spawn_monitored(), spawn_linked() differences
- Show process registry usage for service discovery
- Include examples of cross-node process communication
- Demonstrate process state monitoring and transitions
- Provide debugging techniques for process identification
- Include performance considerations for process creation and management

---

*Content to be written: Comprehensive guide to process fundamentals, PID addressing, and lifecycle management in Wippy's actor model implementation.*
