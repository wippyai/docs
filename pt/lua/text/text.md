---
title: "Processamento de Texto"
description: "Compile expressões regulares, compare textos, crie patches e divida documentos em trechos."
---

# Processamento de Texto
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

O módulo `text` oferece expressões regulares, comparação e aplicação de patches em textos, além da divisão de documentos. Esta página é uma referência de API. Os blocos curtos são chamadas isoladas; os exemplos mais longos de divisão são receitas parciais, cujos documentos, recursos de sistema de arquivos configurados e processamento posterior pertencem à aplicação que os utiliza.

## Carregamento

```lua
local text = require("text")
```

## Expressões Regulares

### `text.regexp.compile`

Compila uma expressão regular compatível com RE2.

```lua
local re, err = text.regexp.compile("[0-9]+")
if err then
    return nil, err
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `pattern` | string | Padrão regex compatível com RE2 |

**Retorna:** `Regexp, error`

### `re:match_string`

Testa uma string contra a expressão compilada.

```lua
local ok = re:match_string("abc123")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `s` | string | String para match |

**Retorna:** `boolean`

### `re:find_string`

Encontra a primeira substring correspondente.

```lua
local match = re:find_string("abc123def")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `s` | string | String para buscar |

**Retorna:** `string | nil`

Nesta versão do runtime, uma correspondência com a string vazia também é representada por `nil`. Use um padrão que consuma pelo menos um caractere quando for necessário distinguir uma correspondência vazia da ausência de correspondência.

### `re:find_all_string`

Encontra todas as substrings correspondentes.

```lua
local matches = re:find_all_string("a1b2c3")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `s` | string | String para buscar |

**Retorna:** `string[]`

### `re:find_string_submatch`

Encontra a primeira correspondência e seus grupos de captura.

```lua
local match = re:find_string_submatch("user@example.com")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `s` | string | String para buscar |

**Retorna:** `string[] | nil` (match completo + grupos de captura)

### `re:find_all_string_submatch`

Encontra todas as correspondências e seus grupos de captura.

```lua
local matches = re:find_all_string_submatch("a=1 b=2")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `s` | string | String para buscar |

**Retorna:** `string[][]`

### `re:find_string_index`

Encontra os limites, com índices a partir de 1, da primeira correspondência.

```lua
local pos = re:find_string_index("abc123")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `s` | string | String para buscar |

**Retorna:** `table | nil` ({início, fim}, base 1)

### `re:find_all_string_index`

Encontra os limites de todas as correspondências.

```lua
local positions = re:find_all_string_index("a1b2c3")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `s` | string | String para buscar |

**Retorna:** `table[] | nil` (nil quando não há correspondências)

### `re:replace_all_string`

Substitui todas as substrings correspondentes.

```lua
local result = re:replace_all_string("a1b2", "X")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `s` | string | String de entrada |
| `repl` | string | String de substituição |

**Retorna:** `string`

### `re:split`

Divide uma string nas correspondências da expressão compilada.

```lua
local parts = re:split("a,b,c", -1)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `s` | string | String para dividir |
| `n` | integer | Max partes, -1 para todas |

**Retorna:** `string[]`

### `re:num_subexp`

Retorna o número de subexpressões de captura.

```lua
local count = re:num_subexp()
```

**Retorna:** `number`

### `re:subexp_names`

Retorna os nomes das subexpressões de captura.

```lua
local names = re:subexp_names()
```

**Retorna:** `string[]`

### `re:string`

Retorna a string do padrão compilado.

```lua
local pattern = re:string()
```

**Retorna:** `string`

## Diff de Texto

Compare versões de texto e gere patches com [go-diff](https://github.com/sergi/go-diff), uma implementação do algoritmo diff-match-patch do Google.

### `text.diff.new`

Cria um comparador de textos com opções padrão ou personalizadas.

```lua
local diff, err = text.diff.new()
local diff, err = text.diff.new(options)
```

**Retorna:** `Differ, error`

#### Opções {id="diff-options"}

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `diff_timeout` | number | 1.0 | Timeout em segundos |
| `diff_edit_cost` | integer | 4 | Custo de uma edição vazia |
| `match_threshold` | number | 0.5 | Tolerância de correspondência, de 0 a 1 |
| `match_distance` | integer | 1000 | Distância para buscar uma correspondência |
| `patch_delete_threshold` | number | 0.5 | Threshold de delete |
| `patch_margin` | integer | 4 | Margem de contexto |

### `diff:compare`

Compara duas strings e retorna operações que transformam `text1` em `text2`.

```lua
local diff, diff_err = text.diff.new()
if diff_err then
    return nil, diff_err
end
local diffs, err = diff:compare("hello world", "hello there")
if err then
    return nil, err
end

-- diffs contains:
-- {operation = "equal", text = "hello "}
-- {operation = "delete", text = "world"}
-- {operation = "insert", text = "there"}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `text1` | string | Texto original |
| `text2` | string | Texto modificado |

**Retorna:** `table, error` (array de {operation, text})

Operações: `"equal"`, `"delete"`, `"insert"`

### `diff:summarize`

Conta os bytes UTF-8 inalterados, inseridos e excluídos. Em textos não ASCII, esses totais não são contagens de pontos de código Unicode nem de grafemas.

```lua
-- `diffs` is the checked result from diff:compare.
local summary = diff:summarize(diffs)

-- summary.equals = 6 (bytes unchanged)
-- summary.deletions = 5 (bytes removed)
-- summary.insertions = 5 (bytes added)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `diffs` | table | Array de diff do compare |

**Retorna:** `table` ({insertions, deletions, equals})

### `diff:pretty_text`

Formata um diff com cores ANSI para exibição no terminal.

```lua
local formatted, err = diff:pretty_text(diffs)
if err then
    return nil, err
end
print(formatted)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `diffs` | table | Array de diff do compare |

**Retorna:** `string, error`

### `diff:pretty_html`

Formata diff como HTML com tags `<del>` e `<ins>`.

```lua
local html, err = diff:pretty_html(diffs)
if err then
    return nil, err
end
-- `html` is an HTML fragment with equal, deleted, and inserted spans.
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `diffs` | table | Array de diff do compare |

**Retorna:** `string, error`

### `diff:patch_make`

Gera patches que podem ser aplicados para transformar um texto em outro. Patches podem ser serializados e aplicados depois.

```lua
local text1 = "The quick brown fox jumps over the lazy dog"
local text2 = "The quick red fox jumps over the lazy cat"

local patches, err = diff:patch_make(text1, text2)
if err then
    return nil, err
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `text1` | string | Texto original |
| `text2` | string | Texto modificado |

**Retorna:** `table, error`

### `diff:patch_apply`

Aplica patches a uma string e retorna o resultado e a indicação de que todos os patches foram aplicados com sucesso.

```lua
local result, success = diff:patch_apply(patches, text1)
-- result = "The quick red fox jumps over the lazy cat"
-- success = true
```

Verifique `success` antes de tratar `result` como a transformação solicitada. Passe tabelas de patches produzidas por `patch_make`; nesta versão do runtime, texto serializado malformado dentro de uma tabela construída manualmente pode ser ignorado, em vez de gerar um erro separado.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `patches` | table | Patches de patch_make |
| `text` | string | Texto para aplicar patches |

**Retorna:** `string, boolean`

## Divisão de Texto

Divide documentos em trechos preservando limites semânticos. Os divisores se baseiam na implementação do [langchaingo](https://github.com/tmc/langchaingo).

### `text.splitter.recursive`

O divisor recursivo tenta primeiro duas quebras de linha, depois uma quebra de linha, espaços e, por fim, caracteres individuais. Ele avança para o separador seguinte quando um trecho excede o limite de tamanho.

```lua
local splitter, err = text.splitter.recursive({
    chunk_size = 1000,
    chunk_overlap = 100
})
if err then
    return nil, err
end

local long_text = "This is a long text that needs splitting..."
local chunks, split_err = splitter:split_text(long_text)
if split_err then
    return nil, split_err
end
```

**Retorna:** `Splitter, error`

#### Opções {id="recursive-splitter-options"}

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `chunk_size` | integer | 4000 | Max caracteres por chunk |
| `chunk_overlap` | integer | 200 | Caracteres repetidos entre chunks adjacentes |
| `keep_separator` | boolean | false | Manter separadores na saída |
| `separators` | string[] | nil | Lista customizada de separadores |

### `text.splitter.markdown`

O divisor Markdown pode manter títulos com seu conteúdo, preservar blocos de código e agrupar linhas de tabela.

```lua
local splitter, err = text.splitter.markdown({
    chunk_size = 2000,
    code_blocks = true,
    heading_hierarchy = true
})
if err then
    return nil, err
end

local fs = require("fs")
local docs, docs_err = fs.get("app:docs")
if docs_err then
    return nil, docs_err
end
local readme, read_err = docs:readfile("README.md")
if read_err then
    return nil, read_err
end
local chunks, split_err = splitter:split_text(readme)
if split_err then
    return nil, split_err
end
```

Esta receita parcial exige que a entrada habilite `text` e `fs`, que exista um recurso de sistema de arquivos `app:docs` configurado e que um `README.md` legível esteja disponível nesse recurso.

**Retorna:** `Splitter, error`

#### Opções {id="markdown-splitter-options"}

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `chunk_size` | integer | 4000 | Max caracteres por chunk |
| `chunk_overlap` | integer | 200 | Caracteres repetidos entre chunks adjacentes |
| `code_blocks` | boolean | false | Manter blocos de código juntos |
| `reference_links` | boolean | false | Preservar links de referência |
| `heading_hierarchy` | boolean | false | Respeitar niveis de heading |
| `join_table_rows` | boolean | false | Manter linhas de tabela juntas |

### `splitter:split_text`

Divide um único documento em um array de chunks.

```lua
local chunks, err = splitter:split_text(document)
if err then
    return nil, err
end

for i, chunk in ipairs(chunks) do
    -- Process each chunk (e.g., create embedding, send to LLM)
    process(chunk)
end
```

Aqui, `splitter` é um divisor criado com sucesso, enquanto `document` e `process` são fornecidos pela aplicação.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `text` | string | Texto para dividir |

**Retorna:** `string[], error`

### `splitter:split_batch`

Divide múltiplos documentos preservando seus metadados. Cada documento de entrada pode produzir vários trechos de saída. Todos os trechos herdam os metadados do documento de origem.

```lua
-- Input: pages from a PDF with page numbers
local pages = {
    {content = "First page content...", metadata = {page = 1}},
    {content = "Second page content...", metadata = {page = 2}}
}

local chunks, err = splitter:split_batch(pages)
if err then
    return nil, err
end

-- Output: each chunk knows which page it came from
for _, chunk in ipairs(chunks) do
    print("Page " .. chunk.metadata.page .. ": " .. chunk.content:sub(1, 50))
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `pages` | table | Array de {content, metadata} |

**Retorna:** `table, error` (array de {content, metadata})

`split_batch` ignora silenciosamente um item quando ele não é uma tabela, quando seu campo `content` está ausente, vazio ou não é uma string, ou quando a divisão desse item falha. Ainda assim, retorna os demais trechos com erro `nil`. Valide cada item antes da chamada e verifique na aplicação qualquer requisito de cardinalidade; uma chamada bem-sucedida não prova que todas as entradas foram representadas.

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Sintaxe de padrão inválida | `errors.INVALID` | não |
| Erro interno | `errors.INTERNAL` | não |

Veja [Tratamento de Erros](lua/core/errors.md) para trabalhar com erros.
