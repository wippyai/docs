---
title: "Terminal I/O"
description: "Leia a entrada do terminal e escreva na saída padrão e na saída de erro padrão."
---

# Terminal I/O
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

O módulo `io` lê da entrada padrão e escreve na saída padrão e na saída de erro padrão em aplicações de terminal.

Esta é uma referência de API. Seus exemplos são chamadas isoladas; um processo de terminal deve propagar os erros Lua estruturados retornados quando o resultado afeta o fluxo de controle.

<note>
Este módulo está disponível apenas para processos executados em um <a href="../../system/terminal.md">Host de Terminal</a>, não para funções regulares.
</note>

## Carregamento

```lua
local io = require("io")
```

## Escrevendo em Stdout

Escreve valores na saída padrão sem uma nova linha final:

```lua
local ok, err = io.write("text", "more")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `...` | any | Número variável de valores a escrever (convertidos em string) |

**Retorna:** `boolean, error`

## Print com Newline

Escreve valores na saída padrão, separados por tabulações e seguidos por uma nova linha:

```lua
io.print("value1", "value2", 123)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `...` | any | Número variável de valores a imprimir |

**Retorna:** `boolean, error`

Depois que a busca do contexto de terminal é bem-sucedida, os erros de escrita da saída são ignorados e a função retorna `true`. A ausência de contexto de terminal retorna `nil, "no terminal context"`.

## Escrevendo em Stderr

Escreve valores na saída de erro padrão, separados por tabulações e seguidos por uma nova linha:

```lua
io.eprint("Error:", message)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `...` | any | Número variável de valores a imprimir |

**Retorna:** `boolean, error`

Depois que a busca do contexto de terminal é bem-sucedida, os erros de escrita da saída são ignorados e a função retorna `true`. A ausência de contexto de terminal retorna `nil, "no terminal context"`.

## Lendo Bytes

Lê até `n` bytes da entrada padrão:

```lua
local data, err = io.read(1024)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `n` | integer | Número de bytes a ler (padrão: 1024; valores <= 0 tornam-se 1024) |

**Retorna:** `string, error`. Uma leitura bem-sucedida pode retornar menos de `n` bytes ou uma string vazia.

## Lendo uma Linha

Lê uma linha da entrada padrão:

```lua
local line, err = io.readline()
```

**Retorna:** `string, error`. Os caracteres finais `\n` e `\r` são removidos. EOF após uma entrada parcial retorna essa linha parcial; EOF sem entrada retorna `nil` e um erro estruturado.

## Modo Raw

Ativa ou desativa o modo raw do terminal, que desabilita o buffering por linha e o eco:

```lua
local ok, err = io.raw(true)   -- enable
local ok, err = io.raw(false)  -- disable
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `enable` | boolean | `true` para habilitar, `false` para desabilitar (padrão: `true`) |

**Retorna:** `boolean, error`

O modo raw usa contagem de referências: cada chamada `io.raw(true)` deve ser correspondida por uma chamada `io.raw(false)`. O terminal volta automaticamente ao modo normal quando o processo termina.

## Flush da Saída

Faz flush do buffer da saída padrão:

```lua
local ok, err = io.flush()
```

**Retorna:** `boolean, error`. A chamada é um no-op bem-sucedido quando a saída padrão não implementa `Sync()`.

## Argumentos de Linha de Comando

Obtém os argumentos da linha de comando:

```lua
local args = io.args()
```

**Retorna:** `string[]`

`io.args()` nunca falha. Retorna uma tabela vazia quando nenhum contexto de terminal está disponível.

## Erros

Este módulo retorna erros Lua estruturados. A ausência de contexto de terminal usa `errors.UNAVAILABLE`; falhas diretas de escrita/flush e respostas de yield inválidas usam `errors.INTERNAL`. Falhas de leitura, leitura de linha e modo raw apoiadas pelo dispatcher preservam os metadados do erro subjacente quando disponíveis. `io.args()` não retorna erro.
