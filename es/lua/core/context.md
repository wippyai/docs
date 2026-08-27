---
title: "Contexto de solicitud"
description: "Lee valores vinculados a la solicitud y propagados mediante llamadas a funciones y procesos."
---

# Contexto de solicitud
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

El módulo `ctx` lee valores vinculados a la solicitud y propagados mediante
[llamadas a funciones](./funcs.md) u [operaciones de procesos](./process.md). Esta
página es una referencia de API; los fragmentos muestran llamadas individuales dentro
de una entrada Lua ejecutable.

## Carga

```lua
local ctx = require("ctx")
```

## Acceso al Contexto

### Obtener Valor

```lua
local value, err = ctx.get("key")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave de contexto |

**Devuelve:** `any, error`

### Obtener Todos los Valores

```lua
local values, err = ctx.all()
```

**Devuelve:** `table, error`

`ctx.all()` devuelve una tabla vacía cuando existe un contexto de ejecución pero no
tiene valores de solicitud. Si no existe un contexto de ejecución, devuelve
`nil, errors.INTERNAL`.

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Clave vacia | `errors.INVALID` | no |
| Clave no encontrada | `errors.NOT_FOUND` | no |
| Contexto de ejecución no disponible | `errors.INTERNAL` | no |

Consulta [Manejo de errores](./errors.md) para trabajar con errores.
