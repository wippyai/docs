---
title: "Testes"
description: "Escreva e execute testes para seu código Lua com o framework wippy/test — um runner estilo BDD com asserções, hooks de ciclo de vida e mocking,…"
---

# Testes

Escreva e execute testes para seu código Lua com o framework `wippy/test` — um runner
estilo BDD com asserções, hooks de ciclo de vida e mocking, executado pelo comando
`wippy run test`.

## O que você construirá

Uma pequena biblioteca e uma suíte de testes que a cobre:

1. Uma biblioteca `calc` com as funções `add` e `div`.
2. Uma entrada de teste que descreve casos, verifica comportamento e pula um caso pendente.
3. Uma execução de teste verde via `wippy run test`.

## Pré-requisitos

- Um projeto Wippy (clone o [app-template](https://github.com/wippyai/app-template), ou
  `wippy init` em um diretório vazio).
- O framework de testes e um host de terminal instalados:

  ```bash
  wippy add wippy/test
  wippy add wippy/terminal
  wippy install
  ```

  O runner renderiza uma UI de terminal ao vivo, então `wippy/terminal` é necessário
  junto com `wippy/test`.

## O código sob teste

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

## O teste

Um teste é uma entrada `function.lua` comum marcada com `meta.type: test`. Seu método
retorna o valor produzido por `test.run_cases(...)`, que o runner invoca:

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

Registre ambas as entradas. A descoberta se baseia em `meta.type: test`; `meta.suite`
agrupa os resultados na saída:

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

O mapa `imports` controla o que `require(...)` resolve dentro do teste: `test` vincula
o framework, `calc` vincula a unidade sob teste.

## Execute

```bash
wippy run test
```

Filtre para uma única suíte (corresponde ao id da entrada ou ao nome da suíte) enquanto
itera:

```bash
wippy run test calculator
```

Saída para a suíte acima:

```
  calculator (4)  3/4  1 skipped  1ms
    o setup ran
    o adds numbers
    o returns error on divide by zero
    - not implemented yet (skipped)

  PASSED   3 tests   1 skipped   1ms
```

`wippy run test` sai com `0` quando todos os casos passam e `1` em qualquer falha, então
ele se encaixa diretamente em CI.

## Asserções

Cada asserção lança erro em caso de falha; os type guards também retornam o valor validado.

| Asserção | Verifica |
|---|---|
| `test.eq(a, b)` / `test.neq(a, b)` | Igualdade / desigualdade |
| `test.ok(v)` / `test.fail(msg)` | Truthy / força uma falha |
| `test.is_nil(v)` / `test.not_nil(v)` | Nil / não-nil |
| `test.is_true(v)` / `test.is_false(v)` | Valor booleano |
| `test.is_string/number/table/function/boolean(v)` | Type guards (retornam `v`) |
| `test.contains(str, sub)` / `test.matches(str, pattern)` | Substring / padrão Lua |
| `test.has_key(tbl, key)` / `test.len(v, n)` | Chave de mapa / comprimento |
| `test.gt/gte/lt/lte(a, b)` | Comparação numérica |
| `test.throws(fn)` / `test.has_error(val, err)` / `test.no_error(val, err)` | Tratamento de erros |

Todas aceitam um argumento de mensagem opcional ao final.

## Ciclo de vida e mocking

Chame estes dentro de um bloco `describe`:

- `test.before_all` / `test.after_all` — executam uma vez por bloco.
- `test.before_each` / `test.after_each` — executam ao redor de cada caso.
- `test.mock("module.field", fn)` — substitui uma função para o caso atual; os mocks
  são restaurados automaticamente após cada caso. Use `test.restore_all_mocks()` para
  limpá-los antecipadamente.

Blocos `describe` aninhados herdam os hooks do pai (o `before_*` externo primeiro, o
`after_*` interno primeiro).

## Próximos Passos

- [Hello World](tutorials/hello-world.md) — o layout mínimo de projeto
- [Entry Kinds](guides/entry-kinds.md) — `function.lua`, `library.lua` e companhia
- [Test Framework](framework/testing.md) — referência completa do runner e do protocolo de eventos
