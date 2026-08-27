---
title: "Parsing Tree-sitter"
description: "Analise código-fonte, inspecione árvores de sintaxe concretas e execute consultas Tree-sitter."
---

# Parsing Tree-sitter
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

O módulo `treesitter` analisa código-fonte em árvores de sintaxe concretas com o [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) por meio dos bindings [go-tree-sitter](https://github.com/tree-sitter/go-tree-sitter).

Esta página é uma referência de API com receitas parciais de parsing. As strings de código-fonte e os padrões de consulta são entradas da aplicação, e os exemplos que operam em nós pressupõem uma árvore ativa obtida por um parse anterior verificado. Parsers, árvores, consultas e cursores são recursos com proprietário: feche cada handle criado com sucesso quando sua última operação dependente terminar.

As árvores de sintaxe resultantes:

- Representam toda a estrutura do código-fonte
- São atualizadas incrementalmente conforme o código muda
- São robustas a erros de sintaxe (parsing parcial)
- Aceitam consultas baseadas em padrões com S-expressions

## Carregamento

```lua
local treesitter = require("treesitter")
```

<note>
O módulo treesitter é opcional — está presente apenas em builds que incluem a tag de build `treesitter`. Os binários oficiais do Wippy o incluem; para compilar a partir do código-fonte, use `make build-wippy` ou `go build -tags treesitter`. Sem a tag, `require("treesitter")` fica indisponível.
</note>

## Linguagens Suportadas

| Linguagem | Aliases | Nó Raiz |
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

### Parse de Código

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

local root, root_err = tree:root_node()
if root_err then
    tree:close()
    return nil, root_err
end
print(root:kind())        -- "source_file"
print(root:child_count()) -- number of top-level declarations
tree:close()
```

### Consulta na Árvore de Sintaxe

```lua
local code = [[
func hello() {}
func world() {}
]]

local tree, parse_err = treesitter.parse("go", code)
if parse_err then
    return nil, parse_err
end
local root, root_err = tree:root_node()
if root_err then
    tree:close()
    return nil, root_err
end

-- Find all function names
local query, query_err = treesitter.query("go", [[
    (function_declaration name: (identifier) @func_name)
]])
if query_err then
    tree:close()
    return nil, query_err
end

local captures, captures_err = query:captures(root, code)
if captures_err then
    query:close()
    tree:close()
    return nil, captures_err
end
for _, capture in ipairs(captures) do
    print(capture.name, capture.text)
end
-- "func_name"  "hello"
-- "func_name"  "world"
query:close()
tree:close()
```

## Parsing

### Parse Simples

Analisa o código-fonte com um parser interno temporário.

```lua
local tree, err = treesitter.parse("go", code)
if err then
    return nil, err
end
-- Use the tree, then call tree:close().
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `language` | string | Nome ou alias da linguagem |
| `code` | string | Código fonte |

**Retorna:** `Tree, error`

### Parser Reutilizavel

Cria um parser reutilizável para parsing repetido ou atualizações incrementais.

```lua
local parser, parser_err = treesitter.parser()
if parser_err then
    return nil, parser_err
end
local _, language_err = parser:set_language("go")
if language_err then
    parser:close()
    return nil, language_err
end

local tree1, first_err = parser:parse("package main")
if first_err then
    parser:close()
    return nil, first_err
end

-- Parse another source with the reusable parser. For an incremental update,
-- edit the old tree first as shown in the complete recipe below.
local tree2, second_err = parser:parse("package main\nfunc foo() {}")
if second_err then
    tree1:close()
    parser:close()
    return nil, second_err
end

tree2:close()
tree1:close()
parser:close()
```

**Retorna:** `Parser, error`

### Métodos do Parser

| Método | Descrição |
|--------|-----------|
| `set_language(lang)` | Definir linguagem do parser, retorna `boolean, error` |
| `get_language()` | Obter nome da linguagem atual |
| `parse(code, old_tree?)` | Analisa o código, opcionalmente com uma árvore anterior para parsing incremental |
| `set_timeout(duration)` | Definir timeout de parse (string como `"1s"` ou nanossegundos) |
| `set_ranges(ranges)` | Definir ranges de bytes para parse |
| `reset()` | Resetar estado do parser |
| `close()` | Liberar recursos do parser |

As árvores criadas por um parser reutilizável e o próprio parser têm proprietários independentes; feche cada handle criado com sucesso. Os nós tomam emprestado o armazenamento da árvore e não devem ser usados depois que ela for fechada. Cursores também tomam uma árvore emprestada, portanto feche-os antes da árvore. As consultas mantêm recursos nativos separados e também exigem `close()`; feche uma consulta quando suas capturas ou correspondências não forem mais necessárias. A limpeza explícita é determinística, enquanto o armazenamento de recursos do processo é apenas um fallback para handles deixados abertos no encerramento do processo.

## Árvores de Sintaxe

### Obter Nó Raiz

```lua
local tree, err = treesitter.parse("go", "package main")
if err then
    return nil, err
end
local root, root_err = tree:root_node()
if root_err then
    tree:close()
    return nil, root_err
end

print(root:kind())  -- "source_file"
local source_text, text_err = root:text()
if text_err then
    tree:close()
    return nil, text_err
end
print(source_text)  -- "package main"
tree:close()
```

### Métodos da Tree

| Método | Descrição |
|--------|-----------|
| `root_node()` | Obter o nó raiz da árvore |
| `root_node_with_offset(bytes, point)` | Obter raiz com offset aplicado |
| `language()` | Obter o objeto de linguagem da árvore |
| `copy()` | Criar uma cópia profunda da árvore |
| `walk()` | Criar cursor para travessia |
| `edit(edit_table)` | Aplicar uma edição incremental |
| `changed_ranges(other_tree)` | Obter ranges que mudaram |
| `included_ranges()` | Obter os ranges incluídos durante o parsing |
| `dot_graph()` | Obter representação em grafo DOT |
| `close()` | Liberar os recursos da árvore |

### Edição Incremental

Aplica uma edição antes de refazer o parse do código-fonte alterado:

```lua
local code = "func main() { x := 1 }"
local tree, parse_err = treesitter.parse("go", code)
if parse_err then
    return nil, parse_err
end

-- Mark edit: changed "1" to "100" at byte 19
local _, edit_err = tree:edit({
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
if edit_err then
    tree:close()
    return nil, edit_err
end

-- Re-parse with edited tree (faster than full parse)
local parser, parser_err = treesitter.parser()
if parser_err then
    tree:close()
    return nil, parser_err
end
local _, language_err = parser:set_language("go")
if language_err then
    parser:close()
    tree:close()
    return nil, language_err
end
local new_tree, new_tree_err = parser:parse("func main() { x := 100 }", tree)
if new_tree_err then
    parser:close()
    tree:close()
    return nil, new_tree_err
end

new_tree:close()
parser:close()
tree:close()
```

## Nós

Nós representam elementos da árvore de sintaxe. Nos exemplos isolados abaixo, `root`, `node` e `func_decl` são nós selecionados pela aplicação e tomados emprestados de uma árvore ainda aberta.

### Tipos de Nó

```lua
local node = root:child(0)

-- Type information
print(node:kind())        -- "package_clause"
print(node:type())        -- same as kind()
print(node:is_named())    -- true for significant nodes
print(node:grammar_name()) -- grammar rule name
```

### Navegação

```lua
-- Children
local child = node:child(0)           -- by index (0-based)
local named = node:named_child(0)     -- named children only
local count = node:child_count()
local named_count = node:named_child_count()

-- Siblings
local next = node:next_sibling()
local prev = node:prev_sibling()
local next_named = node:next_named_sibling()
local prev_named = node:prev_named_sibling()

-- Parent
local parent = node:parent()

-- By field name
local name_node = func_decl:child_by_field_name("name")
local field = node:field_name_for_child(0)
```

### Informações de Posição

```lua
-- Byte offsets
local start = node:start_byte()
local end_ = node:end_byte()

-- Row/column positions (0-based)
local start_pt = node:start_point()  -- {row = 0, column = 0}
local end_pt = node:end_point()      -- {row = 0, column = 12}

-- Source text
local source_text, err = node:text()
if err then
    return nil, err
end
```

### Detecção de Erro

```lua
if root:has_error() then
    -- Tree contains syntax errors
end

if node:is_error() then
    -- This specific node is an error
end

if node:is_missing() then
    -- Parser inserted this to recover from error
end
```

### S-Expression

```lua
local sexp = node:to_sexp()
-- "(source_file (package_clause (package_identifier)))"
```

## Queries

As consultas Tree-sitter encontram padrões da árvore de sintaxe escritos como S-expressions.

### Criar Query

```lua
local query, err = treesitter.query("go", [[
    (function_declaration
        name: (identifier) @func_name
        parameters: (parameter_list) @params
    )
]])
if err then
    return nil, err
end
-- The owner calls query:close() after the final query operation.
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `language` | string | Nome da linguagem |
| `pattern` | string | Padrão de query em sintaxe S-expression |

**Retorna:** `Query, error`

### Executar Query

```lua
-- Get all captures (flattened)
local captures, captures_err = query:captures(root, source_code)
if captures_err then
    query:close()
    tree:close()
    return nil, captures_err
end
for _, capture in ipairs(captures) do
    print(capture.name)   -- "func_name"
    print(capture.text)   -- actual text
    print(capture.index)  -- capture index
    -- capture.node is the Node object
end

-- Get matches (grouped by pattern)
local matches, matches_err = query:matches(root, source_code)
if matches_err then
    query:close()
    tree:close()
    return nil, matches_err
end
for _, match in ipairs(matches) do
    print(match.id, match.pattern)
    for _, capture in ipairs(match.captures) do
        local captured_text, text_err = capture.node:text()
        if text_err then
            query:close()
            tree:close()
            return nil, text_err
        end
        print(capture.name, captured_text)
    end
end

query:close()
tree:close()
```

Passar userdata do tipo incorreto no lugar de um `Node` do Tree-sitter retorna `nil, error`; passar um valor primitivo ou uma tabela gera um erro de argumento Lua antes dessa verificação. Aqui, `root`, `source_code` e `query` devem vir de uma árvore ainda aberta e de uma consulta criada com sucesso. O exemplo usa o handle proprietário `tree` para fechar ambos os recursos antes de retornar.

### Controle de Query

```lua
-- Limit query scope
query:set_byte_range(0, 1000)
query:set_point_range({row = 0, column = 0}, {row = 10, column = 0})

-- Limit matches
query:set_match_limit(100)
if query:did_exceed_match_limit() then
    -- More matches exist
end

-- Timeout (string duration or nanoseconds)
query:set_timeout("500ms")
query:set_timeout(1000000000)  -- 1 second in nanoseconds

-- Disable patterns/captures
query:disable_pattern(0)
query:disable_capture("func_name")
```

### Inspeção de Query

```lua
local pattern_count = query:pattern_count()
local capture_count = query:capture_count()
local name = query:capture_name_for_id(0)
local id = query:capture_index_for_name("func_name")
```

## Cursor de Árvore

Um cursor percorre uma árvore sem criar um objeto de nó a cada passo.

### Travessia Básica

```lua
local cursor, err = tree:walk()
if err then
    return nil, err
end

-- Start at root
print(cursor:current_node():kind())  -- "source_file"
print(cursor:current_depth())        -- 0

-- Navigate
if cursor:goto_first_child() then
    print(cursor:current_node():kind())
    print(cursor:current_depth())  -- 1
end

if cursor:goto_next_sibling() then
    -- moved to next sibling
end

cursor:goto_parent()  -- back to parent

cursor:close()
```

### Métodos do Cursor

| Método | Retorna | Descrição |
|--------|---------|-----------|
| `current_node()` | `Node` | Nó na posição do cursor |
| `current_depth()` | `integer` | Profundidade (0 = raiz) |
| `current_field_name()` | `string?` | Nome do campo se houver |
| `current_field_id()` | `integer` | ID do campo (0 se nenhum) |
| `current_descendant_index()` | `integer` | Índice de descendente do nó atual |
| `goto_parent()` | `boolean` | Mover para pai |
| `goto_first_child()` | `boolean` | Mover para primeiro filho |
| `goto_last_child()` | `boolean` | Mover para o último filho |
| `goto_next_sibling()` | `boolean` | Mover para o próximo irmão |
| `goto_previous_sibling()` | `boolean` | Mover para o irmão anterior |
| `goto_descendant(index)` | - | Mover para descendente por índice |
| `goto_first_child_for_byte(n)` | `integer?` | Mover para filho contendo byte |
| `goto_first_child_for_point(pt)` | `integer?` | Mover para filho contendo ponto |
| `reset(node)` | - | Resetar o cursor para o nó |
| `reset_to(cursor)` | - | Resetar o cursor para a posição de outro cursor |
| `copy()` | `Cursor` | Criar uma cópia do cursor |
| `close()` | - | Liberar recursos |

## Metadados de Linguagem

```lua
local lang, err = treesitter.language("go")
if err then
    return nil, err
end

print(lang:version())           -- ABI version
print(lang:node_kind_count())   -- number of node types
print(lang:field_count())       -- number of fields
print(lang:parse_state_count()) -- number of parse states

-- Node kind lookup
local kind = lang:node_kind_for_id(1)
local id = lang:id_for_node_kind("identifier", true)
local is_named = lang:node_kind_is_named(1)

-- Field lookup
local field_name = lang:field_name_for_id(1)
local field_id = lang:field_id_for_name("name")
```

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Linguagem não suportada | `errors.INVALID` | não |
| Linguagem sem binding | `errors.INVALID` | não |
| Padrão de query inválido | `errors.INVALID` | não |
| Posições inválidas | `errors.INVALID` | não |
| Parse falhou | `errors.INTERNAL` | não |
| Contexto de execução ausente | `errors.INTERNAL` | não |

Fechar um parser, uma árvore, uma consulta ou um cursor que já esteja fechado é seguro. Chamar qualquer outro método em um handle fechado gera um erro de argumento Lua.

Veja [Tratamento de Erros](../core/errors.md) para trabalhar com erros.

## Referência de Sintaxe de Query

Consultas Tree-sitter usam padrões S-expression:

```
; Match a node type
(identifier)

; Match with field names
(function_declaration name: (identifier))

; Capture with @name
(function_declaration name: (identifier) @func_name)

; Multiple patterns
[
  (function_declaration)
  (method_declaration)
] @declaration

; Wildcards
(_)           ; any node
(identifier)+ ; one or more
(identifier)* ; zero or more
(identifier)? ; optional

; Predicates
((identifier) @var
  (#match? @var "^_"))  ; regex match
```

Veja [Tree-sitter Query Syntax](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax) para documentação completa.
