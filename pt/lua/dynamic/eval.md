---
title: "Avaliação Dinâmica"
description: "Avalie expressões ou execute código Lua com capacidades restritas e acesso configurado a módulos e ao registro."
---

# Avaliação Dinâmica

O Wippy fornece avaliação de expressões e execução de Lua com capacidades restritas para código fornecido durante a execução. Esta página é um guia de API: seus exemplos são executados dentro de um processo Lua Wippy existente e pressupõem que a entrada declare os módulos usados pelo chamador. IDs de registro, políticas e dados da aplicação são placeholders fornecidos pela aplicação.

`eval_runner` limita quais módulos Wippy o código avaliado pode acessar, mas não oferece contenção completa para código hostil. Em particular, `limits.max_steps` conta retomadas do scheduler, não instruções Lua; um loop infinito que não cede não é interrompido por esse limite.

## Escolhendo um Sistema de Avaliação

Wippy fornece dois sistemas de avaliação:

| Sistema | Proposito | Caso de Uso |
|---------|-----------|-------------|
| `expr` | Avaliação de expressao | Config, templates, calculos simples |
| `eval_runner` | Execução Lua com capacidades restritas | Plugins confiáveis e código dinâmico controlado |

## Avaliação de Expressões com `expr`

O módulo `expr` avalia expressões escritas na sintaxe expr-lang. Use-o para expressões, não para programas Lua completos. [Linguagem de Expressões](lua/dynamic/expression.md) é a referência completa da API Lua e da sintaxe.

```lua
local expr = require("expr")

local result, err = expr.eval("x + y * 2", {x = 10, y = 5})
if err then
    return nil, err
end
-- result = 20
```

### Reutilizando Expressões Compiladas

Compile uma expressão para avaliá-la repetidamente:

```lua
local program, err = expr.compile("price * quantity")
if err then
    return nil, err
end

local total1, first_err = program:run({price = 10, quantity = 5})
if first_err then
    return nil, first_err
end

local total2, second_err = program:run({price = 20, quantity = 3})
if second_err then
    return nil, second_err
end
```

### Visão Geral da Sintaxe

| Recurso | Expressão | Resultado |
|---------|-----------|-----------|
| Aritmética | `1 + 2 * 3` | `7` |
| Resto | `10 % 3` | `1` |
| Comparação | `x > 5` com `{x = 10}` | `true` |
| Booleano | `a && b` com `{a = true, b = false}` | `false` |
| Ternário | `x > 0 ? 'positive' : 'negative'` com `{x = 5}` | `"positive"` |
| Função | `max(1, 5, 3)` | `5` |
| Índice de array | `[1, 2, 3][0]` | `1` |
| Concatenação | `'hello' + ' ' + 'world'` | `"hello world"` |

## Lua com Capacidades Restritas usando `eval_runner`

O módulo `eval_runner` executa Lua com acesso configurado a módulos e ao registro.

```lua
local runner = require("eval_runner")

local result, err = runner.run({
    source = [[
        local function double(x)
            return x * 2
        end
        return { double = double }
    ]],
    method = "double",
    args = {21}
})
if err then
    return nil, err
end
-- result = 42
```

### Configuração

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `source` | string | Código-fonte Lua (obrigatório) |
| `method` | string | Função a chamar na tabela retornada |
| `args` | any[] | Argumentos passados à função |
| `modules` | string[] | Módulos integrados permitidos |
| `imports` | table | Entradas do registro a importar |
| `context` | table | Valores disponíveis como `ctx` |
| `allow_classes` | string[] | Classes adicionais de módulos |
| `custom_modules` | table | Tabelas personalizadas como módulos |
| `limits` | table | Limites de execução da avaliação |

Se `modules` for omitido ou vazio, o host fornece todos os módulos disponíveis cujas classes passam pelo filtro padrão. Nesse modo implícito, `allow_classes` amplia o filtro e pode adicionar módulos das classes indicadas. Com uma lista `modules` explícita, ele apenas permite módulos listados cujas classes seriam excluídas. Prefira uma lista explícita e mínima para tornar visíveis as capacidades do programa avaliado.

No runtime v0.3.32a, as verificações de política `eval.module` cobrem os nomes fornecidos explicitamente em `modules`, não os módulos selecionados implicitamente pelo filtro padrão. Para remover um desses módulos padrão implícitos, passe uma lista explícita.

### Limite de Passos

Use `limits.max_steps` para limitar as retomadas do scheduler durante uma avaliação:

```lua
local result, err = runner.run({
    source = user_code,
    modules = {"json"},
    limits = {max_steps = 1000}
})
if err then
    return nil, err
end
```

`max_steps` deve ser um inteiro não negativo. Quando omitido, a avaliação herda `lua.eval.max_steps` (padrão `10000`); o valor explícito `0` remove o limite. Cada retomada do scheduler consome um passo, portanto yields de chamadas de módulos consomem o orçamento. Iterações comuns de loops Lua não consomem, então essa configuração não é um orçamento de CPU ou instruções para código que não cede.

Campos desconhecidos de `limits`, um valor `limits` que não seja tabela e valores inválidos de `max_steps` retornam `errors.INVALID` não retentável.

### Acesso a Módulos

Forneça uma allowlist de módulos:

```lua
local encoded, err = runner.run({
    source = [[
        local json = require("json")
        return json.encode({hello = "world"})
    ]],
    modules = {"json"}
})
if err then
    return nil, err
end
```

Quando uma lista explícita está presente, módulos fora dela não podem ser importados. Cada módulo listado também exige a permissão `eval.module`.

### Imports do Registry

Importar entradas do registry:

```lua
local result, err = runner.run({
    source = [[
        local data = ...
        return utils.format(data)
    ]],
    imports = {
        utils = "app.lib:utilities"
    },
    args = {{key = "value"}}
})
if err then
    return nil, err
end
```

A biblioteca importada deve ser uma biblioteca de registry baseada em código-fonte que retorne um valor. O alias — `utils` neste exemplo — é vinculado como global no programa avaliado; ele não é um módulo Wippy e não exige `require()`.

### Imports Privilegiados

Um import pode receber módulos que o próprio código avaliado não consegue ver. Use a forma de tabela com `id` e `modules`:

```lua
local quote, err = runner.run({
    source = [[
        return pricing.quote(...)
    ]],
    modules = {"json"},
    imports = {
        pricing = { id = "app.lib:pricing", modules = {"funcs"} }
    },
})
if err then
    return nil, err
end
```

A biblioteca `pricing` executa em seu próprio ambiente com escopo onde `funcs` está disponível; o código avaliado não pode dar require nem alcançar `funcs` diretamente. Conceder um módulo a um import exige que o chamador detenha a permissão `eval.module` para esse módulo — capacidades não podem ser delegadas além do que o próprio chamador tem permitido.

### Módulos Personalizados

Expõe tabelas personalizadas como módulos:

```lua
local version, err = runner.run({
    source = [[
        return sdk.version
    ]],
    custom_modules = {
        sdk = {version = "1.0.0"}
    }
})
if err then
    return nil, err
end
```

Os valores dos módulos personalizados são diretamente acessíveis pelo código avaliado. Não coloque segredos nem handles privilegiados nessas tabelas, a menos que a divulgação a esse código seja intencional.

### Valores de Contexto

Passar dados acessiveis como `ctx`:

```lua
local greeting, err = runner.run({
    source = [[
        local user, ctx_err = ctx.get("user")
        if ctx_err then error(ctx_err) end
        return "Hello, " .. user
    ]],
    modules = {"ctx"},
    context = {user = "Alice"}
})
if err then
    return nil, err
end
```

### Compilando Programas

`runner.compile` valida o código-fonte e reporta seu entrypoint e módulos sem executá-lo:

```lua
local program, err = runner.compile([[
    local function process(x)
        return x * 2
    end
    return { process = process }
]], "process", {modules = {"json"}})
if err then
    return nil, err
end

program:method()   -- "process"  (string)
program:modules()  -- {"json"}    (string[])
```

O programa compilado é informativo; execute chamando `runner.run` com o código-fonte e o método.

## Controles de Capacidade

### Classes de Módulos

Os módulos são categorizados por capacidade:

| Classe | Descrição | Padrão |
|--------|-----------|--------|
| `deterministic` | Funções puras | Permitido |
| `encoding` | Encoding de dados | Permitido |
| `time` | Operações de tempo | Permitido |
| `nondeterministic` | Random, etc. | Permitido |
| `io` | Operações de entrada/saída sem outra classe bloqueada | Permitido |
| `security` | Helpers de segurança | Permitido |
| `workflow` | Operações seguras para workflows | Permitido |
| `process` | Spawn, registry | Bloqueado |
| `storage` | Arquivo, banco de dados | Bloqueado |
| `network` | HTTP, sockets | Bloqueado |

### Habilitando Classes Bloqueadas

```lua
local status, err = runner.run({
    source = [[
        local http = require("http_client")
        local response, err = http.get("https://api.example.com")
        if err then error(err) end
        return response.status_code
    ]],
    modules = {"http_client"},
    allow_classes = {"network"}
})
if err then
    return nil, err
end
```

A autorização da classe apenas admite o módulo no ambiente de avaliação. As verificações de segurança do próprio módulo e os controles de acesso externos continuam valendo.

### Verificações de Permissão

O sistema verifica permissões para:

- `eval.compile` - Antes da compilação
- `eval.run` - Antes da execução
- `eval.module` - Para cada módulo na whitelist, e para cada módulo concedido a um import privilegiado
- `eval.import` - Para cada import do registry
- `eval.class` - Para cada classe permitida

Configure em políticas de segurança.

## Cache de Compilação

Programas compilados são armazenados em um LRU cuja chave contém o código-fonte, o método, os módulos e as classes permitidas. Execuções repetidas de código idêntico pulam a compilação. Imports, módulos personalizados, argumentos e contexto são vinculados em tempo de execução e não afetam a chave do cache.

```yaml
# .wippy.yaml
lua:
  eval:
    cache_size: 256   # entries; 0 or less disables caching (default: 256)
    cache_ttl: 0      # expiry; 0 = no expiry (default: 0)
    max_steps: 10000  # inherited run limit; 0 = unlimited (default: 10000)
```

## Tratamento de Erros

```lua
local result, err = runner.run(run_config)
if err then
    if err:kind() == errors.PERMISSION_DENIED then
        -- Access denied by security policy
    elseif err:kind() == errors.INVALID then
        -- Missing source or invalid limits configuration
    elseif err:kind() == errors.INTERNAL then
        -- Syntax, compilation, import, or execution failure
    end
end
```

Aqui, `run_config` é a tabela de configuração montada pela aplicação.

## Escolhendo por Caso de Uso

### Plugins

```lua
local plugins, find_err = registry.find({["meta.type"] = "plugin"})
if find_err then
    return nil, find_err
end

for _, plugin in ipairs(plugins) do
    local _, run_err = runner.run({
        source = plugin.data.source,
        method = "init",
        modules = {"json", "time"},
        context = {config = app_config}
    })
    if run_err then
        return nil, run_err
    end
end
```

Este padrão parcial pressupõe que o chamador carregou `registry` e `eval_runner`, que `app_config` está definido e que as entradas correspondentes do registry armazenam o código-fonte Lua em `data.source`. `registry.find` retorna tabelas de entrada, portanto os campos são lidos como `plugin.data`, não por um método da entrada.

### Regras Repetidas

```lua
local compiled, compile_err = expr.compile("score >= minimum")
if compile_err then
    return nil, compile_err
end

for _, candidate in ipairs(candidates) do
    local accepted, run_err = compiled:run({
        score = candidate.score,
        minimum = 80
    })
    if run_err then
        return nil, run_err
    end
    candidate.accepted = accepted
end
```

Este padrão parcial pressupõe que `candidates` é fornecido pela aplicação. Use o módulo de templates, em vez de `expr`, quando a saída for texto renderizado.

### Scripts de Usuário

```lua
local result, err = runner.run({
    source = user_code, -- Supplied by the surrounding application
    modules = {"json", "text"},
    context = {data = input_data}
})
if err then
    return nil, err
end
```

Este é um padrão parcial de integração, não um sandbox para código hostil. Valide quem pode fornecer `user_code`, conceda apenas os módulos e políticas necessários e imponha um timeout externo ou uma fronteira de isolamento quando código não confiável puder deixar de ceder a execução.

## Veja Também

- [Expressões](./expression.md) - Referência da linguagem de expressões
- [Execução de Comandos](lua/dynamic/exec.md) - Execução de comandos do sistema
- [Segurança](lua/security/security.md) - Políticas de segurança
