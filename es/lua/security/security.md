---
title: "Seguridad y control de acceso"
description: "Inspecciona el actor y el alcance actuales, evalúa políticas y gestiona tokens de autenticación."
---

# Seguridad y control de acceso
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

El módulo `security` expone actores de autenticación, alcances de autorización, políticas y almacenes de tokens. Esta página es una referencia de API con recetas parciales de autorización. Los ID de registro, actores, metadatos de solicitud, valores de token, objetos de la aplicación como `user` y `doc` y callbacks como `show_admin_features` proceden de la aplicación contenedora; los ejemplos no son un despliegue completo de autenticación.

Wippy se ejecuta en modo de seguridad estricto de forma predeterminada. La entrada ejecutable debe habilitar `security`, tener un actor y un alcance y autorizar exactamente las operaciones que llama. En particular, la construcción y los cambios de alcance necesitan `security.actor.create` o `security.scope.create`; la consulta del registro necesita `security.policy.get` o `security.policy_group.get`; el trabajo con tokens necesita `security.token_store.get` además del permiso específico de la operación. `new_actor`, `new_scope`, `scope:with`, `scope:without` y una adquisición de `token_store` con permiso denegado generan un error Lua en vez de devolver un `error` estructurado. Concede estos prerrequisitos en el contexto de seguridad de la entrada, en lugar de intentar recuperarte tras una denegación. Consulta [Modelo de seguridad](system/security.md) para ver la configuración.

## Carga

```lua
local security = require("security")
```

## `actor`

Devuelve el actor de seguridad actual del contexto de ejecución.

```lua
local actor = security.actor()
if actor then
    local id = actor:id()
    local meta = actor:meta()
    -- Use only the fields required for authorization or application logic.
    local role = meta.role
end
```

**Devuelve:** `Actor|nil`

Los metadatos del actor pueden contener identificadores o datos personales. No registres la tabla completa de metadatos ni copies secretos en ella.

## `scope`

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

## `can`

Verifica si el contexto actual permite una accion sobre un recurso.

```lua
-- Check read permission
if not security.can("read", "user:" .. user_id) then
    return nil, errors.new({
        message = "Cannot read user data",
        kind = errors.PERMISSION_DENIED
    })
end

-- Check write permission
if not security.can("write", "order:" .. order_id) then
    return nil, errors.new({
        message = "Cannot modify order",
        kind = errors.PERMISSION_DENIED
    })
end

-- Check with metadata
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

## `new_actor`

Crea un nuevo actor con ID y metadatos.

```lua
-- Create user actor
local actor = security.new_actor("user:" .. user.id, {
    role = user.role,
    department = user.department,
    email = user.email
})

-- Create service actor
local service_actor = security.new_actor("service:payment-processor", {
    type = "service",
    version = "1.0.0"
})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | Identificador único del actor |
| `meta` | table | Pares clave-valor de metadatos |

**Devuelve:** `Actor`

## `new_scope`

Crea un nuevo alcance personalizado.

```lua
-- Empty scope
local scope = security.new_scope()

-- Scope with policies
local read_policy, read_err = security.policy("app:read-only")
if read_err then
    return nil, read_err
end
local scope = security.new_scope({read_policy})

-- Build scope incrementally
local scope = security.new_scope()
local policy1, policy1_err = security.policy("app:read")
if policy1_err then
    return nil, policy1_err
end
local policy2, policy2_err = security.policy("app:write")
if policy2_err then
    return nil, policy2_err
end
scope = scope:with(policy1):with(policy2)
```

Cada alternativa anterior es un patrón de construcción aislado. `new_scope` y `scope:with` pueden generar un error cuando falta el contexto o se deniega el permiso; no devuelven `nil, error` para esas comprobaciones.

**Devuelve:** `Scope`

## `policy`

Recupera una politica del registro.

```lua
local policy, err = security.policy("app:admin-access")
if err then
    return nil, err
end

-- Evaluate policy
local result = policy:evaluate(actor, "delete", "user:123")
if result == "allow" then
    -- permitted
elseif result == "deny" then
    -- forbidden
else
    -- undefined, check other policies
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de politica "namespace:name" |

**Devuelve:** `Policy, error`

## `named_scope`

Recupera un grupo de politicas predefinido.

```lua
-- Get admin scope
local admin_scope, err = security.named_scope("app:admin")
if err then
    return nil, err
end

-- Use for elevated operations
local result = admin_scope:evaluate(actor, "delete", "user:123")
```

Cargar un alcance no eleva el contexto de ejecución actual. Produce un valor para evaluación explícita o para una API que acepte un alcance; el autor de la llamada sigue necesitando permiso para realizar la operación protegida.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de grupo de politicas |

**Devuelve:** `Scope, error`

## `token_store`

Adquiere un almacen de tokens para gestionar tokens de autenticación.

```lua
local store, err = security.token_store("app:tokens")
if err then
    return nil, err
end

-- Use store...
return store:close()
```

El autor de la llamada es propietario de un almacén de tokens adquirido hasta que se llama a `close()`. Ciérralo después de la última operación en cada ruta comprobada de éxito o error; los cierres repetidos son seguros. Una denegación de permiso durante la adquisición genera un error Lua, mientras que los fallos de consulta y recurso devuelven `nil, error`.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de almacen de tokens "namespace:name" |

**Devuelve:** `TokenStore, error`

## Métodos de `Actor`

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `actor:id()` | string | Identificador del actor |
| `actor:meta()` | table | Metadatos del actor |

## Métodos de `Scope`

### `with` / `without`

Agregar o eliminar politicas del alcance.

```lua
local scope = security.new_scope()

-- Add policy
local write_policy, err = security.policy("app:write")
if err then
    return nil, err
end
scope = scope:with(write_policy)

-- Remove policy
scope = scope:without("app:read-only")
```

`with` y `without` devuelven nuevos valores de alcance inmutables y generan un error cuando no se permite `security.scope.create` para el recurso `with` o `without`.

### `evaluate`

Evaluar todas las politicas en el alcance.

```lua
local result = scope:evaluate(actor, "read", "document:123")
-- "allow", "deny", or "undefined"

if result ~= "allow" then
    return nil, errors.new({
        message = "Access denied",
        kind = errors.PERMISSION_DENIED
    })
end
```

### `contains`

Verificar si el alcance contiene una politica.

```lua
if scope:contains("app:admin") then
    show_admin_features()
end
```

### `policies`

Devuelve todas las politicas en el alcance.

```lua
local policies = scope:policies()
for _, policy in ipairs(policies) do
    print(policy:id())
end
```

**Devuelve:** `Policy[]`

## Métodos de `Policy`

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `policy:id()` | string | Identificador de politica |
| `policy:evaluate(actor, action, resource, meta?)` | string | `"allow"`, `"deny"`, o `"undefined"` |

## Métodos de `TokenStore`

### `create`

Crear token de autenticación.

```lua
local actor = security.new_actor("user:123", {role = "user"})
local scope, scope_err = security.named_scope("app:default")
if scope_err then
    return nil, scope_err
end
local store, store_err = security.token_store("app:tokens")
if store_err then
    return nil, store_err
end

local token, err = store:create(actor, scope, {
    expiration = "24h",  -- or milliseconds
    meta = {
        login_ip = request_ip,
        user_agent = user_agent
    }
})
store:close()
if err then
    return nil, err
end
return token
```

`request_ip` y `user_agent` son valores de solicitud proporcionados por la aplicación. Almacena solo los metadatos necesarios para las decisiones de seguridad, aplica límites de retención y nunca registres ni conserves el token de portador devuelto fuera del almacén de credenciales previsto.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `actor` | Actor | Actor para el token |
| `scope` | Scope | Alcance de permisos |
| `options.expiration` | string/number | String de duración o ms |
| `options.meta` | table | Metadatos del token |

**Devuelve:** `string, error`

### `validate`

Validar token y obtener actor/alcance.

```lua
local actor, scope, err = store:validate(token)
store:close()
if err then
    return nil, err
end
```

Aquí y más abajo, `store` es un handle vivo bajo propiedad del autor de la llamada y `token` es una credencial de portador no fiable suministrada por el llamante. No registres el token, ni siquiera en errores de validación o revocación.

**Devuelve:** `Actor, Scope, error`

### `revoke`

Invalidar un token.

```lua
local ok, err = store:revoke(token)
store:close()
if err then
    return nil, err
end
```

**Devuelve:** `boolean, error`

### `close`

Liberar el recurso del almacen de tokens.

```lua
store:close()
```

**Devuelve:** `boolean`

## Permisos

Las operaciones de seguridad estan sujetas a evaluacion de politica de seguridad.

### Acciones de seguridad

| Accion | Recurso | Descripción |
|--------|---------|-------------|
| `security.policy.get` | ID de Policy | Acceder a definiciones de políticas |
| `security.policy_group.get` | ID de Group | Acceder a alcances nombrados |
| `security.scope.create` | `custom` | Crear un alcance personalizado con `new_scope` |
| `security.scope.create` | `with` | Añadir una política con `scope:with` |
| `security.scope.create` | `without` | Eliminar una política con `scope:without` |
| `security.actor.create` | ID de Actor | Crear actores |
| `security.token_store.get` | ID de Store | Acceder a almacenes de tokens |
| `security.token.validate` | ID de Store | Validar tokens |
| `security.token.create` | ID de Store | Crear tokens |
| `security.token.revoke` | ID de Store | Revocar tokens |

Consulta [Modelo de seguridad](system/security.md) para configurar políticas.

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Sin contexto | `errors.INTERNAL` | no |
| ID de almacen de tokens vacio | `errors.INVALID` | no |
| Permiso denegado para una política, un alcance nombrado o una operación con tokens | `errors.INVALID` | no |
| Construcción de actor o alcance, cambio de alcance o adquisición del almacén de tokens denegados | genera un error Lua | no |
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
store:close()
```

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.

## Véase también

- [Modelo de seguridad](../../system/security.md) - Configuración de actores, políticas y alcances
- [Middleware HTTP](http/middleware.md) - Firewall de endpoints y recursos
