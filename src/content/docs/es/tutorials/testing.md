---
title: "Testing"
---

# Testing

Escribe y ejecuta tests para tu código Lua con el framework `wippy/test` — un
runner de estilo BDD con aserciones, hooks de ciclo de vida y mocking, ejecutado por
el comando `wippy run test`.

## Lo que construirás

Una pequeña biblioteca y una suite de tests que la cubre:

1. Una biblioteca `calc` con las funciones `add` y `div`.
2. Una entrada de test que describe casos, asevera el comportamiento y omite un caso pendiente.
3. Una ejecución de tests en verde vía `wippy run test`.

## Requisitos previos

- Un proyecto Wippy (clona [app-template](https://github.com/wippyai/app-template), o
  `wippy init` en un directorio vacío).
- El framework de testing y un host de terminal instalados:

  ```bash
  wippy add wippy/test
  wippy add wippy/terminal
  wippy install
  ```

  El runner renderiza una UI de terminal en vivo, por lo que se requiere `wippy/terminal`
  junto con `wippy/test`.

## El código bajo prueba

```lua
-- src/calc.lua
local function add(a, b)
    return a + b
end

local function div(a, b)
    if b == 0 then
        return nil, "division by zero"
    end
    return a / b
end

return { add = add, div = div }
```

## El test

Un test es una entrada `function.lua` ordinaria etiquetada con `meta.type: test`. Su método
retorna el valor producido por `test.run_cases(...)`, que el runner invoca:

```lua
-- src/calc_test.lua
local test = require("test")
local calc = require("calc")

local function define_tests()
    test.describe("calculator", function()
        local started = false

        test.before_all(function()
            started = true
        end)

        test.it("setup ran", function()
            test.is_true(started)
        end)

        test.it("adds numbers", function()
            test.eq(calc.add(2, 3), 5)
        end)

        test.it("returns error on divide by zero", function()
            local result, err = calc.div(1, 0)
            test.has_error(result, err)
            test.contains(err, "division by zero")
        end)

        test.it_skip("not implemented yet", function()
            test.fail("should not run")
        end)
    end)
end

return { run = test.run_cases(define_tests) }
```

Registra ambas entradas. El descubrimiento se basa en `meta.type: test`; `meta.suite` agrupa
los resultados en la salida:

```yaml
version: "1.0"
namespace: app

entries:
  - name: calc
    kind: library.lua
    source: file://calc.lua

  - name: calc_test
    kind: function.lua
    meta:
      name: Calculator Test
      type: test
      suite: calculator
    source: file://calc_test.lua
    method: run
    imports:
      test: wippy.test:test
      calc: app:calc
```

El mapa `imports` controla a qué resuelve `require(...)` dentro del test: `test`
vincula el framework, `calc` vincula la unidad bajo prueba.

## Ejecutarlo

```bash
wippy run test
```

Filtra a una sola suite (coincide con el id de la entrada o el nombre de la suite) mientras iteras:

```bash
wippy run test calculator
```

Salida para la suite anterior:

```
  calculator (4)  3/4  1 skipped  1ms
    o setup ran
    o adds numbers
    o returns error on divide by zero
    - not implemented yet (skipped)

  PASSED   3 tests   1 skipped   1ms
```

`wippy run test` sale con `0` cuando todos los casos pasan y con `1` ante cualquier fallo, por lo que
encaja directamente en CI.

## Aserciones

Cada aserción lanza un error en caso de fallo; los type guards también retornan el valor validado.

| Aserción | Comprueba |
|---|---|
| `test.eq(a, b)` / `test.neq(a, b)` | Igualdad / desigualdad |
| `test.ok(v)` / `test.fail(msg)` | Valor verdadero / forzar un fallo |
| `test.is_nil(v)` / `test.not_nil(v)` | Nil / no nil |
| `test.is_true(v)` / `test.is_false(v)` | Valor booleano |
| `test.is_string/number/table/function/boolean(v)` | Type guards (retornan `v`) |
| `test.contains(str, sub)` / `test.matches(str, pattern)` | Subcadena / patrón Lua |
| `test.has_key(tbl, key)` / `test.len(v, n)` | Clave de mapa / longitud |
| `test.gt/gte/lt/lte(a, b)` | Comparación numérica |
| `test.throws(fn)` / `test.has_error(val, err)` / `test.no_error(val, err)` | Manejo de errores |

Todas aceptan un argumento de mensaje opcional al final.

## Ciclo de vida y mocking

Llama a estas dentro de un bloque `describe`:

- `test.before_all` / `test.after_all` — se ejecutan una vez por bloque.
- `test.before_each` / `test.after_each` — se ejecutan alrededor de cada caso.
- `test.mock("module.field", fn)` — reemplaza una función para el caso actual;
  los mocks se restauran automáticamente después de cada caso. Usa `test.restore_all_mocks()` para
  limpiarlos antes.

Los bloques `describe` anidados heredan los hooks del padre (primero el `before_*` externo, primero el
`after_*` interno).

## Siguientes Pasos

- [Hello World](tutorials/hello-world.md) — la disposición mínima de un proyecto
- [Entry Kinds](guides/entry-kinds.md) — `function.lua`, `library.lua` y similares
- [Test Framework](framework/testing.md) — referencia completa del runner y el protocolo de eventos
