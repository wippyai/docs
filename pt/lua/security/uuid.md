# Geracao de UUID
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Gere identificadores unicos universais. Adaptado para workflows - UUIDs aleatorios retornam valores consistentes em replay.

## Carregamento

```lua
local uuid = require("uuid")
```

## UUIDs Aleatorios

### Versao 1

UUID baseado em tempo com timestamp e node ID.

```lua
local id, err = uuid.v1()
```

**Retorna:** `string, error`

### Versao 4

UUID aleatorio.

```lua
local id, err = uuid.v4()
```

**Retorna:** `string, error`

### Versao 7

UUID ordenado por tempo. Ordenavel por tempo de criacao.

```lua
local id, err = uuid.v7()
```

**Retorna:** `string, error`

## UUIDs Deterministicos

### Versao 3

UUID deterministico de namespace e nome usando MD5.

```lua
local id, err = uuid.v3(namespace, name)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `namespace` | string | String UUID valida |
| `name` | string | Valor para hash |

**Retorna:** `string, error`

### Versao 5

UUID deterministico de namespace e nome usando SHA-1.

```lua
local NS_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
local id, err = uuid.v5(NS_URL, "https://example.com/resource")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `namespace` | string | String UUID valida |
| `name` | string | Valor para hash |

**Retorna:** `string, error`

## Inspecao

### Validar

```lua
local valid = uuid.validate(input)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `input` | any | Valor para verificar |

**Retorna:** `boolean`

### Obter Versao

```lua
local ver, err = uuid.version(id)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `uuid` | string | String UUID valida |

**Retorna:** `integer, error`

### Obter Variante

```lua
local var, err = uuid.variant(id)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `uuid` | string | String UUID valida |

**Retorna:** `string, error` (RFC4122, Microsoft, NCS ou Invalid)

### Parse

```lua
local info, err = uuid.parse(id)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `uuid` | string | String UUID valida |

**Retorna:** `table, error`

Campos da tabela retornada:
- `version` (integer): Versao do UUID (1, 3, 4, 5 ou 7)
- `variant` (string): RFC4122, Microsoft, NCS ou Invalid
- `timestamp` (integer): Timestamp Unix (apenas v1 e v7)
- `node` (string): Node ID (apenas v1)

### Formatar

```lua
local formatted, err = uuid.format(id, "standard")
local formatted, err = uuid.format(id, "simple")
local formatted, err = uuid.format(id, "urn")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `uuid` | string | String UUID valida |
| `format` | string? | standard (padrao), simple ou urn |

**Retorna:** `string, error`

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| Tipo de input invalido | `errors.INVALID` | nao |
| Formato de UUID invalido | `errors.INVALID` | nao |
| Tipo de formato nao suportado | `errors.INVALID` | nao |
| Geracao falhou | `errors.INTERNAL` | nao |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
