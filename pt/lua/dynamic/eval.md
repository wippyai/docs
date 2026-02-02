# Avaliacao Dinamica

Execute código dinamicamente em tempo de execução com ambientes sandboxed e acesso controlado a modulos.

## Dois Sistemas

Wippy fornece dois sistemas de avaliacao:

| Sistema | Proposito | Caso de Uso |
|---------|-----------|-------------|
| `expr` | Avaliacao de expressao | Config, templates, calculos simples |
| `eval_runner` | Execução Lua completa | Plugins, scripts de usuario, código dinamico |

## Módulo expr

Avaliacao leve de expressoes usando a sintaxe expr-lang.

```lua
local expr = require("expr")

local result, err = expr.eval("x + y * 2", {x = 10, y = 5})
-- result = 20
```

### Compilando Expressoes

Compilar uma vez, executar muitas vezes:

```lua
local program, err = expr.compile("price * quantity")

local total1 = program:run({price = 10, quantity = 5})
local total2 = program:run({price = 20, quantity = 3})
```

### Sintaxe Suportada

```lua
-- Aritmetica
expr.eval("1 + 2 * 3")           -- 7
expr.eval("10 / 2 - 1")          -- 4
expr.eval("10 % 3")              -- 1

-- Comparacao
expr.eval("x > 5", {x = 10})     -- true
expr.eval("x == y", {x = 1, y = 1}) -- true

-- Booleano
expr.eval("a && b", {a = true, b = false})  -- false
expr.eval("a || b", {a = true, b = false})  -- true
expr.eval("!a", {a = false})     -- true

-- Ternario
expr.eval("x > 0 ? 'positive' : 'negative'", {x = 5})

-- Funcoes
expr.eval("max(1, 5, 3)")        -- 5
expr.eval("min(1, 5, 3)")        -- 1
expr.eval("len([1, 2, 3])")      -- 3

-- Arrays
expr.eval("[1, 2, 3][0]")        -- 1

-- Concatenacao de string
expr.eval("'hello' + ' ' + 'world'")
```

## Módulo eval_runner

Execução Lua completa com controles de seguranca.

```lua
local runner = require("eval_runner")

local result, err = runner.run({
    source = [[
        local function double(x)
            return x * 2
        end
        return double(input)
    ]],
    args = {21}
})
-- result = 42
```

### Configuracao

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `source` | string | Código fonte Lua (obrigatorio) |
| `method` | string | Função para chamar na tabela retornada |
| `args` | any[] | Argumentos passados para função |
| `modules` | string[] | Modulos builtin permitidos |
| `imports` | table | Entradas do registry para importar |
| `context` | table | Valores disponiveis como `ctx` |
| `allow_classes` | string[] | Classes de módulo adicionais |
| `custom_modules` | table | Tabelas customizadas como modulos |

### Acesso a Modulos

Whitelist de modulos permitidos:

```lua
runner.run({
    source = [[
        local json = require("json")
        return json.encode({hello = "world"})
    ]],
    modules = {"json"}
})
```

Modulos fora da lista não podem ser requeridos.

### Imports do Registry

Importar entradas do registry:

```lua
runner.run({
    source = [[
        local utils = require("utils")
        return utils.format(data)
    ]],
    imports = {
        utils = "app.lib:utilities"
    },
    args = {{key = "value"}}
})
```

### Modulos Customizados

Injetar tabelas customizadas:

```lua
runner.run({
    source = [[
        return sdk.version
    ]],
    custom_modules = {
        sdk = {version = "1.0.0", api_key = "xxx"}
    }
})
```

### Valores de Contexto

Passar dados acessiveis como `ctx`:

```lua
runner.run({
    source = [[
        return "Ola, " .. ctx.user
    ]],
    context = {user = "Alice"}
})
```

### Compilando Programas

Compilar uma vez para execução repetida:

```lua
local program, err = runner.compile([[
    local function process(x)
        return x * 2
    end
    return { process = process }
]], "process", {modules = {"json"}})

local result = program:run({10})  -- 20
```

## Modelo de Seguranca

### Classes de Modulos

Modulos sao categorizados por capacidade:

| Classe | Descrição | Padrão |
|--------|-----------|--------|
| `deterministic` | Funcoes puras | Permitido |
| `encoding` | Encoding de dados | Permitido |
| `time` | Operacoes de tempo | Permitido |
| `nondeterministic` | Random, etc. | Permitido |
| `process` | Spawn, registry | Bloqueado |
| `storage` | Arquivo, banco de dados | Bloqueado |
| `network` | HTTP, sockets | Bloqueado |

### Habilitando Classes Bloqueadas

```lua
runner.run({
    source = [[
        local http = require("http_client")
        return http.get("https://api.example.com")
    ]],
    modules = {"http_client"},
    allow_classes = {"network"}
})
```

### Verificacoes de Permissao

O sistema verifica permissoes para:

- `eval.compile` - Antes da compilacao
- `eval.run` - Antes da execução
- `eval.module` - Para cada módulo na whitelist
- `eval.import` - Para cada import do registry
- `eval.class` - Para cada classe permitida

Configure em politicas de seguranca.

## Tratamento de Erros

```lua
local result, err = runner.run({...})
if err then
    if err:kind() == errors.PERMISSION_DENIED then
        -- Acesso negado por politica de seguranca
    elseif err:kind() == errors.INVALID then
        -- Source ou configuracao invalida
    elseif err:kind() == errors.INTERNAL then
        -- Erro de execução ou compilacao
    end
end
```

## Casos de Uso

### Sistema de Plugins

```lua
local plugins = registry.find({meta = {type = "plugin"}})

for _, plugin in ipairs(plugins) do
    local source = plugin:data().source
    runner.run({
        source = source,
        method = "init",
        modules = {"json", "time"},
        context = {config = app_config}
    })
end
```

### Avaliacao de Template

```lua
local template = "Ola, {{name}}! Voce tem {{count}} mensagens."
local compiled = expr.compile("name")

-- Avaliacao rapida repetida
for _, user in ipairs(users) do
    local greeting = compiled:run({name = user.name})
end
```

### Scripts de Usuario

```lua
local user_code = request:body()

local result, err = runner.run({
    source = user_code,
    modules = {"json", "text"},  -- Apenas modulos seguros
    context = {data = input_data}
})
```

## Veja Também

- [Expression](lua/dynamic/expression.md) - Referencia da linguagem de expressao
- [Exec](lua/dynamic/exec.md) - Execução de comandos de sistema
- [Security](lua/security/security.md) - Politicas de seguranca
