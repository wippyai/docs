# Terminal I/O
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Leia de stdin e escreva para stdout/stderr para aplicacoes CLI.

<note>
Este modulo so funciona dentro de contexto de terminal. Voce nao pode usa-lo de funcoes regulares - apenas de processos rodando em um <a href="system-terminal.md">Terminal Host</a>.
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

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `...` | string | Numero variavel de strings para escrever |

**Retorna:** `boolean, error`

## Print com Newline

Escrever valores para stdout com tabs entre e newline no final:

```lua
io.print("value1", "value2", 123)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `...` | any | Numero variavel de valores para imprimir |

**Retorna:** `boolean, error`

## Escrevendo em Stderr

Escrever valores para stderr com tabs entre e newline no final:

```lua
io.eprint("Error:", message)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `...` | any | Numero variavel de valores para imprimir |

**Retorna:** `boolean, error`

## Lendo Bytes

Ler ate n bytes de stdin:

```lua
local data, err = io.read(1024)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `n` | integer | Numero de bytes para ler (padrao: 1024, valores <= 0 se tornam 1024) |

**Retorna:** `string, error`

## Lendo uma Linha

Ler uma linha de stdin ate newline:

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

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| Sem contexto de terminal | `errors.UNAVAILABLE` | nao |
| Operacao de escrita falhou | `errors.INTERNAL` | nao |
| Operacao de leitura falhou | `errors.INTERNAL` | nao |
| Operacao de flush falhou | `errors.INTERNAL` | nao |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
