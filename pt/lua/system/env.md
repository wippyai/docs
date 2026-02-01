# Variaveis de Ambiente
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Acesse variaveis de ambiente para valores de configuracao, secrets e configuracoes de runtime.

Variaveis devem ser definidas no [Environment System](system-env.md) antes de poderem ser acessadas. O sistema controla quais backends de armazenamento (OS, arquivo, memoria) fornecem valores e se variaveis sao somente leitura.

## Carregamento

```lua
local env = require("env")
```

## get

Obtem um valor de variavel de ambiente.

```lua
-- Obter string de conexao do banco
local db_url = env.get("DATABASE_URL")
if not db_url then
    return nil, errors.new("INVALID", "DATABASE_URL not configured")
end

-- Obter com fallback
local port = env.get("PORT") or "8080"
local host = env.get("HOST") or "localhost"

-- Obter secrets
local api_key = env.get("API_SECRET_KEY")
local jwt_secret = env.get("JWT_SECRET")

-- Configuracao
local log_level = env.get("LOG_LEVEL") or "info"
local debug_mode = env.get("DEBUG") == "true"
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `key` | string | Nome da variavel |

**Retorna:** `string, error`

Retorna `nil, error` se variavel nao existe.

## set

Define uma variavel de ambiente.

```lua
-- Definir configuracao de runtime
env.set("APP_MODE", "production")

-- Sobrescrever para testes
env.set("API_URL", "http://localhost:8080")

-- Definir baseado em condicoes
if is_development then
    env.set("LOG_LEVEL", "debug")
end
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `key` | string | Nome da variavel |
| `value` | string | Valor a definir |

**Retorna:** `boolean, error`

## get_all

Obtem todas as variaveis de ambiente acessiveis.

```lua
local vars = env.get_all()

-- Logar configuracao (cuidado para nao logar secrets)
for key, value in pairs(vars) do
    if not key:match("SECRET") and not key:match("KEY") then
        logger.debug("env", {[key] = value})
    end
end

-- Verificar variaveis obrigatorias
local required = {"DATABASE_URL", "REDIS_URL", "API_KEY"}
for _, key in ipairs(required) do
    if not vars[key] then
        return nil, errors.new("INVALID", "Missing required env var: " .. key)
    end
end
```

**Retorna:** `table, error`

## Permissoes

Acesso a ambiente esta sujeito a avaliacao de politica de seguranca.

### Acoes de Seguranca

| Acao | Recurso | Descricao |
|------|---------|-----------|
| `env.get` | Nome da variavel | Ler variavel de ambiente |
| `env.set` | Nome da variavel | Escrever variavel de ambiente |
| `env.get_all` | `*` | Listar todas as variaveis |

### Verificando Acesso

```lua
local security = require("security")

if security.can("env.get", "DATABASE_URL") then
    local url = env.get("DATABASE_URL")
end
```

Veja [Security Model](system-security.md) para configuracao de politicas.

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| Chave vazia | `errors.INVALID` | nao |
| Variavel nao encontrada | `errors.NOT_FOUND` | nao |
| Permissao negada | `errors.PERMISSION_DENIED` | nao |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.

## Veja Tambem

- [Environment System](system-env.md) - Configurar backends de armazenamento e definicoes de variaveis
