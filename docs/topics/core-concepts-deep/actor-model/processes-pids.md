# Processes & PIDs

<!--
TOC: Core Concepts > Actor Model in Wippy > Processes & PIDs
Audience: Developers new to actor model
Duration: 15 minutes
Prerequisites: Basic understanding of concurrency
-->

## Purpose

Deep dive into Wippy's process model, process identification, lifecycle management, and how PIDs work in distributed systems.

## Plan

1. **Process anatomy** - Structure and lifecycle of Wippy processes
2. **PID format** - Understanding process identifiers and addressing
3. **Process spawning** - Creating processes and managing relationships
4. **Process states** - Running, stopped, failed, and transitions
5. **Distributed PIDs** - Cross-node process identification

This guide explains the fundamental unit of computation in Wippy's actor model and how processes are managed.

<!--
Implementation will cover:
- Process lifecycle from spawn to termination
- PID structure: {node@host|namespace:name|procname}
- spawn(), spawn_monitored(), spawn_linked() functions
- Process registry for name-based addressing
- Node distribution and multi-host PIDs
-->
