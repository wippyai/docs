# Cifrado y Firma
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

Operaciones criptograficas incluyendo cifrado, HMAC, JWT y derivacion de claves. Adaptado para workflows.

## Carga

```lua
local crypto = require("crypto")
```

## Generacion Aleatoria

### Bytes Aleatorios

```lua
local bytes, err = crypto.random.bytes(32)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `length` | integer | Número de bytes (1 a 1,048,576) |

**Devuelve:** `string, error`

### String Aleatorio

```lua
local str, err = crypto.random.string(32)
local str, err = crypto.random.string(32, "0123456789abcdef")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `length` | integer | Longitud del string (1 a 1,048,576) |
| `charset` | string? | Caracteres a usar (predeterminado: alfanumerico) |

**Devuelve:** `string, error`

### UUID Aleatorio

```lua
local id, err = crypto.random.uuid()
```

**Devuelve:** `string, error`

## HMAC

### HMAC-SHA256

```lua
local hex, err = crypto.hmac.sha256(key, data)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave HMAC |
| `data` | string | Datos a autenticar |

**Devuelve:** `string, error`

### HMAC-SHA512

```lua
local hex, err = crypto.hmac.sha512(key, data)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave HMAC |
| `data` | string | Datos a autenticar |

**Devuelve:** `string, error`

## Cifrado

### AES-GCM {id="encrypt-aes-gcm"}

```lua
local encrypted, err = crypto.encrypt.aes(data, key)
local encrypted, err = crypto.encrypt.aes(data, key, aad)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Texto plano a cifrar |
| `key` | string | 16, 24, o 32 bytes (AES-128/192/256) |
| `aad` | string? | Datos autenticados adicionales |

**Devuelve:** `string, error` (nonce prepuesto)

### ChaCha20-Poly1305 {id="encrypt-chacha20"}

```lua
local encrypted, err = crypto.encrypt.chacha20(data, key)
local encrypted, err = crypto.encrypt.chacha20(data, key, aad)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Texto plano a cifrar |
| `key` | string | Debe ser 32 bytes |
| `aad` | string? | Datos autenticados adicionales |

**Devuelve:** `string, error`

## Descifrado

### AES-GCM {id="decrypt-aes-gcm"}

```lua
local plaintext, err = crypto.decrypt.aes(encrypted, key)
local plaintext, err = crypto.decrypt.aes(encrypted, key, aad)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos cifrados de encrypt.aes |
| `key` | string | Misma clave usada para cifrado |
| `aad` | string? | Debe coincidir con AAD usado en cifrado |

**Devuelve:** `string, error`

### ChaCha20-Poly1305 {id="decrypt-chacha20"}

```lua
local plaintext, err = crypto.decrypt.chacha20(encrypted, key)
local plaintext, err = crypto.decrypt.chacha20(encrypted, key, aad)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos cifrados de encrypt.chacha20 |
| `key` | string | Misma clave usada para cifrado |
| `aad` | string? | Debe coincidir con AAD usado en cifrado |

**Devuelve:** `string, error`

## JWT

### Codificar

```lua
local token, err = crypto.jwt.encode(payload, secret)
local token, err = crypto.jwt.encode(payload, secret, "HS256")
local token, err = crypto.jwt.encode(payload, private_key_pem, "RS256")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `payload` | table | Claims JWT (`_header` para cabecera personalizada) |
| `key` | string | Secreto (HMAC) o clave privada PEM (RSA) |
| `alg` | string? | HS256, HS384, HS512, RS256 (predeterminado: HS256) |

**Devuelve:** `string, error`

### Verificar

```lua
local claims, err = crypto.jwt.verify(token, secret)
local claims, err = crypto.jwt.verify(token, secret, "HS256", false)
local claims, err = crypto.jwt.verify(token, public_key_pem, "RS256")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `token` | string | Token JWT a verificar |
| `key` | string | Secreto (HMAC) o clave publica PEM (RSA) |
| `alg` | string? | Algoritmo esperado (predeterminado: HS256) |
| `require_exp` | boolean? | Validar expiracion (predeterminado: true) |

**Devuelve:** `table, error`

## Derivacion de Claves

### PBKDF2

```lua
local key, err = crypto.pbkdf2(password, salt, iterations, key_length)
local key, err = crypto.pbkdf2(password, salt, iterations, key_length, "sha512")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `password` | string | Contrasena/frase de paso |
| `salt` | string | Valor de sal |
| `iterations` | integer | Conteo de iteraciones (max 10,000,000) |
| `key_length` | integer | Longitud de clave deseada en bytes |
| `hash` | string? | sha256 o sha512 (predeterminado: sha256) |

**Devuelve:** `string, error`

## Utilidad

### Comparacion de Tiempo Constante

```lua
local equal = crypto.constant_time_compare(a, b)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `a` | string | Primer string |
| `b` | string | Segundo string |

**Devuelve:** `boolean`

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Longitud invalida | `errors.INVALID` | no |
| Clave vacia | `errors.INVALID` | no |
| Tamano de clave invalido | `errors.INVALID` | no |
| Descifrado fallido | `errors.INTERNAL` | no |
| Token expirado | `errors.INTERNAL` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
