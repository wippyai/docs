---
title: "Funciones Hash"
description: "Funciones hash criptograficas y autenticación de mensajes HMAC."
---

# Funciones Hash
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Funciones hash criptograficas y autenticación de mensajes HMAC.

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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a hashear |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

### SHA-1

```lua
local hex = hash.sha1("data")
local raw = hash.sha1("data", true)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a hashear |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

### SHA-256

```lua
local hex = hash.sha256("data")
local raw = hash.sha256("data", true)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a hashear |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

### SHA-512

```lua
local hex = hash.sha512("data")
local raw = hash.sha512("data", true)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a hashear |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

## Autenticación HMAC

### HMAC-MD5

```lua
local hex = hash.hmac_md5("message", "secret")
local raw = hash.hmac_md5("message", "secret", true)
```

| Parámetro | Tipo | Descripción |
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

| Parámetro | Tipo | Descripción |
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

| Parámetro | Tipo | Descripción |
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

| Parámetro | Tipo | Descripción |
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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a hashear |

**Devuelve:** `number, error`

### FNV-64

Hash rapido con salida mas grande para reducir colisiones.

```lua
local n = hash.fnv64("data")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a hashear |

**Devuelve:** `number, error`

## Derivacion de Claves

### PBKDF2

```lua
local key, err = hash.pbkdf2(password, salt, iterations, key_length)
local key, err = hash.pbkdf2(password, salt, iterations, key_length, "sha512")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `password` | string | Contraseña/frase de paso (no vacía) |
| `salt` | string | Valor de salt (no vacío) |
| `iterations` | integer | Cantidad de iteraciones (1 a 10.000.000) |
| `key_length` | integer | Longitud deseada de la clave en bytes |
| `hash` | string? | `sha256` o `sha512` (predeterminado: `sha256`) |

**Devuelve:** `string, error` (bytes crudos de la clave)

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Entrada no es string | `errors.INVALID` | no |
| Secreto no es string (HMAC) | `errors.INVALID` | no |
| Contraseña/salt vacíos, iteraciones no positivas o excesivas, hash no soportado (PBKDF2) | `errors.INVALID` | no |

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.
