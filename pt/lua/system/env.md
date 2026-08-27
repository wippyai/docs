---
title: "Variáveis de Ambiente"
description: "Leia e atualize variáveis de ambiente expostas pelo sistema de ambiente configurado."
---

# Variáveis de Ambiente
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

O módulo `env` lê e atualiza variáveis de ambiente expostas pelo runtime.

Esta é uma referência de API. Seus exemplos são operações isoladas e pressupõem que as variáveis e políticas de segurança mencionadas já existam.

As variáveis devem ser definidas no [Sistema de Ambiente](../../system/env.md) antes de poderem ser acessadas. O sistema controla quais backends de armazenamento (SO, arquivo, memória) fornecem valores e se as variáveis são somente leitura.

## Carregamento

```lua
local env = require("env")
```

## `get`

Obtém uma variável de ambiente.

```lua
-- Get database connection string
local db_url, db_err = env.get("DATABASE_URL")
if db_err then return nil, db_err end

-- Apply a fallback only to a missing variable. Permission and backend errors
-- still propagate to the caller.
local function get_or(key, fallback)
    local value, err = env.get(key)
    if not err then return value end
    if errors.is(err, errors.NOT_FOUND) then return fallback end
    return nil, err
end

local port, port_err = get_or("PORT", "8080")
if port_err then return nil, port_err end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `key` | string | Nome da variável |

**Retorna:** `string, error`

A função retorna `nil, error` quando a variável não existe.

## `set`

Define uma variável de ambiente.

```lua
-- Set runtime configuration
local updated, set_err = env.set("APP_MODE", "production")
if set_err then return nil, set_err end
return updated
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `key` | string | Nome da variável |
| `value` | string | Valor a definir |

**Retorna:** `boolean, error`

## `get_all`

Obtém todas as variáveis de ambiente acessíveis ao chamador.

```lua
local logger = require("logger")

local vars, vars_err = env.get_all()
if vars_err then return nil, vars_err end

-- Log names only. Values such as connection URLs may contain credentials even
-- when their keys do not include words like SECRET or KEY.
local accessible_keys = {}
for key in pairs(vars) do table.insert(accessible_keys, key) end
logger:debug("accessible environment variables", {keys = accessible_keys})

-- Check required variables
local required = {"DATABASE_URL", "REDIS_URL", "API_KEY"}
for _, key in ipairs(required) do
    if not vars[key] then
        return nil, errors.new({
            message = "Missing required env var: " .. key,
            kind = errors.INVALID
        })
    end
end
```

**Retorna:** `table, error`

## Permissões

O acesso ao ambiente está sujeito à avaliação de políticas de segurança.

### Ações de Segurança

| Ação | Recurso | Descrição |
|------|---------|-----------|
| `env.get` | Nome da variável | Ler variável de ambiente |
| `env.set` | Nome da variável | Escrever variável de ambiente |

`get_all` não tem uma ação de segurança dedicada: ele retorna apenas as variáveis para as quais a ação `env.get` é permitida, filtrando cada nome de variável por meio de `env.get`.

### Verificando Acesso

```lua
local security = require("security")

if security.can("env.get", "DATABASE_URL") then
    local url = env.get("DATABASE_URL")
end
```

Consulte o [Modelo de Segurança](../../system/security.md) para configurar políticas.

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Chave vazia | `errors.INVALID` | não |
| Variável não encontrada | `errors.NOT_FOUND` | não |
| Permissão negada | `errors.PERMISSION_DENIED` | não |

Consulte [Tratamento de erros](../core/errors.md) para trabalhar com erros.

## Veja Também

- [Sistema de Ambiente](../../system/env.md) - Configurar backends de armazenamento e definições de variáveis
