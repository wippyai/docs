---
title: "Pruebas"
description: "Escribe y ejecuta pruebas Lua con aserciones, hooks de ciclo de vida, mocks, filtros y códigos de salida de wippy/test."
---

# Pruebas

Usa el framework `wippy/test` para definir casos de prueba Lua con aserciones,
hooks de ciclo de vida y mocks, y ejecútalos con `wippy test`.

**Clasificación:** Tutorial ejecutable. Contiene una biblioteca completa, una
entrada de prueba, la instalación de dependencias, la salida esperada del runner
y comprobaciones de fallos.

## Lo que construirás

Una pequeña biblioteca y una suite de tests que la cubre:

1. Una biblioteca `calc` con las funciones `add` y `div`.
2. Una entrada de prueba que describe casos, comprueba el comportamiento y omite un caso pendiente.
3. Una ejecución correcta de las pruebas con `wippy test`.

## Requisitos previos

- El runtime Wippy `v0.3.32a`.
- Un directorio de trabajo vacío. Crea e inicializa el proyecto e instala el
  framework de pruebas:

  ```bash
  mkdir testing-demo
  cd testing-demo
  mkdir src
  wippy init
  wippy add wippy/test
  wippy install
  ```

  El framework de pruebas declara `wippy/terminal` como dependencia, por lo que
  la instalación incluye el host de terminal que utiliza la UI en vivo del runner.

El proyecto terminado contiene:

```text
testing-demo/
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── calc.lua
    └── calc_test.lua
```

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

Una prueba es una entrada `function.lua` ordinaria etiquetada con `meta.type: test`.
Su método devuelve el valor producido por `test.run_cases(...)`, que invoca el runner:

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

Registra ambas entradas. El descubrimiento se basa en `meta.type: test`; `meta.suite`
agrupa los resultados en la salida:

```yaml
# src/_index.yaml
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

El mapa `imports` controla a qué resuelve `require(...)` dentro de la prueba: `test`
vincula el framework y `calc`, la unidad que se prueba.

## Ejecutarlo

```bash
wippy test
```

Mientras iteras, filtra por una subcadena del identificador de la entrada
(namespace:name):

```bash
wippy test test calc_test
```

El primer `test` selecciona el punto de entrada del runner del framework. Los
argumentos restantes son filtros por subcadena que se aplican a los identificadores
de las entradas de prueba.

Salida esperada para la suite:

```
    o setup ran <duration>
    o adds numbers <duration>
    o returns error on divide by zero <duration>
    - not implemented yet (skipped)
  o calculator (4) 3/4 1 skipped <duration>

  PASSED
  3 tests  1 skipped  <duration>
```

El renderer en vivo muestra cada caso antes del resumen de la suite; los tiempos
varían en cada ejecución.

`wippy test` termina con `0` cuando todos los casos pasan y con `1` cuando alguno
falla, lo que permite usar su estado de salida en CI.

Para comprobar la ruta de fallo, cambia temporalmente la suma esperada de `5` a
`6`. El runner debe mostrar `FAILED` y terminar con el estado 1. Restaura `5`
antes de continuar.

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

## Solución de problemas

- `No test runner found` significa que `wippy/test` no figura en `wippy.lock`;
  ejecuta `wippy add wippy/test` y después `wippy install`.
- Si falta el módulo `calc` o `test`, las claves de `imports` no coinciden con las
  llamadas `require(...)` correspondientes.
- Un archivo de prueba no se descubre salvo que su entrada tenga `meta.type: test`.
- Los tiempos y glifos de terminal varían según el terminal. Para automatizar,
  usa el estado final y el código de salida del proceso.

## Limpieza

Después de salir del directorio `testing-demo`, elimínalo cuando ya no necesites
el proyecto desechable.

## Siguientes pasos

- [Hello World](hello-world.md) — Disposición mínima de un proyecto
- [Tipos de entrada](../guides/entry-kinds.md) — `function.lua`, `library.lua` y entradas relacionadas
- [Framework de pruebas](../framework/testing.md) — Referencia del runner y del protocolo de eventos
