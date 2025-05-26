# Agent Architecture

<!--
TOC: Core Concepts > AI Agents Framework > Agent Architecture
Audience: Developers familiar with LLMs
Duration: 20 minutes
Prerequisites: Basic LLM understanding
-->

## Purpose

Understand how Wippy's AI agents are structured, configured, and integrated with the actor model runtime for scalable AI applications.

## Plan

1. **Agent as process** - How agents run within Wippy's actor model
2. **Configuration-driven design** - YAML-based agent definitions
3. **Component integration** - Connecting agents to tools and data
4. **Runtime behavior** - How agents process messages and generate responses
5. **Scaling patterns** - Multiple agent instances and load distribution

This guide explains the architectural foundation that makes Wippy agents powerful and scalable.

<!--
Implementation will cover:
- agent.gen1 registry entry structure
- Agent process lifecycle and message handling
- System message construction from prompts and traits
- Tool integration and function calling
- Memory management and context handling
- Agent-to-agent communication patterns
-->
