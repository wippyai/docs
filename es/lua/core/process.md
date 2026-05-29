# Gestión de Procesos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

Crear, monitorear y comunicarse con procesos hijos. Implementa patrones de modelo de actores con paso de mensajes, supervisión y gestión de ciclo de vida.

La variable global `process` siempre está disponible — no requiere `require()` ni necesita aparecer en `modules:`.

## Información del Proceso

Obtener el ID del frame actual o el ID del proceso:

```lua
local frame_id = process.id()  -- Identificador de cadena de llamadas
local pid = process.pid()       -- ID del proceso
```

## Enviar Mensajes

Enviar mensaje(s) a un proceso por PID o nombre registrado:

```lua
local ok, err = process.send(destination, topic, ...)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `destination` | string | PID o nombre registrado |
| `topic` | string | Nombre del tema (no puede comenzar con `@`) |
| `...` | any | Valores del payload |

**Permiso:** `process.send` sobre el PID destino

## Lanzar Procesos

```lua
-- Lanzamiento básico
local pid, err = process.spawn(id, host, ...)

-- Con monitoreo (recibir eventos EXIT)
local pid, err = process.spawn_monitored(id, host, ...)

-- Con enlace (recibir LINK_DOWN en salida anormal)
local pid, err = process.spawn_linked(id, host, ...)

-- Enlazado y monitorizado
local pid, err = process.spawn_linked_monitored(id, host, ...)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de fuente del proceso (ej., `"app.workers:handler"`) |
| `host` | string | ID del host (ej., `"app:processes"`) |
| `...` | any | Argumentos pasados al proceso lanzado |

**Permisos:**
- `process.spawn` sobre el id del proceso
- `process.host` sobre el id del host
- `process.spawn.monitored` sobre el id del proceso (para variantes monitorizadas)
- `process.spawn.linked` sobre el id del proceso (para variantes enlazadas)

## Control de Procesos

```lua
-- Terminar forzosamente un proceso
local ok, err = process.terminate(destination)

-- Solicitar cancelación controlada con un motivo opcional
local ok, err = process.cancel(destination, "shutting down")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `destination` | string | PID o nombre registrado |
| `reason` | string | Motivo opcional entregado al destino |

**Permisos:** `process.terminate`, `process.cancel` sobre el PID destino

## Monitoreo y Enlace

Monitorear o enlazar a un proceso existente:

```lua
-- Monitoreo: recibir eventos EXIT cuando el destino sale
local ok, err = process.monitor(destination)
local ok, err = process.unmonitor(destination)

-- Enlace: bidireccional, recibir LINK_DOWN en salida anormal
local ok, err = process.link(destination)
local ok, err = process.unlink(destination)
```

**Permisos:** `process.monitor`, `process.unmonitor`, `process.link`, `process.unlink` sobre el PID destino

## Opciones del Proceso

```lua
local options = process.get_options()
local ok, err = process.set_options({trap_links = true})
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `trap_links` | boolean | Si los eventos LINK_DOWN se entregan al canal de eventos |

## Buzón y Eventos

Obtener canales para recibir mensajes y eventos de ciclo de vida:

```lua
local inbox = process.inbox()    -- Objetos Message del tema @inbox
local events = process.events()  -- Eventos de ciclo de vida del tema @events
```

### Tipos de Evento

| Constante | Descripción |
|----------|-------------|
| `process.event.CANCEL` | Cancelación solicitada |
| `process.event.EXIT` | Proceso monitorizado ha salido |
| `process.event.LINK_DOWN` | Proceso enlazado terminó de forma anormal |

### Campos del Evento

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `kind` | string | Constante del tipo de evento |
| `from` | string | PID de origen |
| `result` | table | Para EXIT: `{value: any}` o `{error: string}` |
| `reason` | string | Para CANCEL: por qué se está cancelando el proceso |

## Suscripción a Temas

Suscribirse a temas personalizados:

```lua
local ch = process.listen(topic, options)
process.unlisten(ch)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `topic` | string | Nombre del tema (no puede comenzar con `@`) |
| `options.message` | boolean | Si es true, recibir objetos Message; si es false, payloads raw |

## Objetos Message

Al recibir del buzón o con `{message = true}`:

```lua
local msg = inbox:receive()

msg:topic()            -- string: nombre del tema
msg:from()             -- string|nil: PID del remitente
msg:payload()          -- Payload: wrapper (llamar :data() para extraer)
msg:payload():data()   -- any: valor actual del payload
```

## Llamada Síncrona

Lanzar un proceso, esperar su resultado y devolver:

```lua
local result, err = process.exec(id, host, ...)
```

**Permisos:** `process.exec` sobre el id del proceso, `process.host` sobre el id del host

## Actualización de Proceso

Actualizar el proceso actual a una nueva definición preservando el PID:

```lua
-- Actualizar a nueva versión, pasando estado
process.upgrade(id, ...)

-- Mantener la misma definición, re-ejecutar con nuevo estado
process.upgrade(nil, preserved_state)
```

## Spawner con Contexto

Crear un spawner con contexto personalizado para procesos hijos:

```lua
local spawner = process.with_context({request_id = "123"})
```

**Permiso:** `process.context` sobre "context"

### Spawner con Opciones

`process.with_options(options)` crea un spawner que lleva opciones de spawn (ej., un selector de red) en lugar de valores de contexto:

```lua
local spawner = process.with_options({network = "app:tor_proxy"})
```

| Opción | Tipo | Descripción |
|--------|------|-------------|
| `network` | string | ID de registro de una entrada `network.*` a usar para las conexiones salientes del hijo |

**Permiso:** `process.context` sobre "context"; seleccionar una red adicionalmente requiere `network.select` sobre ese ID de red.

### Métodos de SpawnBuilder

SpawnBuilder es inmutable — cada método devuelve una nueva instancia:

```lua
spawner:with_context(values)      -- Añadir valores de contexto
spawner:with_actor(actor)         -- Establecer actor de seguridad
spawner:with_scope(scope)         -- Establecer ámbito de seguridad
spawner:with_name(name)           -- Establecer nombre del proceso
spawner:with_message(topic, ...)  -- Encolar mensaje a enviar tras el spawn
```

**Permiso:** `process.security` sobre "security" para `:with_actor()` y `:with_scope()`

### Métodos de Spawn del Spawner

```lua
spawner:spawn(id, host, ...)
spawner:spawn_monitored(id, host, ...)
spawner:spawn_linked(id, host, ...)
spawner:spawn_linked_monitored(id, host, ...)
```

Mismos permisos que las funciones de spawn a nivel de módulo.

## Registro de Nombres

Registrar un proceso bajo un nombre y alcanzarlo por ese nombre en lugar de su PID. Cualquier función que acepte un `destination` (`send`, `terminate`, `cancel`, `monitor`, `link`, ...) acepta un nombre registrado en lugar de un PID.

```lua
local ok, err = process.registry.register(name)               -- self, ámbito local
local pid, err = process.registry.lookup(name)
local ok, err = process.registry.unregister(name)
```

### Ámbito

El argumento opcional `scope` selecciona la garantía de consistencia del nombre. Por defecto es `LOCAL`. Los cuatro ámbitos y sus garantías se describen en la [Guía de Cluster](guides/cluster.md#naming-and-name-scopes); en resumen:

| Constante | Visibilidad | Garantía |
|----------|-------------|----------|
| `process.registry.LOCAL` | solo este nodo | Instantáneo, local al nodo |
| `process.registry.EVENTUAL` | en todo el cluster | Eventualmente consistente (gossip) |
| `process.registry.CONSISTENT` | en todo el cluster | Singleton linealizable (Raft) |
| `process.registry.STRONG` | en todo el cluster | Consistente + cada nodo activo reconoce |

En un nodo independiente solo `LOCAL` es significativo; los ámbitos de cluster requieren [clustering](guides/cluster.md).

### register

```lua
local ok, err = process.registry.register(name, pid, scope)
```

| Parámetro | Tipo | Requerido | Por defecto | Descripción |
|-----------|------|----------|---------|-------------|
| `name` | string | sí | | Nombre a registrar |
| `pid` | string | no | self | PID a registrar; por defecto el proceso que llama |
| `scope` | number | no | `LOCAL` | Una de las constantes de ámbito anteriores |

Devuelve `true` en éxito, o `nil, error` en fallo. Los conflictos (nombre ya registrado a un PID diferente bajo un ámbito de cluster) devuelven `errors.ALREADY_EXISTS`. Registrar el mismo nombre al mismo PID es idempotente. Un registro `STRONG` bloquea hasta que cada nodo activo reconoce o el plazo de reserva expira; en tiempo de espera devuelve un error.

Registrar en nombre de un PID diferente requiere adicionalmente el permiso `process.registry.foreign` sobre el PID destino.

### lookup

```lua
local pid, err = process.registry.lookup(name)
```

Devuelve el string de PID registrado, o `nil, error` con tipo `errors.NOT_FOUND` cuando el nombre no está registrado.

### unregister

```lua
local ok, err = process.registry.unregister(name, scope)
```

`scope` por defecto es `LOCAL` y debe coincidir con el ámbito bajo el que se registró el nombre. Para `CONSISTENT` y `STRONG`, el proceso propietario es el único autorizado a desregistrar; desregistrar un nombre propiedad de otro PID devuelve `false`. Los nombres también se liberan automáticamente cuando el proceso propietario sale (y, para ámbitos de cluster, cuando su nodo se va), por lo que el desregistro explícito es para liberación anticipada.

## Permisos

Los permisos controlan lo que puede hacer un proceso que llama. Todas las comprobaciones usan el contexto de seguridad (actor) del que llama contra el recurso destino.

### Evaluación de Política

Las políticas pueden permitir/denegar basándose en:
- **Actor**: El principal de seguridad que hace la solicitud
- **Acción**: La operación que se realiza (ej., `process.send`)
- **Recurso**: El destino (PID, id de proceso, id de host, o nombre)
- **Atributos**: Contexto adicional incluyendo `pid` (ID del proceso que llama)

### Referencia de Permisos

| Permiso | Funciones | Recurso |
|---------|-----------|---------|
| `process.spawn` | `spawn*()` | id del proceso |
| `process.spawn.monitored` | `spawn_monitored()`, `spawn_linked_monitored()` | id del proceso |
| `process.spawn.linked` | `spawn_linked()`, `spawn_linked_monitored()` | id del proceso |
| `process.host` | `spawn*()`, `exec()` | id del host |
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

Los ámbitos de nombre de cluster están autorizados por variantes con sufijo de ámbito de estas acciones (`process.registry.register.eventual`, `.consistent`, `.strong`, y las acciones de `unregister` correspondientes), por lo que una política puede otorgar naming local separado del naming a nivel de cluster.

### Permisos Múltiples

Algunas operaciones requieren múltiples permisos:

| Operación | Permisos requeridos |
|-----------|---------------------|
| `spawn()` | `process.spawn` + `process.host` |
| `spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `exec()` | `process.exec` + `process.host` |
| spawn con actor/ámbito personalizado | permisos de spawn + `process.security` |

## Errores

| Condición | Tipo |
|-----------|------|
| No se encontró contexto | `errors.INVALID` |
| Contexto de frame no encontrado | `errors.INVALID` |
| Argumentos requeridos faltantes | `errors.INVALID` |
| Prefijo de tema reservado (`@`) | `errors.INVALID` |
| Formato de duración inválido | `errors.INVALID` |
| Nombre no registrado | `errors.NOT_FOUND` |
| Permiso denegado | `errors.PERMISSION_DENIED` |
| Nombre ya registrado | `errors.ALREADY_EXISTS` |

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.

## Ver También

- [Canales](lua/core/channel.md) - Comunicación entre procesos
- [Cola de Mensajes](lua/storage/queue.md) - Mensajería basada en colas
- [Funciones](lua/core/funcs.md) - Invocación de funciones
- [Supervisión](guides/supervision.md) - Gestión del ciclo de vida de procesos
- [Cluster](guides/cluster.md) - Ámbitos de nombre y naming a nivel de cluster
