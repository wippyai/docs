# Variables de Entorno
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Acceder a variables de entorno para valores de configuracion, secretos y ajustes de tiempo de ejecucion.

Las variables deben definirse en el [Sistema de Entorno](system-env.md) antes de poder acceder a ellas. El sistema controla que backends de almacenamiento (OS, archivo, memoria) proporcionan valores y si las variables son de solo lectura.

## Carga

```lua
local env = require("env")
```

## get

Obtiene el valor de una variable de entorno.

```lua
-- Obtener cadena de conexion de base de datos
local db_url = env.get("DATABASE_URL")
if not db_url then
    return nil, errors.new("INVALID", "DATABASE_URL not configured")
end

-- Obtener con valor predeterminado
local port = env.get("PORT") or "8080"
local host = env.get("HOST") or "localhost"

-- Obtener secretos
local api_key = env.get("API_SECRET_KEY")
local jwt_secret = env.get("JWT_SECRET")

-- Configuracion
local log_level = env.get("LOG_LEVEL") or "info"
local debug_mode = env.get("DEBUG") == "true"
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `key` | string | Nombre de variable |

**Devuelve:** `string, error`

Devuelve `nil, error` si la variable no existe.

## set

Establece una variable de entorno.

```lua
-- Establecer configuracion de tiempo de ejecucion
env.set("APP_MODE", "production")

-- Sobrescribir para pruebas
env.set("API_URL", "http://localhost:8080")

-- Establecer basado en condiciones
if is_development then
    env.set("LOG_LEVEL", "debug")
end
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `key` | string | Nombre de variable |
| `value` | string | Valor a establecer |

**Devuelve:** `boolean, error`

## get_all

Obtiene todas las variables de entorno accesibles.

```lua
local vars = env.get_all()

-- Registrar configuracion (cuidado de no registrar secretos)
for key, value in pairs(vars) do
    if not key:match("SECRET") and not key:match("KEY") then
        logger.debug("env", {[key] = value})
    end
end

-- Verificar variables requeridas
local required = {"DATABASE_URL", "REDIS_URL", "API_KEY"}
for _, key in ipairs(required) do
    if not vars[key] then
        return nil, errors.new("INVALID", "Missing required env var: " .. key)
    end
end
```

**Devuelve:** `table, error`

## Permisos

El acceso a entorno esta sujeto a evaluacion de politica de seguridad.

### Acciones de Seguridad

| Accion | Recurso | Descripcion |
|--------|---------|-------------|
| `env.get` | Nombre de variable | Leer variable de entorno |
| `env.set` | Nombre de variable | Escribir variable de entorno |
| `env.get_all` | `*` | Listar todas las variables |

### Verificar Acceso

```lua
local security = require("security")

if security.can("env.get", "DATABASE_URL") then
    local url = env.get("DATABASE_URL")
end
```

Consulte [Modelo de Seguridad](system-security.md) para configuracion de politicas.

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Clave vacia | `errors.INVALID` | no |
| Variable no encontrada | `errors.NOT_FOUND` | no |
| Permiso denegado | `errors.PERMISSION_DENIED` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.

## Vea Tambien

- [Sistema de Entorno](system-env.md) - Configurar backends de almacenamiento y definiciones de variables
