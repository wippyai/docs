---
title: "Variaveis de Ambiente"
description: "Acesse variaveis de ambiente para valores de configuração, secrets e configuracoes de runtime."
---

# Variáveis de Ambiente
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

O módulo `env` lê e atualiza variáveis de ambiente expostas pelo runtime.

Esta é uma referência de API. Seus exemplos são operações isoladas e pressupõem que as variáveis e políticas de segurança mencionadas já existam.

As variáveis devem ser definidas no [Sistema de Ambiente](system/env.md) antes de poderem ser acessadas. O sistema controla quais backends de armazenamento (SO, arquivo, memória) fornecem valores e se as variáveis são somente leitura.

## Carregamento

```lua
local env = require("env")
```

## `get`

Obtém uma variável de ambiente.

```lua
-- Obter string de conexão do banco
local db_url = env.get("DATABASE_URL")
if not db_url then
    return nil, errors.new({ kind = errors.INVALID, message = "DATABASE_URL not configured" })
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
        return nil, errors.new({ kind = errors.INVALID, message = "Missing required env var: " .. key })
    end
end
```

**Retorna:** `table, error`

## Permissões

O acesso ao ambiente está sujeito à avaliação de políticas de segurança.

### Ações de Segurança

| Ação | Recurso | Descrição |
|------|---------|-----------|
| `env.get` | Nome da variavel | Ler variavel de ambiente |
| `env.set` | Nome da variavel | Escrever variavel de ambiente |

`get_all` não tem ação de segurança dedicada: retorna apenas as variaveis para as quais a ação `env.get` é permitida, filtrando cada nome de variavel através de `env.get`.

### Verificando Acesso

```lua
local security = require("security")

if security.can("env.get", "DATABASE_URL") then
    local url = env.get("DATABASE_URL")
end
```

Consulte o [Modelo de Segurança](system/security.md) para configurar políticas.

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Chave vazia | `errors.INVALID` | não |
| Variável não encontrada | `errors.NOT_FOUND` | não |
| Permissão negada | `errors.PERMISSION_DENIED` | não |

Consulte [Tratamento de erros](lua/core/errors.md) para trabalhar com erros.

## Veja Também

- [Sistema de Ambiente](system/env.md) - Configurar backends de armazenamento e definições de variáveis
