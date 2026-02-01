# Criptografia & Assinatura
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

Operacoes criptograficas incluindo criptografia, HMAC, JWT e derivacao de chaves. Adaptado para workflows.

## Carregamento

```lua
local crypto = require("crypto")
```

## Geracao Aleatoria

### Bytes Aleatorios

```lua
local bytes, err = crypto.random.bytes(32)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `length` | integer | Numero de bytes (1 a 1.048.576) |

**Retorna:** `string, error`

### String Aleatoria

```lua
local str, err = crypto.random.string(32)
local str, err = crypto.random.string(32, "0123456789abcdef")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `length` | integer | Tamanho da string (1 a 1.048.576) |
| `charset` | string? | Caracteres para usar (padrao: alfanumerico) |

**Retorna:** `string, error`

### UUID Aleatorio

```lua
local id, err = crypto.random.uuid()
```

**Retorna:** `string, error`

## HMAC

### HMAC-SHA256

```lua
local hex, err = crypto.hmac.sha256(key, data)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `key` | string | Chave HMAC |
| `data` | string | Dados para autenticar |

**Retorna:** `string, error`

### HMAC-SHA512

```lua
local hex, err = crypto.hmac.sha512(key, data)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `key` | string | Chave HMAC |
| `data` | string | Dados para autenticar |

**Retorna:** `string, error`

## Criptografia

### AES-GCM {id="encrypt-aes-gcm"}

```lua
local encrypted, err = crypto.encrypt.aes(data, key)
local encrypted, err = crypto.encrypt.aes(data, key, aad)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `data` | string | Texto plano para criptografar |
| `key` | string | 16, 24 ou 32 bytes (AES-128/192/256) |
| `aad` | string? | Dados adicionais autenticados |

**Retorna:** `string, error` (nonce prepended)

### ChaCha20-Poly1305 {id="encrypt-chacha20"}

```lua
local encrypted, err = crypto.encrypt.chacha20(data, key)
local encrypted, err = crypto.encrypt.chacha20(data, key, aad)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `data` | string | Texto plano para criptografar |
| `key` | string | Deve ter 32 bytes |
| `aad` | string? | Dados adicionais autenticados |

**Retorna:** `string, error`

## Descriptografia

### AES-GCM {id="decrypt-aes-gcm"}

```lua
local plaintext, err = crypto.decrypt.aes(encrypted, key)
local plaintext, err = crypto.decrypt.aes(encrypted, key, aad)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `data` | string | Dados criptografados de encrypt.aes |
| `key` | string | Mesma chave usada na criptografia |
| `aad` | string? | Deve coincidir com AAD usado na criptografia |

**Retorna:** `string, error`

### ChaCha20-Poly1305 {id="decrypt-chacha20"}

```lua
local plaintext, err = crypto.decrypt.chacha20(encrypted, key)
local plaintext, err = crypto.decrypt.chacha20(encrypted, key, aad)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `data` | string | Dados criptografados de encrypt.chacha20 |
| `key` | string | Mesma chave usada na criptografia |
| `aad` | string? | Deve coincidir com AAD usado na criptografia |

**Retorna:** `string, error`

## JWT

### Encode

```lua
local token, err = crypto.jwt.encode(payload, secret)
local token, err = crypto.jwt.encode(payload, secret, "HS256")
local token, err = crypto.jwt.encode(payload, private_key_pem, "RS256")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `payload` | table | Claims JWT (`_header` para header customizado) |
| `key` | string | Secret (HMAC) ou chave privada PEM (RSA) |
| `alg` | string? | HS256, HS384, HS512, RS256 (padrao: HS256) |

**Retorna:** `string, error`

### Verify

```lua
local claims, err = crypto.jwt.verify(token, secret)
local claims, err = crypto.jwt.verify(token, secret, "HS256", false)
local claims, err = crypto.jwt.verify(token, public_key_pem, "RS256")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `token` | string | Token JWT para verificar |
| `key` | string | Secret (HMAC) ou chave publica PEM (RSA) |
| `alg` | string? | Algoritmo esperado (padrao: HS256) |
| `require_exp` | boolean? | Validar expiracao (padrao: true) |

**Retorna:** `table, error`

## Derivacao de Chaves

### PBKDF2

```lua
local key, err = crypto.pbkdf2(password, salt, iterations, key_length)
local key, err = crypto.pbkdf2(password, salt, iterations, key_length, "sha512")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `password` | string | Senha/passphrase |
| `salt` | string | Valor de salt |
| `iterations` | integer | Contagem de iteracoes (max 10.000.000) |
| `key_length` | integer | Tamanho desejado da chave em bytes |
| `hash` | string? | sha256 ou sha512 (padrao: sha256) |

**Retorna:** `string, error`

## Utilitarios

### Comparacao em Tempo Constante

```lua
local equal = crypto.constant_time_compare(a, b)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `a` | string | Primeira string |
| `b` | string | Segunda string |

**Retorna:** `boolean`

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| Tamanho invalido | `errors.INVALID` | nao |
| Chave vazia | `errors.INVALID` | nao |
| Tamanho de chave invalido | `errors.INVALID` | nao |
| Descriptografia falhou | `errors.INTERNAL` | nao |
| Token expirado | `errors.INTERNAL` | nao |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
