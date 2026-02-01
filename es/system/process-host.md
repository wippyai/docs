# Host de Procesos

Los hosts de procesos gestionan la ejecucion de procesos Lua usando un planificador de work-stealing.

<note>
Cada host planifica procesos independientemente. La carga no se distribuye entre hosts automaticamente.
</note>

## Tipo de Entrada

| Tipo | Descripcion |
|------|-------------|
| `process.host` | Host de ejecucion de procesos con planificador |

## Configuracion

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

| Campo | Tipo | Por Defecto | Descripcion |
|-------|------|---------|-------------|
| `workers` | int | NumCPU | Goroutines worker |
| `queue_size` | int | 1024 | Capacidad de cola global |
| `local_queue_size` | int | 256 | Tamano de deque local por worker |

## Planificador

El planificador usa work-stealing: cada worker tiene un deque local, y los workers inactivos roban de la cola global u otros workers. Esto balancea la carga automaticamente.

- **Workers** ejecutan procesos concurrentemente
- **Cola global** contiene procesos pendientes cuando todos los workers estan ocupados
- **Colas locales** reducen contension manteniendo el trabajo cerca de los workers

## Tipos de Proceso

Los hosts de procesos ejecutan entradas de estos tipos:

| Tipo | Descripcion |
|------|-------------|
| `lua.process` | Proceso Lua basado en fuente |
| `lua.process.bytecode` | Bytecode Lua precompilado |

<note>
Tipos de proceso adicionales estan planeados para futuras versiones.
</note>

Los procesos se ejecutan independientemente con su propio contexto, se comunican via mensajes, y son supervisados para tolerancia a fallos.
