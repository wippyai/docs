# Framework de Testing

El modulo `wippy/test` proporciona un framework de testing estilo BDD con aserciones, hooks de ciclo de vida y mocking.

## Configuracion

Agrega la dependencia:

```bash
wippy add wippy/test
wippy install
```

El modulo registra un comando `test` automaticamente. Una vez instalado, `wippy run test` descubre y ejecuta todas las entradas de test en tu proyecto.

## Definir Tests

Los tests son entradas `function.lua` con `meta.type: test`:

```yaml
version: "1.0"
namespace: app.test

entries:
  - name: math
    kind: function.lua
    meta:
      type: test
      suite: math
      description: Math operations
    source: file://math_test.lua
    method: run
    imports:
      test: wippy.test:test
```

### Metadatos del Test

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Debe ser `"test"` para que el runner lo descubra |
| `suite` | No | Agrupa tests en la salida del runner |
| `description` | No | Descripcion legible |
| `order` | No | Orden dentro de una suite (menor se ejecuta primero) |

## Escribir Tests

### Estilo BDD

Usa bloques `describe` e `it` para estructurar tests:

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

### Suites Anidadas

Las suites pueden anidarse para organizacion:

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

### Omitir Tests

```lua
test.it_skip("not implemented yet", function()
    test.fail("TODO")
end)
```

Los tests omitidos aparecen en la salida pero no cuentan como fallos.

### Alias de Suites

`test.spec` y `test.context` son alias de `test.describe`:

```lua
test.spec("feature", function()
    test.context("when valid input", function()
        test.it("succeeds", function()
            test.ok(true)
        end)
    end)
end)
```

## Aserciones

### Igualdad

```lua
test.eq(actual, expected, msg?)       -- actual == expected
test.neq(actual, expected, msg?)      -- actual ~= expected
```

### Veracidad

```lua
test.ok(val, msg?)                    -- val is truthy
test.fail(msg?)                       -- unconditional failure
```

### Verificaciones de Nil

```lua
test.is_nil(val, msg?)                -- val == nil
test.not_nil(val, msg?)               -- val ~= nil
```

### Verificaciones de Tipo

```lua
test.is_true(val, msg?)               -- val == true
test.is_false(val, msg?)              -- val == false
test.is_string(val, msg?)
test.is_number(val, msg?)
test.is_table(val, msg?)
test.is_function(val, msg?)
test.is_boolean(val, msg?)
```

### Strings y Colecciones

```lua
test.contains(str, substr, msg?)      -- substring match
test.matches(str, pattern, msg?)      -- Lua pattern match
test.has_key(tbl, key, msg?)          -- table key exists
test.len(val, expected, msg?)         -- #val == expected
```

### Comparaciones Numericas

```lua
test.gt(a, b, msg?)                   -- a > b
test.gte(a, b, msg?)                  -- a >= b
test.lt(a, b, msg?)                   -- a < b
test.lte(a, b, msg?)                  -- a <= b
```

### Manejo de Errores

```lua
test.throws(fn, msg?)                 -- fn() raises error, returns it
test.has_error(val, err, msg?)        -- val is nil, err is not nil
test.no_error(val, err, msg?)         -- err is nil
```

Todas las aserciones aceptan un mensaje opcional como ultimo argumento. En caso de fallo, el mensaje se incluye en la salida de error.

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

Los hooks en suites anidadas se ejecutan en orden: el `before_each` del padre se ejecuta antes del `before_each` del hijo, y el `after_each` del hijo se ejecuta antes del `after_each` del padre.

## Mocking

El sistema de mock reemplaza campos de objetos globales y los restaura automaticamente despues de cada test.

### Mocking Basico

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

Las rutas de mock usan notacion de punto: `"process.send"` reemplaza `_G.process.send`.

Los mocks para `process.send` redirigen automaticamente los mensajes del framework de testing a traves de la funcion original, para que el reporte de eventos de test continue funcionando cuando process.send esta mockeado.

Todos los mocks se restauran automaticamente despues de cada test mediante el hook `after_each`.

## Ejecutar Tests

### Ejecutar Todos los Tests

```bash
wippy run test
```

### Filtrar por Patron

```bash
wippy run test math
wippy run test user validation
```

Los filtros coinciden contra los IDs de las entradas. Multiples patrones se combinan.

### Ejemplo de Salida

```
3 tests in 1 suites

  calculator
    + adds numbers                           0ms
    + multiplies numbers                     0ms
    - divides by zero                        1ms
      Error: expected error, got nil

  1 suite | 2 passed | 1 failed | 0 skipped | 3ms
```

## Tests Simples

Para tests que no necesitan el framework BDD, define una funcion simple que retorne `true` o lance un error:

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

El runner detecta si un test usa eventos de casos BDD o retorna un valor simple. Ambos patrones funcionan con `wippy run test`.

## Estructura del Proyecto

Un layout tipico de tests:

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

El `_index.yaml` de tests define el namespace y las entradas de test:

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
    method: run
    imports:
      test: wippy.test:test

  - name: user
    kind: function.lua
    meta:
      type: test
      suite: user
    source: file://user_test.lua
    method: run
    imports:
      test: wippy.test:test
```

## Requisitos de Infraestructura

El runner de tests necesita un `process.host` y un `terminal.host` en tu aplicacion. Estos tipicamente ya estan presentes. Si no, agregalos:

```yaml
entries:
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true
```

## Ver Tambien

- [Descripcion General del Framework](framework/overview.md) - Uso de modulos del framework
- [Referencia CLI](guides/cli.md) - Comandos CLI
- [Funciones](concepts/functions.md) - Registro de funciones
