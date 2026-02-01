# Parsing Tree-sitter
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Parse codigo fonte em arvores de sintaxe concretas usando [Tree-sitter](https://tree-sitter.github.io/tree-sitter/). Baseado nos bindings [go-tree-sitter](https://github.com/tree-sitter/go-tree-sitter).

Tree-sitter produz arvores de sintaxe que:
- Representam a estrutura completa do codigo fonte
- Atualizam incrementalmente conforme o codigo muda
- Sao robustas a erros de sintaxe (parsing parcial)
- Suportam queries baseadas em padroes usando S-expressions

## Carregamento

```lua
local treesitter = require("treesitter")
```

## Linguagens Suportadas

| Linguagem | Aliases | No Raiz |
|-----------|---------|---------|
| Go | `go`, `golang` | `source_file` |
| JavaScript | `js`, `javascript` | `program` |
| TypeScript | `ts`, `typescript` | `program` |
| TSX | `tsx` | `program` |
| Python | `python`, `py` | `module` |
| Lua | `lua` | `chunk` |
| PHP | `php` | `program` |
| C# | `csharp`, `cs`, `c#` | `compilation_unit` |
| HTML | `html`, `html5` | `document` |
| Markdown | `markdown`, `md` | `document` |
| SQL | `sql` | - |

```lua
local langs = treesitter.supported_languages()
-- {go = true, javascript = true, python = true, ...}
```

## Quick Start

### Parse de Codigo

```lua
local code = [[
func hello() {
    return "Hello!"
}
]]

local tree, err = treesitter.parse("go", code)
if err then
    return nil, err
end

local root = tree:root_node()
print(root:kind())        -- "source_file"
print(root:child_count()) -- numero de declaracoes top-level
```

### Query na Arvore de Sintaxe

```lua
local code = [[
func hello() {}
func world() {}
]]

local tree = treesitter.parse("go", code)
local root = tree:root_node()

-- Encontrar todos os nomes de funcao
local query = treesitter.query("go", [[
    (function_declaration name: (identifier) @func_name)
]])

local captures = query:captures(root, code)
for _, capture in ipairs(captures) do
    print(capture.name, capture.text)
end
-- "func_name"  "hello"
-- "func_name"  "world"
```

## Parsing

### Parse Simples

Parse de codigo fonte em uma arvore de sintaxe. Cria um parser temporario internamente.

```lua
local tree, err = treesitter.parse("go", code)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `language` | string | Nome ou alias da linguagem |
| `code` | string | Codigo fonte |

**Retorna:** `Tree, error`

### Parser Reutilizavel

Criar um parser para parsing repetido ou atualizacoes incrementais.

```lua
local parser = treesitter.parser()
parser:set_language("go")

local tree1 = parser:parse("package main")

-- Parse incremental com arvore antiga
local tree2 = parser:parse("package main\nfunc foo() {}", tree1)

parser:close()
```

**Retorna:** `Parser`

### Metodos do Parser

| Metodo | Descricao |
|--------|-----------|
| `set_language(lang)` | Definir linguagem do parser, retorna `boolean, error` |
| `get_language()` | Obter nome da linguagem atual |
| `parse(code, old_tree?)` | Parse de codigo, opcionalmente com arvore antiga para parsing incremental |
| `set_timeout(duration)` | Definir timeout de parse (string como `"1s"` ou nanossegundos) |
| `set_ranges(ranges)` | Definir ranges de bytes para parse |
| `reset()` | Resetar estado do parser |
| `close()` | Liberar recursos do parser |

## Arvores de Sintaxe

### Obter No Raiz

```lua
local tree = treesitter.parse("go", "package main")
local root = tree:root_node()

print(root:kind())  -- "source_file"
print(root:text())  -- "package main"
```

### Metodos da Tree

| Metodo | Descricao |
|--------|-----------|
| `root_node()` | Obter no raiz da arvore |
| `root_node_with_offset(bytes, point)` | Obter raiz com offset aplicado |
| `language()` | Obter objeto de linguagem da arvore |
| `copy()` | Criar copia profunda da arvore |
| `walk()` | Criar cursor para travessia |
| `edit(edit_table)` | Aplicar edicao incremental |
| `changed_ranges(other_tree)` | Obter ranges que mudaram |
| `included_ranges()` | Obter ranges incluidos durante parsing |
| `dot_graph()` | Obter representacao em grafo DOT |
| `close()` | Liberar recursos da arvore |

### Edicao Incremental

Atualizar a arvore quando o codigo fonte muda:

```lua
local code = "func main() { x := 1 }"
local tree = treesitter.parse("go", code)

-- Marcar edicao: mudou "1" para "100" no byte 19
tree:edit({
    start_byte = 19,
    old_end_byte = 20,
    new_end_byte = 22,
    start_row = 0,
    start_column = 19,
    old_end_row = 0,
    old_end_column = 20,
    new_end_row = 0,
    new_end_column = 22
})

-- Re-parse com arvore editada (mais rapido que parse completo)
local parser = treesitter.parser()
parser:set_language("go")
local new_tree = parser:parse("func main() { x := 100 }", tree)
```

## Nos

Nos representam elementos na arvore de sintaxe.

### Tipos de No

```lua
local node = root:child(0)

-- Informacao de tipo
print(node:kind())        -- "package_clause"
print(node:type())        -- igual a kind()
print(node:is_named())    -- true para nos significativos
print(node:grammar_name()) -- nome da regra gramatical
```

### Navegacao

```lua
-- Filhos
local child = node:child(0)           -- por indice (base 0)
local named = node:named_child(0)     -- apenas filhos nomeados
local count = node:child_count()
local named_count = node:named_child_count()

-- Irmaos
local next = node:next_sibling()
local prev = node:prev_sibling()
local next_named = node:next_named_sibling()
local prev_named = node:prev_named_sibling()

-- Pai
local parent = node:parent()

-- Por nome de campo
local name_node = func_decl:child_by_field_name("name")
local field = node:field_name_for_child(0)
```

### Informacao de Posicao

```lua
-- Offsets em bytes
local start = node:start_byte()
local end_ = node:end_byte()

-- Posicoes linha/coluna (base 0)
local start_pt = node:start_point()  -- {row = 0, column = 0}
local end_pt = node:end_point()      -- {row = 0, column = 12}

-- Texto fonte
local text = node:text()
```

### Deteccao de Erro

```lua
if root:has_error() then
    -- Arvore contem erros de sintaxe
end

if node:is_error() then
    -- Este no especifico e um erro
end

if node:is_missing() then
    -- Parser inseriu este no para recuperar de erro
end
```

### S-Expression

```lua
local sexp = node:to_sexp()
-- "(source_file (package_clause (package_identifier)))"
```

## Queries

Pattern matching usando a linguagem de query do Tree-sitter (S-expressions).

### Criar Query

```lua
local query, err = treesitter.query("go", [[
    (function_declaration
        name: (identifier) @func_name
        parameters: (parameter_list) @params
    )
]])
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `language` | string | Nome da linguagem |
| `pattern` | string | Padrao de query em sintaxe S-expression |

**Retorna:** `Query, error`

### Executar Query

```lua
-- Obter todas as capturas (achatadas)
local captures = query:captures(root, source_code)
for _, capture in ipairs(captures) do
    print(capture.name)   -- "@func_name"
    print(capture.text)   -- texto real
    print(capture.index)  -- indice da captura
    -- capture.node e o objeto Node
end

-- Obter matches (agrupados por padrao)
local matches = query:matches(root, source_code)
for _, match in ipairs(matches) do
    print(match.id, match.pattern)
    for _, capture in ipairs(match.captures) do
        print(capture.name, capture.node:text())
    end
end
```

### Controle de Query

```lua
-- Limitar escopo da query
query:set_byte_range(0, 1000)
query:set_point_range({row = 0, column = 0}, {row = 10, column = 0})

-- Limitar matches
query:set_match_limit(100)
if query:did_exceed_match_limit() then
    -- Existem mais matches
end

-- Timeout (string de duracao ou nanossegundos)
query:set_timeout("500ms")
query:set_timeout(1000000000)  -- 1 segundo em nanossegundos

-- Desabilitar padroes/capturas
query:disable_pattern(0)
query:disable_capture("func_name")
```

### Inspecao de Query

```lua
local pattern_count = query:pattern_count()
local capture_count = query:capture_count()
local name = query:capture_name_for_id(0)
local id = query:capture_index_for_name("func_name")
```

## Cursor de Arvore

Travessia eficiente sem criar objetos de no a cada passo.

### Travessia Basica

```lua
local cursor = tree:walk()

-- Comecar na raiz
print(cursor:current_node():kind())  -- "source_file"
print(cursor:current_depth())        -- 0

-- Navegar
if cursor:goto_first_child() then
    print(cursor:current_node():kind())
    print(cursor:current_depth())  -- 1
end

if cursor:goto_next_sibling() then
    -- moveu para proximo irmao
end

cursor:goto_parent()  -- voltar ao pai

cursor:close()
```

### Metodos do Cursor

| Metodo | Retorna | Descricao |
|--------|---------|-----------|
| `current_node()` | `Node` | No na posicao do cursor |
| `current_depth()` | `integer` | Profundidade (0 = raiz) |
| `current_field_name()` | `string?` | Nome do campo se houver |
| `goto_parent()` | `boolean` | Mover para pai |
| `goto_first_child()` | `boolean` | Mover para primeiro filho |
| `goto_last_child()` | `boolean` | Mover para ultimo filho |
| `goto_next_sibling()` | `boolean` | Mover para proximo irmao |
| `goto_previous_sibling()` | `boolean` | Mover para irmao anterior |
| `goto_first_child_for_byte(n)` | `integer?` | Mover para filho contendo byte |
| `goto_first_child_for_point(pt)` | `integer?` | Mover para filho contendo ponto |
| `reset(node)` | - | Resetar cursor para no |
| `copy()` | `Cursor` | Criar copia do cursor |
| `close()` | - | Liberar recursos |

## Metadados de Linguagem

```lua
local lang = treesitter.language("go")

print(lang:version())           -- versao ABI
print(lang:node_kind_count())   -- numero de tipos de no
print(lang:field_count())       -- numero de campos

-- Lookup de tipo de no
local kind = lang:node_kind_for_id(1)
local id = lang:id_for_node_kind("identifier", true)
local is_named = lang:node_kind_is_named(1)

-- Lookup de campo
local field_name = lang:field_name_for_id(1)
local field_id = lang:field_id_for_name("name")
```

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| Linguagem nao suportada | `errors.INVALID` | nao |
| Linguagem sem binding | `errors.INVALID` | nao |
| Padrao de query invalido | `errors.INVALID` | nao |
| Posicoes invalidas | `errors.INVALID` | nao |
| Parse falhou | `errors.INTERNAL` | nao |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.

## Referencia de Sintaxe de Query

Queries Tree-sitter usam padroes S-expression:

```
; Match um tipo de no
(identifier)

; Match com nomes de campo
(function_declaration name: (identifier))

; Captura com @nome
(function_declaration name: (identifier) @func_name)

; Multiplos padroes
[
  (function_declaration)
  (method_declaration)
] @declaration

; Wildcards
(_)           ; qualquer no
(identifier)+ ; um ou mais
(identifier)* ; zero ou mais
(identifier)? ; opcional

; Predicados
((identifier) @var
  (#match? @var "^_"))  ; regex match
```

Veja [Tree-sitter Query Syntax](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax) para documentacao completa.
