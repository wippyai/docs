---
title: "Gestión de Procesos"
description: "Crea, monitoriza, enlaza, envía mensajes, asigna nombres y actualiza procesos de Wippy."
---

# Gestión de Procesos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

El global `process` permite crear procesos, enviar mensajes, monitorizar, enlazar, asignar nombres y controlar el ciclo de vida.

Está disponible sin `require()` y no necesita incluirse en `modules:`.

Esta es una referencia de API. Sus bloques de formas de llamada usan marcadores como `id`, `host`, `destination`, `topic` y `name` para valores proporcionados por el código de la aplicación; no son programas independientes. Las llamadas mostradas con un resultado `err` devuelven su valor documentado en caso de éxito o un centinela de fallo más `error`; el centinela suele ser `nil`, mientras que `process.set_options` devuelve `false`. El flujo de control de la aplicación debe manejar el error.

## Información del proceso

Lee el ID del frame actual o el ID del proceso:

```lua
local frame_id, err = process.id()  -- Registry ID of the current function, process, or workflow definition
if err then return nil, err end

local pid, err = process.pid()      -- Process ID
if err then return nil, err end
```

## Envío de mensajes

Envía uno o varios valores de payload a un proceso por PID o nombre registrado:

```lua
local ok, err = process.send(destination, topic, ...)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `destination` | string | PID o nombre registrado |
| `topic` | string | Nombre del tema (no puede comenzar con `@`) |
| `...` | any | Valores de payload |

**Permiso:** `process.send` sobre el PID destino

## Creación de procesos

```lua
-- Basic spawn
local pid, err = process.spawn(id, host, ...)

-- With monitoring (receive EXIT events)
local pid, err = process.spawn_monitored(id, host, ...)

-- With linking (receive LINK_DOWN on abnormal exit)
local pid, err = process.spawn_linked(id, host, ...)

-- Both linked and monitored
local pid, err = process.spawn_linked_monitored(id, host, ...)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de fuente del proceso (ej., `"app.workers:handler"`) |
| `host` | string | ID del host (ej., `"app:processes"`) |
| `...` | any | Argumentos pasados al proceso lanzado |

Todas las variantes requieren `process.spawn` sobre el ID del proceso. Las variantes monitorizadas también requieren `process.spawn.monitored`, y las variantes enlazadas requieren `process.spawn.linked`. En runtime v0.3.32a, solo `spawn()` a nivel de módulo comprueba `process.host` sobre el ID del host; las variantes especializadas a nivel de módulo no realizan esa comprobación de permiso del host.

## Control de procesos

```lua
-- Forcefully terminate a process
local ok, err = process.terminate(destination)

-- Request graceful cancellation with an optional reason
local ok, err = process.cancel(destination, "shutting down")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `destination` | string | PID o nombre registrado |
| `reason` | string | Motivo opcional entregado al destino |

**Permisos:** `process.terminate`, `process.cancel` sobre el PID destino

## Monitorización y enlaces

Añade o elimina la monitorización y los enlaces de un proceso existente:

```lua
-- Monitoring: receive EXIT events when target exits
local ok, err = process.monitor(destination)
local ok, err = process.unmonitor(destination)

-- Linking: bidirectional, receive LINK_DOWN on abnormal exit
local ok, err = process.link(destination)
local ok, err = process.unlink(destination)
```

**Permisos:** `process.monitor`, `process.unmonitor`, `process.link`, `process.unlink` sobre el PID destino

## Opciones del proceso

```lua
local options = process.get_options()
local ok, err = process.set_options({trap_links = true})
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `trap_links` | boolean | Si los eventos LINK_DOWN se entregan al canal de eventos |
| `upgradable` | boolean | Optar por eventos OUTDATED cuando se invalida el código del proceso |

## Buzón y eventos

Usa los canales de buzón y eventos para recibir mensajes y eventos de ciclo de vida:

```lua
local inbox = process.inbox()    -- Message objects from @inbox topic
local events = process.events()  -- Lifecycle events from @events topic
```

### Tipos de evento

| Constante | Descripción |
|----------|-------------|
| `process.event.CANCEL` | Cancelación solicitada |
| `process.event.EXIT` | Proceso monitorizado ha salido |
| `process.event.LINK_DOWN` | Proceso enlazado terminó de forma anormal |
| `process.event.OUTDATED` | El código del proceso o una dependencia importada cambió en el registro |

### Campos del Evento

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `kind` | string | Constante del tipo de evento |
| `from` | string | PID de origen |
| `result` | table | Para EXIT/LINK_DOWN: un registro {value, error}; el valor devuelto por el proceso está en `result.value` y cualquier error en `result.error` |
| `reason` | string | Para CANCEL: por qué se está cancelando el proceso |
| `sources` | string[] | Para OUTDATED: IDs del registro que cambiaron o fueron afectados transitivamente |

`OUTDATED` se entrega solo a los procesos que optan por él con `process.set_options({upgradable = true})`. Varias invalidaciones se combinan en un único evento pendiente que contiene la unión de sus `sources`. Maneja el evento llamando a [`process.upgrade`](#process-upgrade).

## Suscripción a temas

Suscríbete a un tema de mensajes personalizado:

```lua
local ch, err = process.listen(topic, options)
if err then return nil, err end

local ok, err = process.unlisten(ch)
if err then return nil, err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `topic` | string | Nombre del tema (no puede comenzar con `@`) |
| `options.message` | boolean | Si es true, recibe objetos Message; si es false, payloads sin procesar |

## Objetos de mensaje

El buzón y los listeners configurados con `{message = true}` devuelven objetos de mensaje:

```lua
local msg = inbox:receive()

msg:topic()            -- string: topic name
msg:from()             -- string|nil: sender PID
msg:payload()          -- Payload: wrapper (call :data() to extract)
msg:payload():data()   -- any: actual payload value
```

## Llamada síncrona

`process.exec` crea un proceso y espera su resultado:

```lua
local result, err = process.exec(id, host, ...)
```

**Permisos:** `process.exec` sobre el id del proceso, `process.host` sobre el id del host

## Actualización de procesos :id=process-upgrade

Actualiza el proceso actual conservando su PID:

Los dos fragmentos siguientes son formas de llamada alternativas, no operaciones secuenciales.

```lua
-- Upgrade to new version, passing state
process.upgrade(id, ...)
```

```lua
-- Keep same definition, re-run with new state
process.upgrade(nil, preserved_state)
```

`process.upgrade` es una transferencia de control terminal: borra la ejecución actual e inicia la definición solicitada con el mismo PID. El código posterior a la llamada no se ejecuta en la ejecución anterior.

## Spawner con contexto

Crea un spawner que proporciona contexto personalizado a los procesos hijos:

```lua
local spawner = process.with_context({request_id = "123"})
```

**Permiso:** `process.context` sobre "context"

### Spawner con opciones

`process.with_options(options)` crea un spawner con opciones de creación, como un selector de red, en lugar de valores de contexto:

```lua
local spawner = process.with_options({network = "app:tor_proxy"})
```

| Opción | Tipo | Descripción |
|--------|------|-------------|
| `network` | string | ID de registro de una entrada `network.*` que se usará para las conexiones salientes del hijo |

**Permiso:** `process.context` sobre "context"; seleccionar una red adicionalmente requiere `network.select` sobre ese ID de red.

### Métodos de SpawnBuilder

`SpawnBuilder` es inmutable; cada método de configuración devuelve una instancia nueva:

```lua
spawner:with_context(values)      -- Add context values
spawner:with_actor(actor)         -- Set security actor
spawner:with_scope(scope)         -- Set security scope
spawner:with_name(name)           -- Set process name
spawner:with_message(topic, ...)  -- Queue message to send after spawn
spawner:with_options(options)     -- Merge spawn-time options (e.g. network)
```

**Permiso:** `process.security` sobre "security" para `:with_actor()` y `:with_scope()`

### Métodos de Spawn del Spawner

```lua
spawner:spawn(id, host, ...)
spawner:spawn_monitored(id, host, ...)
spawner:spawn_linked(id, host, ...)
spawner:spawn_linked_monitored(id, host, ...)
```

Todos los métodos de creación de `SpawnBuilder` requieren `process.host` sobre el ID del host, además de los permisos aplicables `process.spawn`, `process.spawn.monitored` y `process.spawn.linked`.

### Exec del Spawner

```lua
local result, err = spawner:exec(id, host, ...)
```

Este método ejecuta el proceso de destino de forma síncrona con el contexto, el actor y el ámbito del builder, y devuelve su resultado. Un worker diferido puede usar `with_actor` y `with_scope` para ejecutarse con la identidad de un propietario.

**Permisos:** `process.exec` sobre el id del proceso, `process.host` sobre el id del host

## Registro de nombres

Registra un proceso con un nombre para que los llamadores puedan usarlo en lugar de su PID. Las funciones que aceptan un `destination`, incluidas `send`, `terminate`, `cancel`, `monitor` y `link`, también aceptan nombres registrados.

```lua
local ok, err = process.registry.register(name)               -- self, local scope
local pid, err = process.registry.lookup(name)
local ok, err = process.registry.unregister(name)
```

### Ámbito

El argumento opcional `scope` selecciona la garantía de consistencia del nombre y su valor predeterminado es `LOCAL`. Consulta la [Guía del clúster](../../guides/cluster.md#naming-and-name-scopes) para ver el modelo completo.

| Constante | Visibilidad | Garantía |
|----------|-------------|----------|
| `process.registry.LOCAL` | solo este nodo | Instantáneo, local al nodo |
| `process.registry.EVENTUAL` | en todo el clúster | Eventualmente consistente (gossip) |
| `process.registry.CONSISTENT` | en todo el clúster | Singleton linealizable (Raft) |
| `process.registry.STRONG` | en todo el clúster | Consistente + reconocimiento de cada nodo activo |

En un nodo independiente, solo está disponible `LOCAL`; los ámbitos del clúster requieren [clustering](../../guides/cluster.md).

### register

```lua
local ok, err = process.registry.register(name, pid, scope)
```

| Parámetro | Tipo | Requerido | Por defecto | Descripción |
|-----------|------|----------|---------|-------------|
| `name` | string | sí | | Nombre a registrar |
| `pid` | string | no | self | PID a registrar; por defecto el proceso que llama |
| `scope` | number | no | `LOCAL` | Una de las constantes de ámbito anteriores |

Devuelve `true` en caso de éxito o `nil, error` en caso de fallo. Un conflicto de ámbito de clúster, cuando el nombre pertenece a otro PID, devuelve `errors.ALREADY_EXISTS`. Registrar el mismo nombre para el mismo PID es idempotente. Un registro `STRONG` espera hasta que todos los nodos activos lo reconozcan o expire el plazo de reserva.

Registrar en nombre de un PID diferente requiere adicionalmente el permiso `process.registry.foreign` sobre el PID destino.

### lookup

```lua
local pid, err = process.registry.lookup(name)
```

Devuelve la cadena del PID registrado, o `nil, error` con la clase `errors.NOT_FOUND` cuando el nombre no está registrado.

### unregister

```lua
local ok, err = process.registry.unregister(name, scope)
```

`scope` tiene como valor predeterminado `LOCAL` y debe coincidir con el ámbito bajo el que se registró el nombre. Para `CONSISTENT` y `STRONG`, el proceso propietario es el único autorizado a cancelar el registro; cancelar un nombre que pertenece a otro PID devuelve `false`. Los nombres también se liberan automáticamente cuando el proceso propietario termina (y, para los ámbitos de clúster, cuando su nodo abandona el clúster), por lo que la cancelación explícita del registro sirve para liberarlos antes.

## Permisos

Las comprobaciones de permisos evalúan el actor de seguridad del llamador frente al recurso de destino.

### Evaluación de políticas

Las políticas pueden permitir o denegar una operación según:
- **Actor**: El principal de seguridad que hace la solicitud
- **Acción**: La operación que se realiza (ej., `process.send`)
- **Recurso**: El destino (PID, id de proceso, id de host, o nombre)
- **Atributos**: Contexto adicional incluyendo `pid` (ID del proceso que llama)

### Referencia de permisos

| Permiso | Funciones | Recurso |
|---------|-----------|---------|
| `process.spawn` | `spawn*()` | id del proceso |
| `process.spawn.monitored` | `spawn_monitored()`, `spawn_linked_monitored()` | id del proceso |
| `process.spawn.linked` | `spawn_linked()`, `spawn_linked_monitored()` | id del proceso |
| `process.host` | `spawn()` a nivel de módulo, todos los métodos de creación de `SpawnBuilder`, `exec()` | id del host |
| `process.send` | `send()` | PID destino |
| `process.exec` | `exec()` | id del proceso |
| `process.terminate` | `terminate()` | PID destino |
| `process.cancel` | `cancel()` | PID destino |
| `process.monitor` | `monitor()` | PID destino |
| `process.unmonitor` | `unmonitor()` | PID destino |
| `process.link` | `link()` | PID destino |
| `process.unlink` | `unlink()` | PID destino |
| `process.context` | `with_context()` | "context" |
| `process.security` | `:with_actor()`, `:with_scope()` | "security" |
| `process.registry.register` | `registry.register()` | nombre |
| `process.registry.unregister` | `registry.unregister()` | nombre |
| `process.registry.foreign` | `registry.register()` | PID destino |

Los ámbitos de nombres del clúster se autorizan mediante variantes de estas acciones con el ámbito como sufijo (`process.registry.register.eventual`, `.consistent`, `.strong` y las acciones `unregister` correspondientes), de modo que una política puede conceder por separado los nombres locales y los nombres en todo el clúster.

### Varios permisos

Algunas operaciones requieren múltiples permisos:

| Operación | Permisos requeridos |
|-----------|---------------------|
| `spawn()` | `process.spawn` + `process.host` |
| `spawn_monitored()` a nivel de módulo | `process.spawn` + `process.spawn.monitored` |
| `spawn_linked()` a nivel de módulo | `process.spawn` + `process.spawn.linked` |
| `spawn_linked_monitored()` a nivel de módulo | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` |
| `SpawnBuilder:spawn()` | `process.spawn` + `process.host` |
| `SpawnBuilder:spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `SpawnBuilder:spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `SpawnBuilder:spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `exec()` | `process.exec` + `process.host` |
| spawn con actor/ámbito personalizado | permisos de spawn + `process.security` |

## Errores

| Condición | Tipo |
|-----------|------|
| No se encontró contexto | `errors.INTERNAL` |
| No se encontró el contexto del frame | `errors.INTERNAL` |
| Argumentos requeridos faltantes | `errors.INVALID` |
| Prefijo de tema reservado (`@`) | `errors.INVALID` |
| Nombre no registrado | `errors.NOT_FOUND` |
| Permiso denegado | `errors.PERMISSION_DENIED` |
| Nombre ya registrado | `errors.ALREADY_EXISTS` |

Consulta [Manejo de errores](errors.md) para trabajar con errores.

## Véase también

- [Canales](channel.md) - Coordinación de corrutinas dentro del proceso
- [Cola de mensajes](../storage/queue.md) - Mensajería basada en colas
- [Funciones](funcs.md) - Invocación de funciones
- [Supervisión](../../guides/supervision.md) - Gestión del ciclo de vida de procesos
- [Clúster](../../guides/cluster.md) - Ámbitos de nombres y nombres en todo el clúster
