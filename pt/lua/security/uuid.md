---
title: "Geração de UUID"
description: "Gere, valide, inspecione, analise e formate UUIDs."
---

# Geração de UUID
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

O módulo `uuid` gera, valida, inspeciona, analisa e formata UUIDs. Em workflows determinísticos, a geração de v1, v4 e v7 é executada como side effect registrado e retorna o valor registrado durante o replay. A geração de v3 e v5 baseada em namespace é determinística e executada diretamente.

Esta página é uma referência de API com chamadas isoladas. Valores como `namespace`, `name`, `input` e `id` vêm da aplicação circundante. Capture e trate o segundo retorno `error` antes de consumir resultados gerados, analisados, inspecionados ou formatados. UUIDs são identificadores, não credenciais bearer; não use nenhuma versão de UUID como token de autenticação ou segredo.

## Carregamento

```lua
local uuid = require("uuid")
```

## UUIDs não determinísticos

### Versão 1

UUID baseado em tempo com timestamp e node ID.

A versão 1 expõe seu horário de criação e identificador de nó. Evite-a quando esses dados forem sensíveis; prefira v4 quando precisar apenas de um identificador opaco.

```lua
local id, err = uuid.v1()
```

**Retorna:** `string, error`

### Versão 4

UUID aleatório.

```lua
local id, err = uuid.v4()
```

**Retorna:** `string, error`

### Versão 7

UUID ordenado por tempo que codifica o horário de criação para indexação cronológica. Não dependa dele como uma sequência estritamente monotônica, especialmente para valores gerados no mesmo intervalo de timestamp.

```lua
local id, err = uuid.v7()
```

**Retorna:** `string, error`

## UUIDs determinísticos

### Versão 3

UUID determinístico derivado de namespace e nome usando MD5.

```lua
local id, err = uuid.v3(namespace, name)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `namespace` | string | String UUID válida |
| `name` | string | Valor para hash |

**Retorna:** `string, error`

### Versão 5

UUID determinístico derivado de namespace e nome usando SHA-1.

```lua
local NS_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
local id, err = uuid.v5(NS_URL, "https://example.com/resource")
if err then
    return nil, err
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `namespace` | string | String UUID válida |
| `name` | string | Valor para hash |

**Retorna:** `string, error`

## Inspeção

### `validate`

```lua
local valid = uuid.validate(input)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `input` | any | Valor para verificar |

**Retorna:** `boolean, nil`. Entradas que não sejam strings ou estejam malformadas retornam `false`; a validação não gera um erro estruturado.

### `version`

```lua
local ver, err = uuid.version(id)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `uuid` | string | String UUID válida |

**Retorna:** `integer, error`

### `variant`

```lua
local var, err = uuid.variant(id)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `uuid` | string | String UUID válida |

**Retorna:** `string, error` (RFC4122, Reserved, Microsoft, Future, NCS ou Invalid)

### `parse`

```lua
local info, err = uuid.parse(id)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `uuid` | string | String UUID válida |

**Retorna:** `table, error`

Campos da tabela retornada:
- `version` (integer): Versão do UUID (1, 3, 4, 5 ou 7)
- `variant` (string): RFC4122, Reserved, Microsoft, Future, NCS ou Invalid
- `timestamp` (integer): Timestamp Unix (apenas v1 e v7)
- `node` (string): identificador de nó bruto com seis bytes (apenas v1); codifique-o antes de exibir ou armazenar como texto

### `format`

```lua
local formatted, err = uuid.format(id, "standard")
local formatted, err = uuid.format(id, "simple")
local formatted, err = uuid.format(id, "urn")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `uuid` | string | String UUID válida |
| `format` | string? | standard (padrão), simple ou urn |

**Retorna:** `string, error`

## Erros

| Condição | Kind | Retentável |
|----------|------|------------|
| Tipo de input inválido | `errors.INVALID` | não |
| Formato de UUID inválido | `errors.INVALID` | não |
| Tipo de formato não suportado | `errors.INVALID` | não |
| Geração falhou | `errors.INTERNAL` | não |

Consulte [Tratamento de erros](../core/errors.md) para trabalhar com erros.
