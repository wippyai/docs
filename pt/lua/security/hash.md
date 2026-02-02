# Funções de Hash
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Funções de hash criptograficas e autenticação de mensagens HMAC.

## Carregamento

```lua
local hash = require("hash")
```

## Hashes Criptograficos

### MD5

```lua
local hex = hash.md5("data")
local raw = hash.md5("data", true)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados para hash |
| `raw` | boolean? | Retornar bytes raw ao inves de hex |

**Retorna:** `string, error`

### SHA-1

```lua
local hex = hash.sha1("data")
local raw = hash.sha1("data", true)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados para hash |
| `raw` | boolean? | Retornar bytes raw ao inves de hex |

**Retorna:** `string, error`

### SHA-256

```lua
local hex = hash.sha256("data")
local raw = hash.sha256("data", true)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados para hash |
| `raw` | boolean? | Retornar bytes raw ao inves de hex |

**Retorna:** `string, error`

### SHA-512

```lua
local hex = hash.sha512("data")
local raw = hash.sha512("data", true)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados para hash |
| `raw` | boolean? | Retornar bytes raw ao inves de hex |

**Retorna:** `string, error`

## Autenticação HMAC

### HMAC-MD5

```lua
local hex = hash.hmac_md5("message", "secret")
local raw = hash.hmac_md5("message", "secret", true)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Mensagem para autenticar |
| `secret` | string | Chave secreta |
| `raw` | boolean? | Retornar bytes raw ao inves de hex |

**Retorna:** `string, error`

### HMAC-SHA1

```lua
local hex = hash.hmac_sha1("message", "secret")
local raw = hash.hmac_sha1("message", "secret", true)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Mensagem para autenticar |
| `secret` | string | Chave secreta |
| `raw` | boolean? | Retornar bytes raw ao inves de hex |

**Retorna:** `string, error`

### HMAC-SHA256

```lua
local hex = hash.hmac_sha256("message", "secret")
local raw = hash.hmac_sha256("message", "secret", true)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Mensagem para autenticar |
| `secret` | string | Chave secreta |
| `raw` | boolean? | Retornar bytes raw ao inves de hex |

**Retorna:** `string, error`

### HMAC-SHA512

```lua
local hex = hash.hmac_sha512("message", "secret")
local raw = hash.hmac_sha512("message", "secret", true)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Mensagem para autenticar |
| `secret` | string | Chave secreta |
| `raw` | boolean? | Retornar bytes raw ao inves de hex |

**Retorna:** `string, error`

## Hashes Não-Criptograficos

### FNV-32

Hash rapido para hash tables e particionamento.

```lua
local n = hash.fnv32("data")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados para hash |

**Retorna:** `number, error`

### FNV-64

Hash rapido com saida maior para menos colisoes.

```lua
local n = hash.fnv64("data")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados para hash |

**Retorna:** `number, error`

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Input não e string | `errors.INVALID` | não |
| Secret não e string (HMAC) | `errors.INVALID` | não |

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.
