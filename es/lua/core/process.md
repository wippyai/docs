# Gestión de Procesos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

Crear, monitorear y comunicarse con procesos hijos. Implementa patrones de modelo de actores con paso de mensajes, supervision y gestión de ciclo de vida.

El global `process` siempre esta disponible.

## Información de Proceso

Obtener el ID de frame actual o ID de proceso:

```lua
local frame_id = process.id()  -- Identificador de cadena de llamadas
local pid = process.pid()       -- ID de proceso
```

## Enviar Mensajes

Enviar mensaje(s) a un proceso por PID o nombre registrado:

```lua
local ok, err = process.send(destination, topic, ...)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `destination` | string | PID o nombre registrado |
| `topic` | string | Nombre de topico (no puede comenzar con `@`) |
| `...` | any | Valores de carga |

**Permiso:** `process.send` en PID objetivo

## Crear Procesos

```lua
-- Creacion basica
local pid, err = process.spawn(id, host, ...)

-- Con monitoreo (recibir eventos EXIT)
local pid, err = process.spawn_monitored(id, host, ...)

-- Con enlace (recibir LINK_DOWN en salida anormal)
local pid, err = process.spawn_linked(id, host, ...)

-- Ambos enlazado y monitoreado
local pid, err = process.spawn_linked_monitored(id, host, ...)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de fuente de proceso (ej., `"app.workers:handler"`) |
| `host` | string | ID de host (ej., `"app:processes"`) |
| `...` | any | Argumentos pasados al proceso creado |

**Permisos:**
- `process.spawn` en id de proceso
- `process.host` en id de host
- `process.spawn.monitored` en id de proceso (para variantes monitoreadas)
- `process.spawn.linked` en id de proceso (para variantes enlazadas)

## Control de Proceso

```lua
-- Terminar forzosamente un proceso
local ok, err = process.terminate(destination)

-- Solicitar cancelacion gradual con fecha limite opcional
local ok, err = process.cancel(destination, "5s")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `destination` | string | PID o nombre registrado |
| `deadline` | string\|integer | Cadena de duración o milisegundos |

**Permisos:** `process.terminate`, `process.cancel` en PID objetivo

## Monitoreo y Enlace

Monitorear o enlazar a un proceso existente:

```lua
-- Monitoreo: recibir eventos EXIT cuando el objetivo termina
local ok, err = process.monitor(destination)
local ok, err = process.unmonitor(destination)

-- Enlace: bidireccional, recibir LINK_DOWN en salida anormal
local ok, err = process.link(destination)
local ok, err = process.unlink(destination)
```

**Permisos:** `process.monitor`, `process.unmonitor`, `process.link`, `process.unlink` en PID objetivo

## Opciones de Proceso

```lua
local options = process.get_options()
local ok, err = process.set_options({trap_links = true})
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `trap_links` | boolean | Si los eventos LINK_DOWN se entregan al canal de eventos |

## Inbox y Eventos

Obtener canales para recibir mensajes y eventos de ciclo de vida:

```lua
local inbox = process.inbox()    -- Objetos Message del topico @inbox
local events = process.events()  -- Eventos de ciclo de vida del topico @events
```

### Tipos de Evento

| Constante | Descripción |
|-----------|-------------|
| `process.event.CANCEL` | Cancelacion solicitada |
| `process.event.EXIT` | Proceso monitoreado termino |
| `process.event.LINK_DOWN` | Proceso enlazado termino anormalmente |

### Campos de Evento

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `kind` | string | Constante de tipo de evento |
| `from` | string | PID de origen |
| `result` | table | Para EXIT: `{value: any}` o `{error: string}` |
| `deadline` | string | Para CANCEL: timestamp de fecha limite |

## Suscripcion a Topico

Suscribirse a topicos personalizados:

```lua
local ch = process.listen(topic, options)
process.unlisten(ch)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `topic` | string | Nombre de topico (no puede comenzar con `@`) |
| `options.message` | boolean | Si true, recibe objetos Message; si false, cargas crudas |

## Objetos Message

Al recibir de inbox o con `{message = true}`:

```lua
local msg = inbox:receive()

msg:topic()    -- string: nombre de topico
msg:from()     -- string|nil: PID del remitente
msg:payload()  -- any: datos de carga
```

## Llamada Sincrona

Crear un proceso, esperar su resultado y retornar:

```lua
local result, err = process.exec(id, host, ...)
```

**Permisos:** `process.exec` en id de proceso, `process.host` en id de host

## Actualizacion de Proceso

Actualizar el proceso actual a una nueva definicion mientras preserva PID:

```lua
-- Actualizar a nueva versión, pasando estado
process.upgrade(id, ...)

-- Mantener misma definicion, re-ejecutar con nuevo estado
process.upgrade(nil, preserved_state)
```

## Creador con Contexto

Crear un creador con contexto personalizado para procesos hijos:

```lua
local spawner = process.with_context({request_id = "123"})
```

**Permiso:** `process.context` en "context"

### Metodos de SpawnBuilder

SpawnBuilder es inmutable - cada método devuelve una nueva instancia:

```lua
spawner:with_context(values)      -- Agregar valores de contexto
spawner:with_actor(actor)         -- Establecer actor de seguridad
spawner:with_scope(scope)         -- Establecer alcance de seguridad
spawner:with_name(name)           -- Establecer nombre de proceso
spawner:with_message(topic, ...)  -- Encolar mensaje para enviar despues de crear
```

**Permiso:** `process.security` en "security" para `:with_actor()` y `:with_scope()`

### Metodos Spawn de Creador

```lua
spawner:spawn(id, host, ...)
spawner:spawn_monitored(id, host, ...)
spawner:spawn_linked(id, host, ...)
spawner:spawn_linked_monitored(id, host, ...)
```

Mismos permisos que funciones spawn a nivel de módulo.

## Registro de Nombres

Registrar y buscar procesos por nombre:

```lua
local ok, err = process.registry.register(name, pid)  -- pid por defecto es self
local pid, err = process.registry.lookup(name)
local ok = process.registry.unregister(name)
```

**Permisos:** `process.registry.register`, `process.registry.unregister` en nombre

## Permisos

Los permisos controlan lo que un proceso llamador puede hacer. Todas las verificaciones usan el contexto de seguridad del llamador (actor) contra el recurso objetivo.

### Evaluacion de Politica

Las politicas pueden permitir/denegar basado en:
- **Actor**: El principal de seguridad haciendo la solicitud
- **Accion**: La operación siendo realizada (ej., `process.send`)
- **Recurso**: El objetivo (PID, id de proceso, id de host o nombre)
- **Atributos**: Contexto adicional incluyendo `pid` (ID de proceso del llamador)

### Referencia de Permisos

| Permiso | Funciones | Recurso |
|---------|-----------|---------|
| `process.spawn` | `spawn*()` | id de proceso |
| `process.spawn.monitored` | `spawn_monitored()`, `spawn_linked_monitored()` | id de proceso |
| `process.spawn.linked` | `spawn_linked()`, `spawn_linked_monitored()` | id de proceso |
| `process.host` | `spawn*()`, `call()` | id de host |
| `process.send` | `send()` | PID objetivo |
| `process.exec` | `call()` | id de proceso |
| `process.terminate` | `terminate()` | PID objetivo |
| `process.cancel` | `cancel()` | PID objetivo |
| `process.monitor` | `monitor()` | PID objetivo |
| `process.unmonitor` | `unmonitor()` | PID objetivo |
| `process.link` | `link()` | PID objetivo |
| `process.unlink` | `unlink()` | PID objetivo |
| `process.context` | `with_context()` | "context" |
| `process.security` | `:with_actor()`, `:with_scope()` | "security" |
| `process.registry.register` | `registry.register()` | nombre |
| `process.registry.unregister` | `registry.unregister()` | nombre |

### Permisos Multiples

Algunas operaciones requieren multiples permisos:

| Operación | Permisos Requeridos |
|-----------|---------------------|
| `spawn()` | `process.spawn` + `process.host` |
| `spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `call()` | `process.exec` + `process.host` |
| crear con actor/scope personalizado | permisos spawn + `process.security` |

## Errores

| Condición | Tipo |
|-----------|------|
| Contexto no encontrado | `errors.INVALID` |
| Contexto de frame no encontrado | `errors.INVALID` |
| Argumentos requeridos faltantes | `errors.INVALID` |
| Prefijo de topico reservado (`@`) | `errors.INVALID` |
| Formato de duración invalido | `errors.INVALID` |
| Nombre no registrado | `errors.NOT_FOUND` |
| Permiso denegado | `errors.PERMISSION_DENIED` |
| Nombre ya registrado | `errors.ALREADY_EXISTS` |

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.

## Vea También

- [Canales](lua/core/channel.md) - Comunicación entre procesos
- [Cola de Mensajes](lua/storage/queue.md) - Mensajeria basada en colas
- [Funciones](lua/core/funcs.md) - Invocacion de funciones
- [Supervision](guides/supervision.md) - Gestión de ciclo de vida de procesos
