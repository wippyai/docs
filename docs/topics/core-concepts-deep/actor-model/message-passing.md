# Message Passing

<!--
TOC: Core Concepts > Actor Model in Wippy > Message Passing
Audience: Developers new to actor model
Duration: 20 minutes
Prerequisites: Processes & PIDs understanding
-->

## Purpose

Master Wippy's message passing system including topics, channels, inbox patterns, and asynchronous communication strategies.

## Plan

1. **Message anatomy** - Structure and types of messages
2. **Topic-based routing** - Organizing messages by topic
3. **Channel operations** - Sending, receiving, and selecting
4. **Inbox patterns** - Default message handling strategies
5. **Asynchronous patterns** - Non-blocking communication

This guide covers the core communication mechanism that enables actor model concurrency in Wippy.

<!--
Implementation will cover:
- process.send() with topics and payloads
- process.listen() for topic-specific channels
- process.inbox() for catch-all messages
- channel.select() for multi-channel operations
- Message ordering and delivery guarantees
-->
