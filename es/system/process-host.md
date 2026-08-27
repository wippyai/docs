---
title: "Host de Procesos"
description: "Los hosts de procesos gestionan la ejecución de procesos Lua y WebAssembly mediante un scheduler de work-stealing."
---

# Host de Procesos

Un `process.host` ejecuta procesos Lua y WebAssembly en un scheduler de work-stealing. Esta página es una referencia de configuración y lifecycle; el bloque YAML es un fragmento de entrada.

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
| `queue_size` | int | 1024 | Capacidad inicial de la cola global |
| `local_queue_size` | int | 256 | Capacidad inicial del deque local de cada worker |

Ambas colas crecen cuando se agota su capacidad inicial. Los valores deben ser positivos después de aplicar los valores predeterminados. La cola global limita su capacidad inicial efectiva a un mínimo de 16; cada deque local redondea su capacidad hacia arriba a una potencia de dos.

## Lifecycle

Un host de procesos es un servicio gestionado por el supervisor. `lifecycle.auto_start` tiene como valor predeterminado `false`; un host que no se haya iniciado rechaza los spawns de procesos. También se aplican los campos estándar de lifecycle, incluidos `requires`, `startup`, `start_timeout`, `stop_timeout`, `stable_threshold`, `restart` y `security`.

Detener un host es terminal para esa instancia. El scheduler envía un evento de cancelación a cada proceso, espera a que terminen hasta que expire el contexto de parada y después cancela y cierra los procesos restantes.

Las actualizaciones en vivo pueden cambiar el tamaño de `host.workers`. Los cambios en los tamaños de las colas o en la configuración del lifecycle se rechazan y requieren sustituir el host. Cuando la afinidad de CPU gestiona el conjunto de workers, tampoco se puede cambiar en vivo su número.

## Planificador

El planificador usa work-stealing: cada worker tiene un deque local, y los workers inactivos roban de la cola global u otros workers. Esto balancea la carga automáticamente.

- **Workers** ejecutan procesos concurrentemente.
- **Cola global** contiene procesos pendientes cuando todos los workers están ocupados.
- **Colas locales** reducen la contención manteniendo el trabajo cerca de los workers.

## Tipos de Proceso

Los hosts de procesos ejecutan entradas de estos tipos:

| Tipo | Descripción |
|------|-------------|
| `process.lua` | Proceso Lua basado en fuente |
| `process.lua.bc` | Bytecode Lua precompilado |
| `process.wasm` | Proceso WebAssembly (experimental) |

Los procesos se ejecutan de forma independiente con su propio contexto de frame y se comunican mediante mensajes. La seguridad configurada en la entrada del proceso se aplica al frame de ese proceso antes de ejecutarlo. Los monitores, enlaces y supervisores de la aplicación pueden reaccionar a un fallo; el host de procesos no reinicia automáticamente todos los procesos fallidos.

## Ver También

- [Módulo Process](../lua/core/process.md) - Crear y gestionar procesos desde Lua
- [Procesos WASM](../wasm/processes.md) - Configuración de entradas `process.wasm`
- [Modelo de procesos](../concepts/process-model.md) - Conceptos de lifecycle y supervisión
- [Supervisión](../guides/supervision.md) - Construcción de árboles de supervisión
