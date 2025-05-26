# API: Message API

<!--
Title: Message API Reference
TOC: Reference → API Reference → Message API
Audience: Developers working with message-passing patterns
Duration: 15-20 minutes reference time
-->

## Purpose

Complete reference for Wippy's Message API, covering message structures, payload handling, topic management, and communication patterns between processes.

## Content Plan

This reference will document:

1. **Message Structure and Properties**
   - Message object structure and metadata
   - `message:topic()` - accessing message topics
   - `message:payload()` - payload access and unmarshaling
   - Message lifecycle and memory management

2. **Payload Handling**
   - `payload:data()` - data extraction and type conversion
   - Serialization formats and data types
   - Binary data and streaming support
   - Error handling during deserialization

3. **Topic-based Communication**
   - Topic naming conventions and best practices
   - Wildcard patterns and routing
   - Topic hierarchies and namespacing
   - Performance considerations

4. **Message Patterns**
   - Fire-and-forget messaging
   - Request-response with reply_to
   - Broadcast and multicast patterns
   - Message ordering guarantees

## Implementation Details

### Message API Components:
- **Message Objects**: Structure, properties, lifecycle
- **Payload Interface**: Data access, type conversion, streaming
- **Topic System**: Naming, routing, pattern matching
- **Communication Patterns**: Synchronous/asynchronous messaging

### Documentation Structure:
- Interface definitions with type signatures
- Usage examples for each method
- Error conditions and handling
- Performance implications
- Integration with channel operations

### Code Examples:
- Basic message sending and receiving
- Payload unmarshaling with error handling
- Topic-based routing implementation
- Complex communication patterns
- Message debugging and inspection
