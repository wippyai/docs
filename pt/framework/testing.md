---
title: "Framework de Testes"
description: "Defina e execute testes Wippy com suites BDD, asserções, hooks de ciclo de vida, mocks e funções de teste simples."
---

# Framework de Testes

O módulo `wippy/test` fornece suites BDD, asserções, hooks de ciclo de vida, mocks e um runner para entradas de teste.

Esta página é uma introdução à API. Seus blocos de Lua, YAML, saída e estrutura de projeto são trechos de referência que podem ser combinados em um projeto Wippy existente; eles não formam um projeto completo pronto para copiar e executar. Nomes como `validate`, `format_name`, `db`, `connect` e `notify_user` representam funções ou módulos da aplicação fornecidos pelo código testado. Para um exemplo completo e executável, siga [Testando uma Aplicação Wippy](../tutorials/testing.md).

## Configuracao

Adicione a dependencia:

```bash
wippy add wippy/test
wippy install
```

O modulo registra o entrypoint de teste automaticamente (um comando com `use_case: test`). Uma vez instalado, `wippy test` descobre e executa todas as entradas de teste no seu projeto.

## Definindo Testes

Testes sao entradas `function.lua` com `meta.type: test`:

```yaml
version: "1.0"
namespace: app.test

entries:
  - name: math
    kind: function.lua
    meta:
      type: test
      suite: math
      name: Math operations
    source: file://math_test.lua
    method: main
    imports:
      test: wippy.test:test
```

### Metadados do Teste

| Campo | Obrigatorio | Descricao |
|-------|-------------|-----------|
| `type` | Sim | Deve ser `"test"` para que o runner o descubra |
| `suite` | Nao | Agrupa testes na saida do runner |
| `name` | Nao | Nome exibido na saida do runner |
| `order` | Nao | Ordem de execucao dentro de uma suite (menor executa primeiro) |

## Escrevendo Testes

### Estilo BDD

Use blocos `describe` e `it` para estruturar testes:

```lua
local test = require("test")

local function define_tests()
    test.describe("calculator", function()
        test.it("adds numbers", function()
            test.eq(1 + 1, 2)
        end)

        test.it("multiplies numbers", function()
            test.eq(3 * 4, 12)
        end)
    end)
end

local run_cases = test.run_cases(define_tests)

local function run(options)
    local result = run_cases(options)
    if result.failed_tests > 0 then
        error("tests failed: " .. result.failed_tests)
    end
    return result
end

return { run = run }
```

### Suites Aninhadas

Suites podem ser aninhadas para agrupar comportamentos relacionados:

```lua
test.describe("user", function()
    test.describe("validation", function()
        test.it("requires name", function()
            test.ok(validate({}).error)
        end)

        test.it("accepts valid input", function()
            test.is_nil(validate({name = "Alice"}).error)
        end)
    end)

    test.describe("formatting", function()
        test.it("formats display name", function()
            test.eq(format_name("alice"), "Alice")
        end)
    end)
end)
```

### Pulando Testes

```lua
test.it_skip("not implemented yet", function()
    test.fail("TODO")
end)
```

Testes ignorados aparecem na saída, mas não contam como falhas.

### Aliases de Suite

`test.spec` e `test.context` sao aliases para `test.describe`:

```lua
test.spec("feature", function()
    test.context("when valid input", function()
        test.it("succeeds", function()
            test.ok(true)
        end)
    end)
end)
```

## Assercoes

### Igualdade

```lua
test.eq(actual, expected, msg?)       -- actual == expected
test.neq(actual, expected, msg?)      -- actual ~= expected
```

### Veracidade

```lua
test.ok(val, msg?)                    -- val is truthy
test.fail(msg?)                       -- unconditional failure
```

### Verificacoes de Nil

```lua
test.is_nil(val, msg?)                -- val == nil
test.not_nil(val, msg?)               -- val ~= nil
```

### Verificacoes de Tipo

```lua
test.is_true(val, msg?)               -- val == true
test.is_false(val, msg?)              -- val == false
test.is_string(val, msg?)
test.is_number(val, msg?)
test.is_table(val, msg?)
test.is_function(val, msg?)
test.is_boolean(val, msg?)
```

### Strings e Colecoes

```lua
test.contains(str, substr, msg?)      -- substring match
test.matches(str, pattern, msg?)      -- Lua pattern match
test.has_key(tbl, key, msg?)          -- table key exists
test.len(val, expected, msg?)         -- #val == expected
```

### Comparacoes Numericas

```lua
test.gt(a, b, msg?)                   -- a > b
test.gte(a, b, msg?)                  -- a >= b
test.lt(a, b, msg?)                   -- a < b
test.lte(a, b, msg?)                  -- a <= b
```

### Tratamento de Erros

```lua
test.throws(fn, msg?)                 -- fn() raises error, returns it
test.has_error(val, err, msg?)        -- val is nil, err is not nil
test.no_error(val, err, msg?)         -- err is nil
```

Todas as assercoes aceitam uma mensagem opcional como ultimo argumento. Em caso de falha, a mensagem e incluida na saida de erro.

## Hooks de Ciclo de Vida

```lua
test.describe("database", function()
    test.before_all(function()
        -- runs once before the suite
        db = connect()
    end)

    test.after_all(function()
        -- runs once after the suite
        db:close()
    end)

    test.before_each(function()
        -- runs before each test
        db:begin_transaction()
    end)

    test.after_each(function()
        -- runs after each test
        db:rollback()
    end)

    test.it("inserts a record", function()
        db:exec("INSERT INTO users (name) VALUES ('Alice')")
        local count = db:query_row("SELECT COUNT(*) FROM users")
        test.eq(count, 1)
    end)
end)
```

Hooks em suites aninhadas executam em ordem: `before_each` do pai executa antes do `before_each` do filho, e `after_each` do filho executa antes do `after_each` do pai.

## Mocking

O sistema de mock substitui campos de objetos globais e os restaura após cada teste.

### Mock Basico

```lua
test.describe("notifications", function()
    test.it("sends message", function()
        local sent = false
        test.mock("process.send", function(pid, topic, payload)
            sent = true
        end)

        notify_user("hello")
        test.is_true(sent)
        -- mock is auto-restored after this test
    end)
end)
```

### API de Mock

```lua
test.mock("object.field", replacement)    -- replace a global field
test.mock_process("field", replacement)   -- shorthand for process fields
test.restore_mock("object.field")         -- restore one mock
test.restore_all_mocks()                  -- restore all mocks
```

Caminhos de mock usam notacao de ponto: `"process.send"` substitui `_G.process.send`.

Mocks para `process.send` automaticamente fazem proxy de mensagens do framework de teste atraves da funcao original, para que o relato de eventos de teste continue funcionando quando process.send esta mockado.

Todos os mocks sao automaticamente restaurados apos cada teste via o hook `after_each`.

## Executando Testes

### Executar Todos os Testes

```bash
wippy test
```

### Filtrar por Padrao

```bash
wippy test math
wippy test user validation
```

Os filtros correspondem a substrings literais dos IDs das entradas. Quando vários padrões são informados, uma entrada é executada se seu ID corresponder a qualquer um deles.

### Exemplo de Saida

```
3 tests in 1 suites

  calculator
    + adds numbers                           0ms
    + multiplies numbers                     0ms
    - divides by zero                        1ms
      Error: expected error, got nil

  1 suite | 2 passed | 1 failed | 0 skipped | 3ms
```

## Testes Simples

Para testes que não precisam de suites BDD, defina uma função que retorne `true` ou lance um erro:

```lua
local funcs = require("funcs")

local function main()
    local result, err = funcs.call("app:my_function", "input")
    if err then
        error("call failed: " .. tostring(err))
    end
    if result ~= "expected" then
        error("expected 'expected', got: " .. tostring(result))
    end
    return true
end

return { main = main }
```

```yaml
  - name: integration
    kind: function.lua
    meta:
      type: test
      suite: integration
    source: file://integration_test.lua
    method: main
    modules:
      - funcs
```

O runner detecta se um teste usa eventos de caso BDD ou retorna um valor simples. Ambos os padroes funcionam com `wippy test`.

## Estrutura do Projeto

Um layout tipico de testes:

```
src/
  _index.yaml
  app.lua
  test/
    _index.yaml          # test entries
    math_test.lua
    user_test.lua
    integration_test.lua
```

O `_index.yaml` de testes define o namespace e as entradas de teste:

```yaml
version: "1.0"
namespace: app.test

entries:
  - name: math
    kind: function.lua
    meta:
      type: test
      suite: math
    source: file://math_test.lua
    method: main
    imports:
      test: wippy.test:test

  - name: user
    kind: function.lua
    meta:
      type: test
      suite: user
    source: file://user_test.lua
    method: main
    imports:
      test: wippy.test:test
```

## Host de Terminal

O `wippy/test` depende de `wippy/terminal`, que fornece o `wippy.terminal:host` iniciado automaticamente e usado pelo runner da CLI. As aplicações não precisam declarar um host de processos ou de terminal separado apenas para executar `wippy test`.

## Veja Tambem

- [Visão Geral do Framework](./overview.md) — Instalação e importação de módulos do framework
- [Referência da CLI](../guides/cli.md) — Comando de teste e opções
- [Funções](../concepts/functions.md) — Entradas de função e invocação
