# Funciones Hash
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Funciones hash criptograficas y autenticacion de mensajes HMAC.

## Carga

```lua
local hash = require("hash")
```

## Hashes Criptograficos

### MD5

```lua
local hex = hash.md5("data")
local raw = hash.md5("data", true)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `data` | string | Datos a hashear |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

### SHA-1

```lua
local hex = hash.sha1("data")
local raw = hash.sha1("data", true)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `data` | string | Datos a hashear |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

### SHA-256

```lua
local hex = hash.sha256("data")
local raw = hash.sha256("data", true)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `data` | string | Datos a hashear |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

### SHA-512

```lua
local hex = hash.sha512("data")
local raw = hash.sha512("data", true)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `data` | string | Datos a hashear |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

## Autenticacion HMAC

### HMAC-MD5

```lua
local hex = hash.hmac_md5("message", "secret")
local raw = hash.hmac_md5("message", "secret", true)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `data` | string | Mensaje a autenticar |
| `secret` | string | Clave secreta |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

### HMAC-SHA1

```lua
local hex = hash.hmac_sha1("message", "secret")
local raw = hash.hmac_sha1("message", "secret", true)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `data` | string | Mensaje a autenticar |
| `secret` | string | Clave secreta |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

### HMAC-SHA256

```lua
local hex = hash.hmac_sha256("message", "secret")
local raw = hash.hmac_sha256("message", "secret", true)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `data` | string | Mensaje a autenticar |
| `secret` | string | Clave secreta |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

### HMAC-SHA512

```lua
local hex = hash.hmac_sha512("message", "secret")
local raw = hash.hmac_sha512("message", "secret", true)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `data` | string | Mensaje a autenticar |
| `secret` | string | Clave secreta |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

## Hashes No Criptograficos

### FNV-32

Hash rapido para tablas hash y particionamiento.

```lua
local n = hash.fnv32("data")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `data` | string | Datos a hashear |

**Devuelve:** `number, error`

### FNV-64

Hash rapido con salida mas grande para reducir colisiones.

```lua
local n = hash.fnv64("data")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `data` | string | Datos a hashear |

**Devuelve:** `number, error`

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Entrada no es string | `errors.INVALID` | no |
| Secreto no es string (HMAC) | `errors.INVALID` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
