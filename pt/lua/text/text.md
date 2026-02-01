# Processamento de Texto
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Expressoes regulares, diff de texto e divisao semantica de texto.

## Carregamento

```lua
local text = require("text")
```

## Expressoes Regulares

### Compilar

```lua
local re, err = text.regexp.compile("[0-9]+")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `pattern` | string | Padrao regex compativel com RE2 |

**Retorna:** `Regexp, error`

### Match

```lua
local ok = re:match_string("abc123")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `s` | string | String para match |

**Retorna:** `boolean`

### Find

```lua
local match = re:find_string("abc123def")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `s` | string | String para buscar |

**Retorna:** `string | nil`

### Find All

```lua
local matches = re:find_all_string("a1b2c3")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `s` | string | String para buscar |

**Retorna:** `string[]`

### Find com Grupos

```lua
local match = re:find_string_submatch("user@example.com")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `s` | string | String para buscar |

**Retorna:** `string[] | nil` (match completo + grupos de captura)

### Find All com Grupos

```lua
local matches = re:find_all_string_submatch("a=1 b=2")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `s` | string | String para buscar |

**Retorna:** `string[][]`

### Find Index

```lua
local pos = re:find_string_index("abc123")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `s` | string | String para buscar |

**Retorna:** `table | nil` ({inicio, fim}, base 1)

### Find All Index

```lua
local positions = re:find_all_string_index("a1b2c3")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `s` | string | String para buscar |

**Retorna:** `table[]`

### Replace

```lua
local result = re:replace_all_string("a1b2", "X")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `s` | string | String de entrada |
| `repl` | string | String de substituicao |

**Retorna:** `string`

### Split

```lua
local parts = re:split("a,b,c", -1)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `s` | string | String para dividir |
| `n` | integer | Max partes, -1 para todas |

**Retorna:** `string[]`

### Contagem de Subexpressoes

```lua
local count = re:num_subexp()
```

**Retorna:** `number`

### Nomes de Subexpressoes

```lua
local names = re:subexp_names()
```

**Retorna:** `string[]`

### String do Padrao

```lua
local pattern = re:string()
```

**Retorna:** `string`

## Diff de Texto

Compare versoes de texto e gere patches. Baseado em [go-diff](https://github.com/sergi/go-diff) (diff-match-patch do Google).

### Criar Differ

```lua
local diff, err = text.diff.new()
local diff, err = text.diff.new(options)
```

**Retorna:** `Differ, error`

#### Opcoes {id="diff-options"}

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `diff_timeout` | number | 1.0 | Timeout em segundos |
| `diff_edit_cost` | integer | 4 | Custo de uma edicao vazia |
| `match_threshold` | number | 0.5 | Tolerancia de match 0-1 |
| `match_distance` | integer | 1000 | Distancia para buscar match |
| `patch_delete_threshold` | number | 0.5 | Threshold de delete |
| `patch_margin` | integer | 4 | Margem de contexto |

### Compare

Encontra diferencas entre dois textos. Retorna um array de operacoes descrevendo como transformar text1 em text2.

```lua
local diff, _ = text.diff.new()
local diffs, err = diff:compare("hello world", "hello there")

-- diffs contem:
-- {operation = "equal", text = "hello "}
-- {operation = "delete", text = "world"}
-- {operation = "insert", text = "there"}
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `text1` | string | Texto original |
| `text2` | string | Texto modificado |

**Retorna:** `table, error` (array de {operation, text})

Operacoes: `"equal"`, `"delete"`, `"insert"`

### Summarize

Conta caracteres alterados entre versoes.

```lua
local diffs, _ = diff:compare("hello world", "hello there")
local summary = diff:summarize(diffs)

-- summary.equals = 6 (caracteres inalterados)
-- summary.deletions = 5 (caracteres removidos)
-- summary.insertions = 5 (caracteres adicionados)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `diffs` | table | Array de diff do compare |

**Retorna:** `table` ({insertions, deletions, equals})

### Pretty Text

Formata diff com cores ANSI para exibicao em terminal.

```lua
local formatted, err = diff:pretty_text(diffs)
print(formatted)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `diffs` | table | Array de diff do compare |

**Retorna:** `string, error`

### Pretty HTML

Formata diff como HTML com tags `<del>` e `<ins>`.

```lua
local html, err = diff:pretty_html(diffs)
-- Retorna: "hello <del>world</del><ins>there</ins>"
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `diffs` | table | Array de diff do compare |

**Retorna:** `string, error`

### Criar Patches

Gera patches que podem ser aplicados para transformar um texto em outro. Patches podem ser serializados e aplicados depois.

```lua
local text1 = "The quick brown fox jumps over the lazy dog"
local text2 = "The quick red fox jumps over the lazy cat"

local patches, err = diff:patch_make(text1, text2)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `text1` | string | Texto original |
| `text2` | string | Texto modificado |

**Retorna:** `table, error`

### Aplicar Patches

Aplica patches para transformar texto. Retorna o resultado e se todos os patches foram aplicados com sucesso.

```lua
local result, success = diff:patch_apply(patches, text1)
-- result = "The quick red fox jumps over the lazy cat"
-- success = true
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `patches` | table | Patches de patch_make |
| `text` | string | Texto para aplicar patches |

**Retorna:** `string, boolean`

## Divisao de Texto

Divide documentos grandes em chunks menores preservando limites semanticos. Baseado no text splitter do [langchaingo](https://github.com/tmc/langchaingo).

### Splitter Recursivo

Divide texto usando uma hierarquia de separadores. Primeiro tenta dividir em duas quebras de linha (paragrafos), depois quebra simples, depois espacos, depois caracteres. Usa separadores menores quando chunks excedem o limite de tamanho.

```lua
local splitter, err = text.splitter.recursive({
    chunk_size = 1000,
    chunk_overlap = 100
})

local long_text = "Este e um texto longo que precisa ser dividido..."
local chunks, err = splitter:split_text(long_text)
-- chunks = {"Este e um texto...", "...longo que precisa...", "...ser dividido..."}
```

**Retorna:** `Splitter, error`

#### Opcoes {id="recursive-splitter-options"}

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `chunk_size` | integer | 4000 | Max caracteres por chunk |
| `chunk_overlap` | integer | 200 | Caracteres repetidos entre chunks adjacentes |
| `keep_separator` | boolean | false | Manter separadores na saida |
| `separators` | string[] | nil | Lista customizada de separadores |

### Splitter Markdown

Divide documentos markdown respeitando a estrutura. Tenta manter headings com seu conteudo, blocos de codigo intactos e linhas de tabela juntas.

```lua
local splitter, err = text.splitter.markdown({
    chunk_size = 2000,
    code_blocks = true,
    heading_hierarchy = true
})

local readme = fs.read("README.md")
local chunks, err = splitter:split_text(readme)
```

**Retorna:** `Splitter, error`

#### Opcoes {id="markdown-splitter-options"}

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `chunk_size` | integer | 4000 | Max caracteres por chunk |
| `chunk_overlap` | integer | 200 | Caracteres repetidos entre chunks adjacentes |
| `code_blocks` | boolean | false | Manter blocos de codigo juntos |
| `reference_links` | boolean | false | Preservar links de referencia |
| `heading_hierarchy` | boolean | false | Respeitar niveis de heading |
| `join_table_rows` | boolean | false | Manter linhas de tabela juntas |

### Split Text

Divide um unico documento em um array de chunks.

```lua
local chunks, err = splitter:split_text(document)

for i, chunk in ipairs(chunks) do
    -- Processa cada chunk (ex: criar embedding, enviar para LLM)
    process(chunk)
end
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `text` | string | Texto para dividir |

**Retorna:** `string[], error`

### Split Batch

Divide multiplos documentos preservando seus metadados. Cada documento de entrada pode produzir multiplos chunks de saida. Todos os chunks herdam os metadados do documento fonte.

```lua
-- Entrada: paginas de um PDF com numeros de pagina
local pages = {
    {content = "Conteudo da primeira pagina...", metadata = {page = 1}},
    {content = "Conteudo da segunda pagina...", metadata = {page = 2}}
}

local chunks, err = splitter:split_batch(pages)

-- Saida: cada chunk sabe de qual pagina veio
for _, chunk in ipairs(chunks) do
    print("Pagina " .. chunk.metadata.page .. ": " .. chunk.content:sub(1, 50))
end
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `pages` | table | Array de {content, metadata} |

**Retorna:** `table, error` (array de {content, metadata})

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| Sintaxe de padrao invalida | `errors.INVALID` | nao |
| Erro interno | `errors.INTERNAL` | nao |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
