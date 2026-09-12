---
title: "Framework de pruebas"
description: "Define y ejecuta pruebas Wippy con suites BDD, aserciones, ganchos del ciclo de vida, simulaciones y funciones de prueba simples."
---

# Framework de pruebas :id=framework-de-testing

El módulo `wippy/test` proporciona suites BDD, aserciones, ganchos del ciclo de vida, simulaciones y un ejecutor para entradas de prueba.

Esta página es una introducción a la API. Sus bloques de Lua, YAML, salida y estructura de proyecto son fragmentos de referencia que se pueden combinar en un proyecto Wippy existente; no forman un único proyecto listo para copiar y ejecutar. Nombres como `validate`, `format_name`, `db`, `connect` y `notify_user` representan funciones o módulos de aplicación proporcionados por el objeto de la prueba. Para un ejemplo ejecutable completo, siga [Probar una aplicación Wippy](../tutorials/testing.md).

## Configuracion

Agrega la dependencia:

```bash
wippy add wippy/test
wippy install
```

El módulo registra automáticamente el punto de entrada de pruebas (un comando con `use_case: test`). Una vez instalado, `wippy test` descubre y ejecuta todas las entradas de prueba del proyecto.

## Definir pruebas :id=definir-tests

Las pruebas son entradas `function.lua` con `meta.type: test`:

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

### Metadatos de la prueba :id=metadatos-del-test

| Campo | Obligatorio | Descripción |
|-------|----------|-------------|
| `type` | Sí | Debe ser `"test"` para que el ejecutor lo descubra |
| `suite` | No | Agrupa pruebas en la salida del ejecutor |
| `name` | No | Nombre mostrado en la salida del ejecutor |
| `order` | No | Orden dentro de una suite (menor se ejecuta primero) |

## Escribir pruebas :id=escribir-tests

### Estilo BDD

Use bloques `describe` e `it` para estructurar las pruebas:

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

### Omitir pruebas :id=omitir-tests

```lua
test.it_skip("not implemented yet", function()
    test.fail("TODO")
end)
```

Las pruebas omitidas aparecen en la salida pero no cuentan como fallos.

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

### Cadenas y colecciones :id=strings-y-colecciones

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

## Ganchos del ciclo de vida :id=hooks-de-ciclo-de-vida

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

Los ganchos de las suites anidadas se ejecutan en orden: el `before_each` del padre se ejecuta antes del `before_each` del hijo, y el `after_each` del hijo se ejecuta antes del `after_each` del padre.

## Simulación :id=mocking

El sistema de simulación reemplaza campos de objetos globales y los restaura automáticamente después de cada prueba.

### Simulación básica :id=mocking-basico

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

### API de simulación :id=api-de-mock

```lua
test.mock("object.field", replacement)    -- replace a global field
test.mock_process("field", replacement)   -- shorthand for process fields
test.restore_mock("object.field")         -- restore one mock
test.restore_all_mocks()                  -- restore all mocks
```

Las rutas de simulación usan notación de punto: `"process.send"` reemplaza `_G.process.send`.

Las simulaciones de `process.send` redirigen automáticamente los mensajes del framework de pruebas a través de la función original, para que el informe de eventos de prueba siga funcionando cuando `process.send` está simulado.

Todas las simulaciones se restauran automáticamente después de cada prueba mediante el gancho `after_each`.

## Ejecutar pruebas :id=ejecutar-tests

### Ejecutar todas las pruebas :id=ejecutar-todos-los-tests

```bash
wippy test
```

### Filtrar por Patron

```bash
wippy test math
wippy test user validation
```

Los filtros comparan substrings literales de los ID de entrada. Con varios patrones, una entrada se ejecuta si su ID coincide con cualquiera de ellos.

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

## Pruebas simples :id=tests-simples

Para pruebas que no necesitan el framework BDD, defina una función simple que devuelva `true` o genere un error:

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

El ejecutor detecta si una prueba usa eventos de casos BDD o devuelve un valor simple. Ambos patrones funcionan con `wippy test`.

## Estructura del Proyecto

Una estructura típica de pruebas:

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

El `_index.yaml` de pruebas define el espacio de nombres y las entradas de prueba:

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

## Host de terminal :id=terminal-host

`wippy/test` depende de `wippy/terminal`, que proporciona el `wippy.terminal:host` de inicio automático usado por el ejecutor de la CLI. Las aplicaciones no necesitan declarar otro host de procesos o de terminal solo para ejecutar `wippy test`.

## Ver Tambien

- [Descripción general del framework](framework/overview.md) — Instalar e importar módulos del framework
- [Referencia de la CLI](guides/cli.md) — Comando e indicadores de prueba
- [Funciones](concepts/functions.md) — Entradas de función e invocación
