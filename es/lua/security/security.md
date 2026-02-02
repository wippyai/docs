# Seguridad y Control de Acceso
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Gestionar actores de autenticación, alcances de autorizacion y politicas de acceso.

## Carga

```lua
local security = require("security")
```

## actor

Devuelve el actor de seguridad actual del contexto de ejecución.

```lua
local actor = security.actor()
if actor then
    local id = actor:id()
    local meta = actor:meta()

    logger:info("Request from", {
        user_id = id,
        role = meta.role
    })
end
```

**Devuelve:** `Actor|nil`

## scope

Devuelve el alcance de seguridad actual del contexto de ejecución.

```lua
local scope = security.scope()
if scope then
    local policies = scope:policies()
    for _, policy in ipairs(policies) do
        print("Active policy:", policy:id())
    end
end
```

**Devuelve:** `Scope|nil`

## can

Verifica si el contexto actual permite una accion sobre un recurso.

```lua
-- Verificar permiso de lectura
if not security.can("read", "user:" .. user_id) then
    return nil, errors.new("PERMISSION_DENIED", "Cannot read user data")
end

-- Verificar permiso de escritura
if not security.can("write", "order:" .. order_id) then
    return nil, errors.new("PERMISSION_DENIED", "Cannot modify order")
end

-- Verificar con metadatos
local allowed = security.can("delete", "document:" .. doc_id, {
    owner_id = doc.owner_id,
    department = doc.department
})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `action` | string | Accion a verificar |
| `resource` | string | Identificador de recurso |
| `meta` | table | Metadatos adicionales (opcional) |

**Devuelve:** `boolean`

## new_actor

Crea un nuevo actor con ID y metadatos.

```lua
-- Crear actor de usuario
local actor = security.new_actor("user:" .. user.id, {
    role = user.role,
    department = user.department,
    email = user.email
})

-- Crear actor de servicio
local service_actor = security.new_actor("service:payment-processor", {
    type = "service",
    versión = "1.0.0"
})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | Identificador único del actor |
| `meta` | table | Pares clave-valor de metadatos |

**Devuelve:** `Actor`

## new_scope

Crea un nuevo alcance personalizado.

```lua
-- Alcance vacio
local scope = security.new_scope()

-- Alcance con politicas
local read_policy = security.policy("app:read-only")
local scope = security.new_scope({read_policy})

-- Construir alcance incrementalmente
local scope = security.new_scope()
local policy1 = security.policy("app:read")
local policy2 = security.policy("app:write")
scope = scope:with(policy1):with(policy2)
```

**Devuelve:** `Scope`

## policy

Recupera una politica del registro.

```lua
local policy, err = security.policy("app:admin-access")
if err then
    return nil, err
end

-- Evaluar politica
local result = policy:evaluate(actor, "delete", "user:123")
if result == "allow" then
    -- permitido
elseif result == "deny" then
    -- prohibido
else
    -- indefinido, verificar otras politicas
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de politica "namespace:name" |

**Devuelve:** `Policy, error`

## named_scope

Recupera un grupo de politicas predefinido.

```lua
-- Obtener alcance de admin
local admin_scope, err = security.named_scope("app:admin")
if err then
    return nil, err
end

-- Usar para operaciones elevadas
local result = admin_scope:evaluate(actor, "delete", "user:123")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de grupo de politicas |

**Devuelve:** `Scope, error`

## token_store

Adquiere un almacen de tokens para gestionar tokens de autenticación.

```lua
local store, err = security.token_store("app:tokens")
if err then
    return nil, err
end

-- Usar almacen...
store:close()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de almacen de tokens "namespace:name" |

**Devuelve:** `TokenStore, error`

## Metodos de Actor

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `actor:id()` | string | Identificador del actor |
| `actor:meta()` | table | Metadatos del actor |

## Metodos de Scope

### with / without

Agregar o eliminar politicas del alcance.

```lua
local scope = security.new_scope()

-- Agregar politica
local write_policy = security.policy("app:write")
scope = scope:with(write_policy)

-- Eliminar politica
scope = scope:without("app:read-only")
```

### evaluate

Evaluar todas las politicas en el alcance.

```lua
local result = scope:evaluate(actor, "read", "document:123")
-- "allow", "deny", o "undefined"

if result ~= "allow" then
    return nil, errors.new("PERMISSION_DENIED", "Access denied")
end
```

### contains

Verificar si el alcance contiene una politica.

```lua
if scope:contains("app:admin") then
    show_admin_features()
end
```

### policies

Devuelve todas las politicas en el alcance.

```lua
local policies = scope:policies()
for _, policy in ipairs(policies) do
    print(policy:id())
end
```

**Devuelve:** `Policy[]`

## Metodos de Policy

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `policy:id()` | string | Identificador de politica |
| `policy:evaluate(actor, action, resource, meta?)` | string | `"allow"`, `"deny"`, o `"undefined"` |

## Metodos de TokenStore

### create

Crear token de autenticación.

```lua
local actor = security.new_actor("user:123", {role = "user"})
local scope = security.named_scope("app:default")

local token, err = store:create(actor, scope, {
    expiration = "24h",  -- o milisegundos
    meta = {
        login_ip = request_ip,
        user_agent = user_agent
    }
})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `actor` | Actor | Actor para el token |
| `scope` | Scope | Alcance de permisos |
| `options.expiration` | string/number | String de duración o ms |
| `options.meta` | table | Metadatos del token |

**Devuelve:** `string, error`

### validate

Validar token y obtener actor/alcance.

```lua
local actor, scope, err = store:validate(token)
if err then
    return nil, errors.new("UNAUTHENTICATED", "Invalid token")
end
```

**Devuelve:** `Actor, Scope, error`

### revoke

Invalidar un token.

```lua
local ok, err = store:revoke(token)
```

**Devuelve:** `boolean, error`

### close

Liberar el recurso del almacen de tokens.

```lua
store:close()
```

**Devuelve:** `boolean`

## Permisos

Las operaciones de seguridad estan sujetas a evaluacion de politica de seguridad.

### Acciones de Seguridad

| Accion | Recurso | Descripción |
|--------|---------|-------------|
| `security.policy.get` | ID de Policy | Acceder a definiciones de politica |
| `security.policy_group.get` | ID de Group | Acceder a alcances nombrados |
| `security.scope.create` | `custom` | Crear alcances personalizados |
| `security.actor.create` | ID de Actor | Crear actores |
| `security.token_store.get` | ID de Store | Acceder a almacenes de tokens |
| `security.token.validate` | ID de Store | Validar tokens |
| `security.token.create` | ID de Store | Crear tokens |
| `security.token.revoke` | ID de Store | Revocar tokens |

Consulte [Modelo de Seguridad](system/security.md) para configuración de politicas.

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Sin contexto | `errors.INTERNAL` | no |
| ID de almacen de tokens vacio | `errors.INVALID` | no |
| Permiso denegado | `errors.INVALID` | no |
| Politica no encontrada | `errors.INTERNAL` | no |
| Almacen de tokens no encontrado | `errors.INTERNAL` | no |
| Almacen de tokens cerrado | `errors.INTERNAL` | no |
| Formato de expiracion invalido | `errors.INVALID` | no |
| Validacion de token fallida | `errors.INTERNAL` | no |

```lua
local store, err = security.token_store("app:tokens")
if err then
    if errors.is(err, errors.INVALID) then
        print("Invalid request:", err:message())
    end
    return nil, err
end
```

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.

## Vea También

- [Modelo de Seguridad](system/security.md) - Configuración de actores, politicas, alcances
- [Middleware HTTP](http/middleware.md) - Firewall de endpoint y recursos
