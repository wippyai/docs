# Terminal I/O
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Leia de stdin e escreva para stdout/stderr para aplicacoes CLI.

<note>
Este módulo so funciona dentro de contexto de terminal. Voce não pode usa-lo de funções regulares - apenas de processos rodando em um <a href="system/terminal.md">Terminal Host</a>.
</note>

## Carregamento

```lua
local io = require("io")
```

## Escrevendo em Stdout

Escrever strings para stdout sem newline:

```lua
local ok, err = io.write("text", "more")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `...` | string | Numero variavel de strings para escrever |

**Retorna:** `boolean, error`

## Print com Newline

Escrever valores para stdout com tabs entre e newline no final:

```lua
io.print("value1", "value2", 123)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `...` | any | Numero variavel de valores para imprimir |

**Retorna:** `boolean, error`

## Escrevendo em Stderr

Escrever valores para stderr com tabs entre e newline no final:

```lua
io.eprint("Error:", message)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `...` | any | Numero variavel de valores para imprimir |

**Retorna:** `boolean, error`

## Lendo Bytes

Ler até n bytes de stdin:

```lua
local data, err = io.read(1024)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `n` | integer | Numero de bytes para ler (padrão: 1024, valores <= 0 se tornam 1024) |

**Retorna:** `string, error`

## Lendo uma Linha

Ler uma linha de stdin até newline:

```lua
local line, err = io.readline()
```

**Retorna:** `string, error`

## Flush de Saida

Flush do buffer de stdout:

```lua
local ok, err = io.flush()
```

**Retorna:** `boolean, error`

## Argumentos de Linha de Comando

Obter argumentos de linha de comando:

```lua
local args = io.args()
```

**Retorna:** `string[]`

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Sem contexto de terminal | `errors.UNAVAILABLE` | não |
| Operação de escrita falhou | `errors.INTERNAL` | não |
| Operação de leitura falhou | `errors.INTERNAL` | não |
| Operação de flush falhou | `errors.INTERNAL` | não |

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.
