---
title: "Criptografia & Assinatura"
description: "Gere valores aleatórios, autentique dados, criptografe conteúdo, verifique JWTs e derive chaves."
---

# Criptografia & Assinatura
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

O módulo `crypto` gera valores aleatórios, calcula HMACs, criptografa e descriptografa dados, codifica e verifica JWTs e deriva chaves. Em workflows determinísticos, a geração aleatória e a criptografia, que cria um nonce aleatório, são executadas como efeitos colaterais registrados; o replay retorna os bytes registrados. As demais operações, incluindo HMAC, descriptografia, processamento de JWT, PBKDF2 e comparação, são executadas diretamente.

Esta página é uma referência de API. Cada bloco de código é uma chamada isolada, não um sistema completo de gerenciamento de chaves ou autenticação. Nomes como `data`, `key`, `aad`, `payload` e `token` são valores fornecidos pela aplicação. Carregue chaves e senhas pela fronteira de gerenciamento de segredos da aplicação; não as fixe no código, registre em logs nem retorne em diagnósticos. Antes de consumir qualquer resultado `value, error` mostrado aqui, propague ou trate o erro.

## Carregamento

```lua
local crypto = require("crypto")
```

## Geração Aleatória

### Bytes Aleatórios

```lua
local bytes, err = crypto.random.bytes(32)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `length` | integer | Número de bytes (1 a 1.048.576) |

**Retorna:** `string, error`

### String Aleatória

```lua
local str, err = crypto.random.string(32)
local str, err = crypto.random.string(32, "0123456789abcdef")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `length` | integer | Tamanho da saída em bytes (1 a 1.048.576) |
| `charset` | string? | Alfabeto de bytes ASCII a usar (padrão: alfanumérico) |

**Retorna:** `string, error`

A implementação seleciona bytes do alfabeto fornecido. Um alfabeto não ASCII pode ser dividido em UTF-8 inválido, e a seleção por módulo só é exatamente uniforme quando o tamanho do alfabeto em bytes divide 256. Para material secreto uniformemente aleatório, use `crypto.random.bytes` e codifique o resultado no formato de transporte necessário.

### UUID Aleatório

```lua
local id, err = crypto.random.uuid()
```

**Retorna:** `string, error`

## HMAC

### HMAC-SHA256

```lua
local hex, err = crypto.hmac.sha256(key, data)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `key` | string | Chave HMAC |
| `data` | string | Dados para autenticar |

**Retorna:** `string, error`

### HMAC-SHA512

```lua
local hex, err = crypto.hmac.sha512(key, data)
```

| Parâmetro | Tipo | Descrição |
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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Texto plano para criptografar |
| `key` | string | 16, 24 ou 32 bytes (AES-128/192/256) |
| `aad` | string? | Dados adicionais autenticados |

**Retorna:** `string, error` (nonce prepended)

As duas funções de criptografia geram um nonce e o prefixam ao ciphertext. Não remova nem reutilize esse nonce e use o mesmo AAD na descriptografia. Ciphertext não é um valor livre de segredos para logs: ele pode expor informações de tamanho e correlação.

### ChaCha20-Poly1305 {id="encrypt-chacha20"}

```lua
local encrypted, err = crypto.encrypt.chacha20(data, key)
local encrypted, err = crypto.encrypt.chacha20(data, key, aad)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Texto plano para criptografar |
| `key` | string | Deve ter 32 bytes |
| `aad` | string? | Dados adicionais autenticados |

**Retorna:** `string, error` (nonce prepended)

## Descriptografia

### AES-GCM {id="decrypt-aes-gcm"}

```lua
local plaintext, err = crypto.decrypt.aes(encrypted, key)
local plaintext, err = crypto.decrypt.aes(encrypted, key, aad)
```

| Parâmetro | Tipo | Descrição |
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

| Parâmetro | Tipo | Descrição |
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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `payload` | table | Claims JWT (`_header` para header customizado) |
| `key` | string | Secret (HMAC) ou chave privada PEM (RSA) |
| `alg` | string? | HS256, HS384, HS512, RS256 (padrão: HS256) |

**Retorna:** `string, error`

Passe somente um dos nomes de algoritmos documentados. Nesta versão do runtime, um valor não aceito passado para `encode` usa HS256 como fallback, em vez de retornar erro. Valide qualquer algoritmo configurável antes da chamada e não copie campos não confiáveis para `_header`; em particular, não permita que a entrada sobrescreva headers JWT reservados, como `alg`.

### Verify

```lua
local claims, err = crypto.jwt.verify(token, secret)
local claims, err = crypto.jwt.verify(token, secret, "HS256", false)
local claims, err = crypto.jwt.verify(token, public_key_pem, "RS256")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `token` | string | Token JWT para verificar |
| `key` | string | Secret (HMAC) ou chave publica PEM (RSA) |
| `alg` | string? | Algoritmo esperado (padrão: HS256) |
| `require_exp` | boolean? | Exigir uma claim `exp` (padrão: true) |

**Retorna:** `table, error`

Quando presentes, `exp` e `nbf` são validados contra o relógio de parede atual da biblioteca JWT, não contra a referência de tempo do workflow. Definir `require_exp = false` permite que a claim `exp` esteja ausente; isso não desativa a validação de uma claim presente. Não use resultados dependentes do tempo para controle sensível a replay em workflows; faça a verificação em uma activity ou valide o tempo com um valor explicitamente seguro para replay.

Sempre passe o algoritmo esperado pelo emissor; a verificação restringe o token exatamente a esse método. Trate as claims retornadas como dados autenticados, não como entrada automaticamente autorizada, e ainda valide emissor, audience, subject e restrições específicas da aplicação.

## Derivação de Chaves

### PBKDF2

```lua
local key, err = crypto.pbkdf2(password, salt, iterations, key_length)
local key, err = crypto.pbkdf2(password, salt, iterations, key_length, "sha512")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `password` | string | Senha/passphrase |
| `salt` | string | Valor de salt |
| `iterations` | integer | Contagem de iterações (máximo 10.000.000) |
| `key_length` | integer | Tamanho desejado da chave em bytes |
| `hash` | string? | sha256 ou sha512 (padrão: sha256) |

**Retorna:** `string, error`

A chave derivada contém bytes brutos. Use um salt aleatório novo para cada verificador de senha armazenado e guarde o salt e os parâmetros de fator de trabalho junto ao verificador; o salt não precisa ser secreto. Não use um salt fixo de exemplo para armazenar senhas em produção.

## Utilitários

### Comparação em Tempo Constante

```lua
local equal = crypto.constant_time_compare(a, b)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `a` | string | Primeira string |
| `b` | string | Segunda string |

**Retorna:** `boolean`

O resultado é `false` quando os tamanhos diferem. A garantia de comparação em tempo constante subjacente vale para entradas de mesmo tamanho; compare digests de tamanho fixo ou outros segredos de mesmo tamanho.

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Tamanho inválido | `errors.INVALID` | não |
| Chave vazia | `errors.INVALID` | não |
| Tamanho de chave inválido | `errors.INVALID` | não |
| Descriptografia falhou | `errors.INTERNAL` | não |
| Token expirado | `errors.INTERNAL` | não |

Veja [Tratamento de Erros](lua/core/errors.md) para trabalhar com erros.
