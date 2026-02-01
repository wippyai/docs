# Testes

Escreva e execute testes para suas aplicações Wippy usando o framework de testes integrado.

## Descoberta de Testes

Testes são descobertos por metadados. O executor de testes encontra todas as entradas do registro com `meta.type = "test"` e as executa.

```bash
wippy run app:test_runner app:terminal
```

O executor usa `registry.find({["meta.type"] = "test"})` para localizar testes e os chama via `funcs.call(entry.id)`.

## Definindo Testes

Registre funções de teste em `_index.yaml` com `meta.type = "test"`:

```yaml
version: "1.0"
namespace: app.test.errors

entries:
  - name: new
    kind: function.lua
    meta:
      type: test
      suite: errors
      description: errors.new creates structured errors
    source: file://new.lua
    method: main
    imports:
      assert2: app.lib:assert
```

**Campos de metadados:**

- `meta.type`: Deve ser `"test"` para descoberta de testes
- `meta.suite`: Agrupa testes relacionados (ex: "errors", "json")
- `meta.order`: Ordem de execução dentro da suite (padrão: 0)
- `meta.description`: Descrição do teste (exibida na saída)

## Escrevendo Funções de Teste

Funções de teste devem retornar `true` em caso de sucesso ou lançar um erro em caso de falha:

```lua
-- tests/test/errors/new.lua
local assert = require("assert2")

local function main()
    local e1 = errors.new("simple error")
    assert.ok(e1, "errors.new returns error")
    assert.eq(e1:message(), "simple error", "message matches")
    assert.eq(e1:kind(), "", "default kind is empty")
    assert.is_nil(e1:retryable(), "default retryable is nil")

    local e2 = errors.new({
        message = "not found",
        kind = errors.NOT_FOUND,
        retryable = false,
        details = {resource = "user", id = 123}
    })
    assert.eq(e2:message(), "not found", "message from table")
    assert.eq(e2:kind(), errors.NOT_FOUND, "kind from table")

    local d = e2:details()
    assert.eq(d.resource, "user", "details.resource")
    assert.eq(d.id, 123, "details.id")

    return true
end

return { main = main }
```

## Biblioteca de Assertions

Crie um módulo de assertions reutilizável em `tests/lib/assert.lua`:

```lua
local M = {}

function M.eq(actual: any, expected: any, msg: string?)
    if actual ~= expected then
        error((msg or "assertion failed") .. ": expected " .. tostring(expected) .. ", got " .. tostring(actual), 2)
    end
end

function M.neq(actual: any, expected: any, msg: string?)
    if actual == expected then
        error((msg or "assertion failed") .. ": expected not " .. tostring(expected), 2)
    end
end

function M.ok(val: any?, msg: string?): asserts val
    if not val then
        error((msg or "assertion failed") .. ": expected truthy value", 2)
    end
end

function M.fail(msg)
    error(msg or "assertion failed", 2)
end

function M.is_nil(val, msg)
    if val ~= nil then
        error((msg or "assertion failed") .. ": expected nil, got " .. tostring(val), 2)
    end
end

function M.not_nil(val: any?, msg: string?): asserts val
    if val == nil then
        error((msg or "assertion failed") .. ": expected non-nil value", 2)
    end
end

function M.is_string(val: any, msg: string?): asserts val is string
    if type(val) ~= "string" then
        error((msg or "assertion failed") .. ": expected string, got " .. type(val), 2)
    end
end

function M.is_number(val: any, msg: string?): asserts val is number
    if type(val) ~= "number" then
        error((msg or "assertion failed") .. ": expected number, got " .. type(val), 2)
    end
end

function M.is_table(val: any, msg: string?)
    if type(val) ~= "table" then
        error((msg or "assertion failed") .. ": expected table, got " .. type(val), 2)
    end
end

function M.is_boolean(val: any, msg: string?): asserts val is boolean
    if type(val) ~= "boolean" then
        error((msg or "assertion failed") .. ": expected boolean, got " .. type(val), 2)
    end
end

function M.contains(str, substr, msg)
    if type(str) ~= "string" or not string.find(str, substr, 1, true) then
        error((msg or "assertion failed") .. ": expected string to contain '" .. tostring(substr) .. "'", 2)
    end
end

function M.has_error(val, err, msg)
    if val ~= nil then
        error((msg or "has_error failed") .. ": expected nil result, got " .. tostring(val), 2)
    end
    if err == nil then
        error((msg or "has_error failed") .. ": expected error, got nil", 2)
    end
end

function M.no_error(val, err, msg)
    if err ~= nil then
        error((msg or "no_error failed") .. ": unexpected error: " .. tostring(err), 2)
    end
end

function M.throws(fn, msg)
    local ok, err = pcall(fn)
    if ok then
        error((msg or "throws failed") .. ": expected function to throw", 2)
    end
    return err
end

function M.not_throws(fn, msg)
    local ok, err = pcall(fn)
    if not ok then
        error((msg or "not_throws failed") .. ": unexpected error: " .. tostring(err), 2)
    end
end

-- Assertions de estrutura de erros
function M.error_kind(err, expected_kind, msg)
    if err == nil then
        error((msg or "error_kind failed") .. ": error is nil", 2)
    end
    if type(err) ~= "table" then
        error((msg or "error_kind failed") .. ": error is not structured (got " .. type(err) .. ")", 2)
    end
    if err.kind ~= expected_kind then
        error((msg or "error_kind failed") .. ": expected kind '" .. tostring(expected_kind) .. "', got '" .. tostring(err.kind) .. "'", 2)
    end
end

function M.error_message(err, expected_msg, msg)
    if err == nil then
        error((msg or "error_message failed") .. ": error is nil", 2)
    end
    local actual_msg = type(err) == "table" and err.message or tostring(err)
    if actual_msg ~= expected_msg then
        error((msg or "error_message failed") .. ": expected message '" .. tostring(expected_msg) .. "', got '" .. tostring(actual_msg) .. "'", 2)
    end
end

function M.error_contains(err, substr, msg)
    if err == nil then
        error((msg or "error_contains failed") .. ": error is nil", 2)
    end
    local actual_msg = type(err) == "table" and err.message or tostring(err)
    if not string.find(actual_msg, substr, 1, true) then
        error((msg or "error_contains failed") .. ": expected error to contain '" .. tostring(substr) .. "', got '" .. tostring(actual_msg) .. "'", 2)
    end
end

return M
```

Registre a biblioteca de assertions:

```yaml
# tests/lib/_index.yaml
version: "1.0"
namespace: app.lib

entries:
  - name: assert
    kind: function.lua
    source: file://assert.lua
```

## Testando Tratamento de Erros

Funções Wippy retornam pares `(result, error)`. Teste tanto caminhos de sucesso quanto de erro:

```lua
local assert = require("assert2")

local function main()
    -- Testar caminho de sucesso
    local t, err = time.parse("2006-01-02 15:04:05", "2024-12-29 15:04:05")
    assert.is_nil(err, "parse succeeds")
    assert.not_nil(t, "parse returns time")
    assert.eq(t:year(), 2024, "parsed year")

    -- Testar caminho de erro
    local bad_t, bad_err = time.parse("2006-01-02", "invalid-date")
    assert.is_nil(bad_t, "invalid parse returns nil")
    assert.not_nil(bad_err, "invalid parse returns error")

    return true
end

return { main = main }
```

**Assertions de padrão de erro:**

```lua
local function main()
    -- Verificar tipo de erro
    local user, err = fetch_user(-1)
    assert.is_nil(user, "no user on error")
    assert.eq(err:kind(), errors.INVALID, "INVALID kind")
    assert.eq(err:retryable(), false, "not retryable")

    -- Verificar se mensagem de erro contém texto
    local _, compress_err = compress.gzip.encode("")
    assert.not_nil(compress_err, "error returned")
    assert.contains(tostring(compress_err), "empty", "error mentions empty")

    -- Verificar se função lança exceção
    assert.throws(function()
        error("something went wrong")
    end, "should throw")

    return true
end
```

## Suites de Teste

Agrupe testes relacionados usando `meta.suite`:

```yaml
version: "1.0"
namespace: app.test.channel

entries:
  - name: basic
    kind: function.lua
    meta:
      type: test
      suite: channel
      order: 1
    source: file://basic.lua
    method: main
    imports:
      assert2: app.lib:assert

  - name: buffered
    kind: function.lua
    meta:
      type: test
      suite: channel
      order: 2
    source: file://buffered.lua
    method: main
    imports:
      assert2: app.lib:assert

  - name: close
    kind: function.lua
    meta:
      type: test
      suite: channel
      order: 3
    source: file://close.lua
    method: main
    imports:
      assert2: app.lib:assert
```

Testes na mesma suite são agrupados na saída e podem ser ordenados com `meta.order`.

## Implementação do Executor de Testes

O executor de testes é um processo que descobre e executa testes:

```yaml
# src/_index.yaml
entries:
  - name: test_runner
    kind: process.lua
    meta:
      comment: Runs all tests with meta.type=test
    source: file://runner.lua
    method: main
    modules:
      - io
      - registry
      - funcs
      - time
```

Implementação básica do executor:

```lua
-- runner.lua
local io = require("io")
local registry = require("registry")
local funcs = require("funcs")
local time = require("time")

local function run_test(entry)
    local ok, result, err = pcall(function()
        return funcs.call(entry.id)
    end)

    if not ok then
        return false, result
    elseif err then
        return false, err
    elseif result == false then
        return false, "test returned false"
    else
        return true, nil
    end
end

local function main()
    local args = io.args()

    io.print("Running Tests")
    io.print("")

    -- Encontrar todos os testes
    local entries, err = registry.find({["meta.type"] = "test"})
    if err then
        io.eprint("Error: " .. tostring(err))
        return 1
    end

    if not entries or #entries == 0 then
        io.print("No tests found")
        return 0
    end

    -- Filtrar por padrões
    if #args > 0 then
        local filtered = {}
        for _, entry in ipairs(entries) do
            for _, pattern in ipairs(args) do
                if entry.id:find(pattern, 1, true) then
                    table.insert(filtered, entry)
                    break
                end
            end
        end
        entries = filtered
    end

    local passed = 0
    local failed = 0
    local failures = {}
    local start = time.now()

    -- Executar testes
    for _, entry in ipairs(entries) do
        local name = entry.id:match(":([^:]+)$") or entry.id
        io.write("  " .. name .. " ... ")

        local ok, err_obj = run_test(entry)

        if ok then
            io.print("ok")
            passed = passed + 1
        else
            io.print("FAILED")
            failed = failed + 1
            table.insert(failures, {id = entry.id, error = err_obj})
        end
    end

    local elapsed = time.now():sub(start):milliseconds()

    -- Imprimir falhas
    if #failures > 0 then
        io.print("")
        io.print("Failures:")
        for _, f in ipairs(failures) do
            io.print("")
            io.print("  " .. f.id)
            io.print("  " .. tostring(f.error))
        end
    end

    -- Resumo
    io.print("")
    if failed > 0 then
        io.print("FAILED: " .. passed .. " passed, " .. failed .. " failed  " .. elapsed .. "ms")
        return 1
    else
        io.print("PASSED: " .. passed .. " tests  " .. elapsed .. "ms")
        return 0
    end
end

return { main = main }
```

O executor de testes real em `/home/wolfy-j/projects/wippy/tests/app/src/runner.lua` inclui:

- Agrupamento e ordenação de suites
- Exibição de progresso ao vivo com spinners
- Barras de progresso
- Lógica de retry para corridas de registro de pool
- Saída colorida
- Relatórios detalhados de falhas

## Executando Testes

Executar todos os testes:

```bash
wippy run app:test_runner app:terminal
```

Filtrar testes por padrão:

```bash
# Executar testes contendo "errors"
wippy run app:test_runner app:terminal -- errors

# Executar testes contendo "channel" ou "time"
wippy run app:test_runner app:terminal -- channel time
```

O executor faz match de padrões contra IDs de entrada de teste usando `entry.id:find(pattern, 1, true)`.

## Exemplo de Saída de Teste

```
  Running Tests

  12 tests in 3 suites

  ● errors (9) 9/9  15ms
  ● channel (8) 8/8  23ms
  ● time (6) 5/6  12ms
      ✗ parse_invalid

  Failures

    app.test.time:parse_invalid
    assertion failed: expected error, got nil

  FAILED  [████████████████████░]

  22 passed  1 failed  50ms
```

## Padrões de Teste

**Operações de channel:**

```lua
local function main()
    local ch = channel.new(1)
    ch:send("hello")
    local val, ok = ch:receive()
    assert.eq(val, "hello", "received correct value")
    assert.eq(ok, true, "receive ok is true")
    return true
end
```

**Chamadas de função:**

```lua
local function main()
    local result, err = funcs.call("app.test.funcs:echo", "test input")
    assert.is_nil(err, "call echo no error")
    assert.eq(result.ok, true, "echo result ok")
    assert.eq(result.echo, "test input", "echo result has input")
    return true
end
```

**Consultas de registro:**

```lua
local function main()
    local entries, err = registry.find({kind = "function.lua"})
    assert.is_nil(err, "find by kind no error")
    assert.not_nil(entries, "find returns entries")
    assert.ok(#entries > 0, "find has results")

    for _, entry in ipairs(entries) do
        assert.not_nil(entry.id, "entry has id")
        assert.eq(type(entry.id), "string", "id is string")
    end

    return true
end
```

## Estrutura do Projeto

```
myapp/
├── tests/
│   ├── lib/
│   │   ├── _index.yaml        # Registro da biblioteca assert
│   │   └── assert.lua         # Funções de assertion
│   ├── test/
│   │   ├── errors/
│   │   │   ├── _index.yaml    # Metadados dos testes de erro
│   │   │   ├── new.lua        # Testar criação de erros
│   │   │   ├── patterns.lua   # Testar padrões de erro
│   │   │   └── wrap.lua       # Testar wrapping de erros
│   │   ├── channel/
│   │   │   ├── _index.yaml    # Metadados dos testes de channel
│   │   │   ├── basic.lua      # Testar operações básicas
│   │   │   └── buffered.lua   # Testar channels com buffer
│   │   └── ...
│   ├── _index.yaml            # Registro do executor de testes
│   └── runner.lua             # Implementação do executor de testes
└── src/
    └── ...                     # Código da aplicação
```

## Pontos-Chave

1. Testes são descobertos via `meta.type = "test"` nas entradas do registro
2. Funções de teste devem retornar `true` ou lançar erros
3. Use `meta.suite` para agrupar testes relacionados
4. Use `meta.order` para controlar ordem de execução dentro de suites
5. Teste tanto caminhos de sucesso quanto de erro com padrões de retorno `(result, error)`
6. Filtre testes passando padrões como argumentos de linha de comando
7. O executor de testes usa `registry.find()` e `funcs.call()` para executar testes

## Próximos Passos

- [Error Handling](lua-errors.md) - Padrões de erro e assertions
- [Registry](lua-registry.md) - Consultas e filtragem de registro
- [Functions](concept-functions.md) - Chamadas e execução de funções
