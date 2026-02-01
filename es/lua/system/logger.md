# Logging
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

Logging estructurado con niveles debug, info, warn y error.

## Carga

```lua
local logger = require("logger")
```

## Niveles de Log

### Debug

```lua
logger:debug("message", {key = "value"})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `message` | string | Mensaje de log |
| `fields` | table? | Pares clave-valor contextuales |

### Info

```lua
logger:info("message", {key = "value"})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `message` | string | Mensaje de log |
| `fields` | table? | Pares clave-valor contextuales |

### Warn

```lua
logger:warn("message", {key = "value"})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `message` | string | Mensaje de log |
| `fields` | table? | Pares clave-valor contextuales |

### Error

```lua
logger:error("message", {key = "value"})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `message` | string | Mensaje de log |
| `fields` | table? | Pares clave-valor contextuales |

## Personalizacion de Logger

### Con Campos

Crear un logger hijo con campos persistentes.

```lua
local child = logger:with({request_id = id})
child:info("message")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `fields` | table | Campos a adjuntar a todos los logs |

**Devuelve:** `Logger`

### Logger Nombrado

Crear un logger hijo nombrado.

```lua
local named = logger:named("auth")
named:info("message")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `name` | string | Nombre del logger |

**Devuelve:** `Logger`

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| String de nombre vacio | `errors.INVALID` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
