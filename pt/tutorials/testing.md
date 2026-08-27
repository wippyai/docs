---
title: "Testes"
description: "Escreva e execute testes Lua com asserções, hooks, mocks, filtros e códigos de saída do wippy/test."
---

# Testes

Use o framework `wippy/test` para definir casos Lua com asserções, hooks de ciclo de vida e mocks e executá-los com `wippy test`.

**Classificação:** tutorial executável. Ele contém uma biblioteca completa, entrada de teste, dependências, saída esperada e verificações de falha.

## O Que Você Criará

Uma pequena biblioteca e uma suite que a testa:

1. Uma biblioteca `calc` com funções `add` e `div`.
2. Uma entrada que descreve casos, verifica comportamento e ignora um caso pendente.
3. Uma execução bem-sucedida com `wippy test`.

## Pré-requisitos

- Runtime Wippy `v0.3.32a`.
- Um diretório vazio. Crie e inicialize o projeto e instale o framework:

  ```bash
  mkdir testing-demo
  cd testing-demo
  mkdir src
  wippy init
  wippy add wippy/test
  wippy install
  ```

  O framework declara `wippy/terminal` como dependência, portanto a instalação inclui o host usado pela UI ao vivo do runner.

O projeto concluído contém:

```text
testing-demo/
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── calc.lua
    └── calc_test.lua
```

## Código Testado

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

## O Teste

Um teste é uma entrada `function.lua` comum marcada com `meta.type: test`. Seu método retorna o valor produzido por `test.run_cases(...)`, invocado pelo runner:

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

Registre as duas entradas. A descoberta usa `meta.type: test`; `meta.suite` agrupa os resultados:

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

O mapa `imports` controla a resolução de `require(...)`: `test` vincula o framework e `calc`, a unidade testada.

## Executar

```bash
wippy test
```

Filtre por substring do ID da entrada durante a iteração:

```bash
wippy test test calc_test
```

O primeiro `test` escolhe o entrypoint do runner. Os argumentos restantes são filtros aplicados aos IDs das entradas.

Saída esperada:

```
    o setup ran <duration>
    o adds numbers <duration>
    o returns error on divide by zero <duration>
    - not implemented yet (skipped)
  o calculator (4) 3/4 1 skipped <duration>

  PASSED
  3 tests  1 skipped  <duration>
```

O renderer imprime cada caso antes do resumo; os tempos variam.

`wippy test` sai com `0` quando todos os casos passam e `1` quando algum falha, permitindo que a CI use o status do processo.

Para verificar a falha, altere temporariamente o resultado esperado de `5` para `6`. O runner deve imprimir `FAILED` e sair com status 1. Restaure `5` antes de continuar.

## Asserções

Cada asserção gera erro em caso de falha; os guards de tipo também retornam o valor validado.

| Asserção | Verifica |
|---|---|
| `test.eq(a, b)` / `test.neq(a, b)` | Igualdade / desigualdade |
| `test.ok(v)` / `test.fail(msg)` | Valor truthy / falha forçada |
| `test.is_nil(v)` / `test.not_nil(v)` | Nil / não nil |
| `test.is_true(v)` / `test.is_false(v)` | Valor booleano |
| `test.is_string/number/table/function/boolean(v)` | Guards de tipo, retornando `v` |
| `test.contains(str, sub)` / `test.matches(str, pattern)` | Substring / padrão Lua |
| `test.has_key(tbl, key)` / `test.len(v, n)` | Chave de mapa / comprimento |
| `test.gt/gte/lt/lte(a, b)` | Comparação numérica |
| `test.throws(fn)` / `test.has_error(val, err)` / `test.no_error(val, err)` | Tratamento de erros |

Todas aceitam uma mensagem opcional como último argumento.

## Ciclo de Vida e Mocking

Chame estas funções dentro de um bloco `describe`:

- `test.before_all` / `test.after_all` — executam uma vez por bloco.
- `test.before_each` / `test.after_each` — executam ao redor de cada caso.
- `test.mock("module.field", fn)` — substitui uma função no caso atual; os mocks são restaurados automaticamente. Use `test.restore_all_mocks()` para limpá-los antes.

Blocos `describe` aninhados herdam hooks do pai: `before_*` externo primeiro e `after_*` interno primeiro.

## Solução de Problemas

- `No test runner found` significa que `wippy/test` não está em `wippy.lock`; execute `wippy add wippy/test` e `wippy install`.
- Um módulo `calc` ou `test` ausente indica que as chaves de `imports` não correspondem a `require(...)`.
- Um arquivo só é descoberto se sua entrada tiver `meta.type: test`.
- Tempos e glifos variam conforme o terminal. Use o status final e o código de saída para automação.

## Limpeza

Depois de sair de `testing-demo`, remova o diretório quando não precisar mais do projeto descartável.

## Próximos Passos

- [Hello World](hello-world.md) — Estrutura mínima de projeto
- [Tipos de Entrada](../guides/entry-kinds.md) — `function.lua`, `library.lua` e entradas relacionadas
- [Framework de Testes](../framework/testing.md) — Referência do runner e protocolo de eventos
