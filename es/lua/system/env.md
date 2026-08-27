---
title: "Variables de Entorno"
description: "Lee y actualiza las variables de entorno expuestas por el sistema de entorno configurado."
---

# Variables de Entorno
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

El módulo `env` lee y actualiza las variables de entorno expuestas por el entorno de ejecución.

Esta es una referencia de API. Sus fragmentos son operaciones aisladas y suponen que las variables y políticas de seguridad indicadas ya existen.

Las variables deben definirse en el [Sistema de Entorno](../../system/env.md) antes de poder acceder a ellas. El sistema controla qué backends de almacenamiento (OS, archivo, memoria) proporcionan valores y si las variables son de solo lectura.

## Carga

```lua
local env = require("env")
```

## `get`

Obtiene el valor de una variable de entorno.

```lua
-- Get database connection string
local db_url, db_err = env.get("DATABASE_URL")
if db_err then return nil, db_err end

-- Apply a fallback only to a missing variable. Permission and backend errors
-- still propagate to the caller.
local function get_or(key, fallback)
    local value, err = env.get(key)
    if not err then return value end
    if errors.is(err, errors.NOT_FOUND) then return fallback end
    return nil, err
end

local port, port_err = get_or("PORT", "8080")
if port_err then return nil, port_err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Nombre de variable |

**Devuelve:** `string, error`

Devuelve `nil, error` si la variable no existe.

## `set`

Establece una variable de entorno.

```lua
-- Set runtime configuration
local updated, set_err = env.set("APP_MODE", "production")
if set_err then return nil, set_err end
return updated
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Nombre de variable |
| `value` | string | Valor a establecer |

**Devuelve:** `boolean, error`

## `get_all`

Obtiene todas las variables de entorno accesibles.

```lua
local logger = require("logger")

local vars, vars_err = env.get_all()
if vars_err then return nil, vars_err end

-- Log names only. Values such as connection URLs may contain credentials even
-- when their keys do not include words like SECRET or KEY.
local accessible_keys = {}
for key in pairs(vars) do table.insert(accessible_keys, key) end
logger:debug("accessible environment variables", {keys = accessible_keys})

-- Check required variables
local required = {"DATABASE_URL", "REDIS_URL", "API_KEY"}
for _, key in ipairs(required) do
    if not vars[key] then
        return nil, errors.new({
            message = "Missing required env var: " .. key,
            kind = errors.INVALID
        })
    end
end
```

**Devuelve:** `table, error`

## Permisos

El acceso a entorno esta sujeto a evaluacion de politica de seguridad.

### Acciones de Seguridad

| Accion | Recurso | Descripción |
|--------|---------|-------------|
| `env.get` | Nombre de variable | Leer variable de entorno |
| `env.set` | Nombre de variable | Escribir variable de entorno |

`get_all` no tiene una acción de seguridad específica: solo devuelve las variables para las que se permite la acción `env.get`, filtrando cada nombre de variable mediante `env.get`.

### Verificar Acceso

```lua
local security = require("security")

if security.can("env.get", "DATABASE_URL") then
    local url = env.get("DATABASE_URL")
end
```

Consulte [Modelo de Seguridad](../../system/security.md) para configuración de politicas.

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Clave vacia | `errors.INVALID` | no |
| Variable no encontrada | `errors.NOT_FOUND` | no |
| Permiso denegado | `errors.PERMISSION_DENIED` | no |

Consulte [Manejo de Errores](../core/errors.md) para trabajar con errores.

## Vea También

- [Sistema de Entorno](../../system/env.md) - Configurar backends de almacenamiento y definiciones de variables
