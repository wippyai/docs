# Testing

Escriba y ejecute tests para sus aplicaciones Wippy usando el framework de testing integrado.

## Descubrimiento de Tests

Los tests se descubren por metadatos. El test runner encuentra todas las entradas de registro con `meta.type = "test"` y las ejecuta.

```bash
wippy run app:test_runner app:terminal
```

El runner usa `registry.find({["meta.type"] = "test"})` para localizar tests y los llama vía `funcs.call(entry.id)`.

## Definir Tests

Registre funciones de test en `_index.yaml` con `meta.type = "test"`:

```yaml
version: "1.0"
namespace: app.test.errors

entries:
  - name: new
    kind: function.lua
    meta:
      type: test
      suite: errors
      description: errors.new crea errores estructurados
    source: file://new.lua
    method: main
    imports:
      assert2: app.lib:assert
```

**Campos de metadatos:**

- `meta.type`: Debe ser `"test"` para descubrimiento de tests
- `meta.suite`: Agrupa tests relacionados (ej. "errors", "json")
- `meta.order`: Orden de ejecución dentro del suite (por defecto: 0)
- `meta.description`: Descripción del test (mostrada en salida)

## Escribir Funciones de Test

Las funciones de test deben retornar `true` en éxito o lanzar un error en fallo:

```lua
-- tests/test/errors/new.lua
local assert = require("assert2")

local function main()
    local e1 = errors.new("simple error")
    assert.ok(e1, "errors.new retorna error")
    assert.eq(e1:message(), "simple error", "message coincide")
    assert.eq(e1:kind(), "", "kind por defecto es vacío")
    assert.is_nil(e1:retryable(), "retryable por defecto es nil")

    local e2 = errors.new({
        message = "not found",
        kind = errors.NOT_FOUND,
        retryable = false,
        details = {resource = "user", id = 123}
    })
    assert.eq(e2:message(), "not found", "message desde tabla")
    assert.eq(e2:kind(), errors.NOT_FOUND, "kind desde tabla")

    local d = e2:details()
    assert.eq(d.resource, "user", "details.resource")
    assert.eq(d.id, 123, "details.id")

    return true
end

return { main = main }
```

## Librería de Assertions

Cree un módulo de assertion reutilizable en `tests/lib/assert.lua`:

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

return M
```

Registre la librería de assertion:

```yaml
# tests/lib/_index.yaml
version: "1.0"
namespace: app.lib

entries:
  - name: assert
    kind: function.lua
    source: file://assert.lua
```

## Testeando Manejo de Errores

Las funciones Wippy retornan pares `(result, error)`. Testee tanto caminos de éxito como de error:

```lua
local assert = require("assert2")

local function main()
    -- Testear camino de éxito
    local t, err = time.parse("2006-01-02 15:04:05", "2024-12-29 15:04:05")
    assert.is_nil(err, "parse exitoso")
    assert.not_nil(t, "parse retorna time")
    assert.eq(t:year(), 2024, "año parseado")

    -- Testear camino de error
    local bad_t, bad_err = time.parse("2006-01-02", "invalid-date")
    assert.is_nil(bad_t, "parse inválido retorna nil")
    assert.not_nil(bad_err, "parse inválido retorna error")

    return true
end

return { main = main }
```

## Test Suites

Agrupe tests relacionados usando `meta.suite`:

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

Los tests en el mismo suite se agrupan en la salida y pueden ordenarse con `meta.order`.

## Ejecutar Tests

Ejecutar todos los tests:

```bash
wippy run app:test_runner app:terminal
```

Filtrar tests por patrón:

```bash
# Ejecutar tests que contienen "errors"
wippy run app:test_runner app:terminal -- errors

# Ejecutar tests que contienen "channel" o "time"
wippy run app:test_runner app:terminal -- channel time
```

## Ejemplo de Salida de Test

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

## Puntos Clave

1. Los tests se descubren vía `meta.type = "test"` en entradas de registro
2. Las funciones de test deben retornar `true` o lanzar errores
3. Use `meta.suite` para agrupar tests relacionados
4. Use `meta.order` para controlar orden de ejecución dentro de suites
5. Testee tanto caminos de éxito como de error con patrones de retorno `(result, error)`
6. Filtre tests pasando patrones como argumentos de línea de comandos
7. El test runner usa `registry.find()` y `funcs.call()` para ejecutar tests

## Siguientes Pasos

- [Manejo de Errores](lua/core/errors.md) - Patrones de error y assertions
- [Registry](lua/core/registry.md) - Consultas y filtrado de registry
- [Funciones](concepts/functions.md) - Llamadas y ejecución de funciones
