# Message Passing

<!-- Metadata -->
<!-- 
Topic: Message Passing Mechanics
Type: Conceptual Guide
Audience: Developers learning actor model
Estimated Reading Time: 20 minutes
Prerequisites: Understanding of processes and PIDs
TOC: w.tree → core-concepts-deep → actor-model → message-passing.md
-->

**Purpose:** Master Wippy's message passing system including topics, channels, inbox patterns, and communication strategies for building robust actor-based applications.

## Plan

This guide will cover:

1. **Message Structure** - Anatomy of messages and payload handling
2. **Topic-based Routing** - Using topics for message categorization
3. **Channel Operations** - Sending, receiving, and channel management
4. **Inbox Patterns** - Default message handling and routing
5. **Synchronous vs Asynchronous** - Communication patterns and trade-offs
6. **Message Ordering** - Guarantees and best practices
7. **Error Handling** - Failed message delivery and recovery strategies

## Implementation Notes

- Show process.send() usage with different payload types
- Demonstrate process.listen() for topic-specific channels
- Explain process.inbox() for general message handling
- Include channel.select() for multi-channel operations
- Provide examples of request-response patterns
- Show error handling for message delivery failures
- Include performance considerations for high-throughput messaging

---

*Content to be written: Complete guide to message passing mechanics, communication patterns, and best practices for inter-process communication in Wippy.*
