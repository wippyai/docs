---
title: "Host de Procesos"
description: "Los hosts de procesos gestionan la ejecución de procesos Lua usando un planificador de work-stealing."
---

# Host de Procesos

Los hosts de procesos gestionan la ejecución de procesos Lua usando un planificador de work-stealing.

<note>
Cada host planifica procesos independientemente. La carga no se distribuye entre hosts automáticamente.
</note>

## Tipo de Entrada

| Tipo | Descripción |
|------|-------------|
| `process.host` | Host de ejecución de procesos con planificador |

## Configuración

```yaml
- name: main_host
  kind: process.host
  host:
    workers: 8
    queue_size: 1024
    local_queue_size: 256
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `workers` | int | NumCPU | Goroutines worker |
| `queue_size` | int | 1024 | Capacidad de cola global |
| `local_queue_size` | int | 256 | Tamaño de deque local por worker |

## Planificador

El planificador usa work-stealing: cada worker tiene un deque local, y los workers inactivos roban de la cola global u otros workers. Esto balancea la carga automáticamente.

- **Workers** ejecutan procesos concurrentemente
- **Cola global** contiene procesos pendientes cuando todos los workers están ocupados
- **Colas locales** reducen contención manteniendo el trabajo cerca de los workers

## Tipos de Proceso

Los hosts de procesos ejecutan entradas de estos tipos:

| Tipo | Descripción |
|------|-------------|
| `process.lua` | Proceso Lua basado en fuente |
| `process.lua.bc` | Bytecode Lua precompilado |
| `process.wasm` | Proceso WebAssembly (experimental) |

Los procesos se ejecutan independientemente con su propio contexto, se comunican vía mensajes, y son supervisados para tolerancia a fallos.

## Ver También

- [Módulo Process](lua/core/process.md) - Crear y gestionar procesos desde Lua
- [Procesos WASM](wasm/processes.md) - Configuración de entradas `process.wasm`
- [Modelo de Procesos](concepts/process-model.md) - Conceptos de ciclo de vida y supervisión
- [Supervisión](guides/supervision.md) - Construcción de árboles de supervisión
