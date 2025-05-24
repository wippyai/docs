# Wippy Documentation Index

<tldr>
Wippy is a powerful runtime system for AI applications offering language parsing, agent frameworks, data handling, security, and more. This index provides an organized overview of all core modules and their functionalities.
</tldr>

Welcome to the **Wippy Documentation**! This guide provides an organized overview of the Wippy platform, its core modules, and their functionalities. Wippy is a powerful runtime system designed for AI applications, offering tools for language parsing, agent frameworks, data handling, security, and more.

Use this index to explore the key components of Wippy and understand how they can enhance your development workflow.

## Core Modules

The core modules of Wippy provide foundational tools for language parsing, syntax tree manipulation, and query processing.

- **Tree-sitter Integration**: Enables language parsing, abstract syntax tree (AST) generation, and syntax tree manipulation.
- **Cursor System**: Facilitates efficient navigation of syntax trees with stateful position tracking.
- **Query Language**: Supports pattern matching and information extraction from syntax trees.

## AI and Agent Framework

Wippy offers a robust framework for building AI agents and interacting with large language models (LLMs).

- **Agent Framework**: A configuration-driven system for defining AI agents with traits, tools, and memory management.
- **LLM Interface**: Unified interface for working with large language models, including text generation and embeddings.

## Development Tools

These tools help developers follow best practices, debug effectively, and maintain high-quality codebases.

- **Basics**: Introduction to Wippy development patterns and runtime organization.
- **Logging**: Structured logging interface with contextual fields and hierarchical loggers.
- **Testing Framework**: BDD-style testing framework for Lua applications, with support for assertions and mocking.

## Data Handling

Modules for managing and transforming data in various formats, including JSON, YAML, and Excel.

- **Base64 Encoding**: Functions for encoding and decoding data using the Base64 standard.
- **JSON Utilities**: Tools for encoding and decoding Lua values and JSON strings.
- **YAML Utilities**: Functions for handling Lua tables and YAML strings.
- **Excel Module**: Read, write, and manipulate Excel files in XLSX format.

## Security and Permissions

Comprehensive frameworks for managing authentication, authorization, and access control.

- **Security Framework**: Tools for managing authentication, authorization, and access control.
- **Security Supervisor**: High-level integration for managing security permissions and policies.

## System and Runtime

Modules for managing system-level operations, runtime processes, and concurrent programming.

- **Actor Model**: Implementation of the actor model pattern for concurrent processing and message passing.
- **Process API**: Tools for managing process lifecycles and communication in a concurrent environment.
- **System Information**: Access runtime information such as memory statistics and system monitoring.

## Networking and Communication

Networking modules for handling HTTP requests, WebSocket connections, and real-time communication.

- **HTTP Module**: Handle HTTP requests and responses with support for headers, query parameters, and streaming.
- **HTTP Client**: Make HTTP requests with various methods and options.
- **WebSocket**: Establish WebSocket connections for real-time communication.

## Storage and Filesystems

Tools for interacting with filesystems, cloud storage, and key-value stores.

- **Filesystem Abstraction**: Universal interface for file operations and directory management.
- **Cloud Storage**: Interact with cloud storage providers for uploading, downloading, and generating temporary URLs.
- **Key-Value Store**: Manage structured data with support for time-to-live (TTL) operations.

## Utilities

A collection of utility modules for cryptography, hashing, time management, and UUID generation.

- **Cryptography**: Tools for encryption, decryption, JWT handling, and secure random generation.
- **Hash Functions**: Calculate cryptographic and non-cryptographic hash values.
- **Time Utilities**: Work with dates, timers, durations, and timezones.
- **UUID Utilities**: Generate and manipulate UUIDs across multiple versions.

## Database and Registry

Modules for interacting with databases and managing registry entries.

- **SQL Module**: Interface for SQL operations, including queries, transactions, and type conversion.
- **Semantic Search**: Advanced search capabilities for AI-powered document and semantic search.
- **Registry System**: Distributed system for managing and querying registry entries.

## Event and Task Management

Modules for managing events and executing tasks in a synchronous or asynchronous manner.

- **Event Bus**: Subscribe to and process events using a channel-based API.
- **Task Execution**: Execute tasks synchronously or asynchronously with context management.

## Templates and Resources

Tools for working with templates and rendering dynamic content.

- **Jet Templating**: A flexible templating system for AI applications.
- **Template Renderer**: Render templates with variable substitution and resource management.

---

This documentation is designed to help developers and AI practitioners leverage Wippy's powerful runtime system. Explore the modules to learn more about their capabilities and how they can be integrated into your projects.
