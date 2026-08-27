---
title: "Funções de Hash"
description: "Calcule hashes criptográficos, valores HMAC, chaves PBKDF2 e hashes FNV-1."
---

# Funções de Hash
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

O módulo `hash` calcula hashes criptográficos, valores HMAC, chaves derivadas com PBKDF2 e hashes FNV-1 não criptográficos. Esta página é uma referência de API com chamadas isoladas. Entradas literais ilustram o uso bem-sucedido; quando dados, secrets, senhas ou salts vierem da aplicação, capture e trate o segundo retorno `error` documentado antes de usar o resultado.

Hash não é criptografia e não oculta entradas de baixa entropia. Não registre senhas, chaves HMAC, chaves derivadas ou digests brutos dependentes de secrets. Use HMAC-SHA256 ou HMAC-SHA512 em novos projetos de autenticação de mensagens e PBKDF2 com um salt aleatório exclusivo para verificadores de senha.

## Carregamento

```lua
local hash = require("hash")
```

## Hashes Criptograficos

### MD5

MD5 não é resistente a colisões. Use-o apenas por compatibilidade com protocolos que exigem MD5, não para decisões de segurança.

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

SHA-1 não é resistente a colisões. Use-o apenas por compatibilidade com protocolos que exigem SHA-1, não para decisões de segurança.

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

## HMACs

### HMAC-MD5

Use HMAC-MD5 apenas por compatibilidade com protocolos que o exigem; prefira HMAC-SHA256 ou HMAC-SHA512 em novos projetos.

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

Use HMAC-SHA1 apenas por compatibilidade com protocolos que o exigem; prefira HMAC-SHA256 ou HMAC-SHA512 em novos projetos.

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

### FNV-1 de 32 bits

Hash rapido para hash tables e particionamento.

```lua
local n = hash.fnv32("data")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados para hash |

**Retorna:** `number, error`

### FNV-1 de 64 bits

Hash rapido com saida maior para menos colisoes.

```lua
local n = hash.fnv64("data")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados para hash |

**Retorna:** `number, error`

Os números Lua não representam exatamente todos os inteiros sem sinal de 64 bits. Não use `fnv64` quando o valor exato de 64 bits precisar fazer round-trip por Lua; use uma representação em bytes ou string fornecida por uma implementação de protocolo apropriada.

## Derivação de Chaves

### PBKDF2-HMAC

Derive bytes brutos de chave com PBKDF2-HMAC-SHA256 ou PBKDF2-HMAC-SHA512:

```lua
local key, err = hash.pbkdf2(password, salt, 600000, 32)
if err then
    return nil, err
end
local key512, err = hash.pbkdf2(password, salt, 600000, 32, "sha512")
if err then
    return nil, err
end
```

Aqui, `password` é fornecida pelo limite de secrets da aplicação e `salt` contém bytes aleatórios novos armazenados com o verificador. Os valores retornados são bytes brutos da chave, não texto imprimível.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `password` | string | Senha ou secret de entrada não vazio |
| `salt` | string | Bytes de salt não vazios |
| `iterations` | integer | Número positivo de iterações, no máximo 10.000.000 |
| `key_length` | integer | Tamanho positivo da saída em bytes |
| `algo` | string? | `sha256` (padrão) ou `sha512` |

**Retorna:** `string, error` (bytes brutos da chave derivada)

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Input não e string | `errors.INVALID` | não |
| Secret não e string (HMAC) | `errors.INVALID` | não |
| Senha/salt PBKDF2 vazios, limites inválidos ou algoritmo não suportado | `errors.INVALID` | não |

Veja [Tratamento de Erros](../core/errors.md) para trabalhar com erros.
