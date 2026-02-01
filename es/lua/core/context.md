# Contexto de Solicitud
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Acceder a valores de contexto con alcance de solicitud. El contexto se establece via [Funcs](lua-funcs.md) o [Process](lua-process.md).

## Carga

```lua
local ctx = require("ctx")
```

## Acceso al Contexto

### Obtener Valor

```lua
local value, err = ctx.get("key")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `key` | string | Clave de contexto |

**Devuelve:** `any, error`

### Obtener Todos los Valores

```lua
local values, err = ctx.all()
```

**Devuelve:** `table, error`

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Clave vacia | `errors.INVALID` | no |
| Clave no encontrada | `errors.NOT_FOUND` | no |
| Contexto no disponible | `errors.INTERNAL` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
