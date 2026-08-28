---
title: "Análisis con Tree-sitter"
description: "Analiza código fuente, inspecciona árboles de sintaxis concretos y ejecuta consultas de Tree-sitter."
---

# Análisis con Tree-sitter
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

El módulo `treesitter` analiza código fuente y produce árboles de sintaxis concretos con [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) mediante los bindings de [go-tree-sitter](https://github.com/tree-sitter/go-tree-sitter).

Esta página es una referencia de API con recetas parciales de análisis. Las cadenas de origen y los patrones de consulta son entradas de la aplicación, y los fragmentos a nivel de nodo presuponen un árbol vivo procedente de un análisis anterior comprobado. Los parsers, árboles, consultas y cursores son recursos bajo propiedad: cierra cada handle creado correctamente cuando finalice su última operación dependiente.

Los árboles de sintaxis resultantes:
- Representan la estructura completa del código fuente
- Se actualizan incrementalmente cuando el código cambia
- Son robustos ante errores de sintaxis (parsing parcial)
- Soportan consultas basadas en patrones usando S-expressions

## Carga

```lua
local treesitter = require("treesitter")
```

<note>
El módulo `treesitter` es opcional: solo está presente en compilaciones que incluyen la etiqueta de compilación `treesitter`. Los binarios oficiales de Wippy lo incluyen; para compilar desde el código fuente, usa `make build-wippy` o `go build -tags treesitter`. Sin la etiqueta, `require("treesitter")` no está disponible.
</note>

## Lenguajes compatibles

| Lenguaje | Aliases | Nodo Raiz |
|----------|---------|-----------|
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

## Inicio rápido

### Analizar código

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

### Consultar el árbol de sintaxis

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

## Análisis

### Análisis simple

Analiza código fuente y produce un árbol de sintaxis. Crea un parser temporal internamente.

```lua
local tree, err = treesitter.parse("go", code)
if err then
    return nil, err
end
-- Use the tree, then call tree:close().
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `language` | string | Nombre o alias de lenguaje |
| `code` | string | Código fuente |

**Devuelve:** `Tree, error`

### Parser reutilizable

Crea un parser para análisis repetidos o actualizaciones incrementales.

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

**Devuelve:** `Parser, error`

### Métodos del parser

| Método | Descripción |
|--------|-------------|
| `set_language(lang)` | Establecer lenguaje del parser, devuelve `boolean, error` |
| `get_language()` | Obtener nombre de lenguaje actual |
| `parse(code, old_tree?)` | Parsear código, opcionalmente con arbol anterior para parsing incremental |
| `set_timeout(duration)` | Establecer timeout de parsing (string como `"1s"` o nanosegundos) |
| `set_ranges(ranges)` | Establecer rangos de bytes a parsear |
| `reset()` | Reiniciar estado del parser |
| `close()` | Liberar recursos del parser |

Los árboles creados por un parser reutilizable y el propio parser tienen propietarios independientes; cierra cada handle creado correctamente. Los nodos toman prestado el almacenamiento de su árbol y no deben usarse después de cerrarlo. Los cursores también toman prestado un árbol, así que ciérralos antes que el árbol. Las consultas poseen recursos nativos separados y también requieren `close()`; cierra una consulta cuando ya no necesites sus capturas o coincidencias. La limpieza explícita es determinista, mientras que el almacén de recursos del proceso solo es un respaldo para los handles que queden abiertos al terminar el proceso.

## Árboles de sintaxis

### Obtener el nodo raíz

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

### Métodos de Tree

| Método | Descripción |
|--------|-------------|
| `root_node()` | Obtener nodo raiz del arbol |
| `root_node_with_offset(bytes, point)` | Obtener raiz con offset aplicado |
| `language()` | Obtener objeto de lenguaje del arbol |
| `copy()` | Crear copia profunda del arbol |
| `walk()` | Crear cursor para recorrido |
| `edit(edit_table)` | Aplicar edicion incremental |
| `changed_ranges(other_tree)` | Obtener rangos que cambiaron |
| `included_ranges()` | Obtener rangos incluidos durante parsing |
| `dot_graph()` | Obtener representacion de grafo DOT |
| `close()` | Liberar recursos del arbol |

### Edición incremental

Actualizar el arbol cuando el código fuente cambia:

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

## Nodos

Los nodos representan elementos del árbol de sintaxis. En los fragmentos aislados siguientes, `root`, `node` y `func_decl` son nodos seleccionados por la aplicación y prestados por un árbol que sigue abierto.

### Tipos de nodo

```lua
local node = root:child(0)

-- Type information
print(node:kind())        -- "package_clause"
print(node:type())        -- same as kind()
print(node:is_named())    -- true for significant nodes
print(node:grammar_name()) -- grammar rule name
```

### Navegación

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

### Información de posición

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

### Detección de errores

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

## Consultas

Coincidencia de patrones usando el lenguaje de consultas de Tree-sitter (S-expressions).

### Crear una consulta

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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `language` | string | Nombre de lenguaje |
| `pattern` | string | Patrón de consulta en sintaxis S-expression |

**Devuelve:** `Query, error`

### Ejecutar una consulta

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

Pasar userdata del tipo incorrecto en lugar de un `Node` de Tree-sitter devuelve `nil, error`; pasar un valor primitivo o una tabla genera un error de argumento Lua antes de esa comprobación. Aquí, `root`, `source_code` y `query` deben proceder de un árbol aún abierto y de una consulta creada correctamente. El fragmento usa el handle propietario `tree` para cerrar ambos recursos antes de devolver.

### Control de consultas

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

### Inspección de consultas

```lua
local pattern_count = query:pattern_count()
local capture_count = query:capture_count()
local name = query:capture_name_for_id(0)
local id = query:capture_index_for_name("func_name")
```

## Cursor de árbol

Recorrido eficiente sin crear objetos nodo en cada paso.

### Recorrido Básico

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

### Métodos del cursor

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `current_node()` | `Node` | Nodo en posicion del cursor |
| `current_depth()` | `integer` | Profundidad (0 = raiz) |
| `current_field_name()` | `string?` | Nombre de campo si hay |
| `current_field_id()` | `integer` | ID de campo (0 si no hay) |
| `current_descendant_index()` | `integer` | Indice de descendiente del nodo actual |
| `goto_parent()` | `boolean` | Mover al padre |
| `goto_first_child()` | `boolean` | Mover al primer hijo |
| `goto_last_child()` | `boolean` | Mover al ultimo hijo |
| `goto_next_sibling()` | `boolean` | Mover al siguiente hermano |
| `goto_previous_sibling()` | `boolean` | Mover al hermano anterior |
| `goto_descendant(index)` | - | Mover al descendiente por indice |
| `goto_first_child_for_byte(n)` | `integer?` | Mover al hijo que contiene byte |
| `goto_first_child_for_point(pt)` | `integer?` | Mover al hijo que contiene punto |
| `reset(node)` | - | Reiniciar cursor al nodo |
| `reset_to(cursor)` | - | Reiniciar cursor a la posicion de otro cursor |
| `copy()` | `Cursor` | Crear copia del cursor |
| `close()` | - | Liberar recursos |

## Metadatos del lenguaje

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

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Lenguaje no soportado | `errors.INVALID` | no |
| Lenguaje sin binding | `errors.INVALID` | no |
| Patrón de consulta invalido | `errors.INVALID` | no |
| Posiciones invalidas | `errors.INVALID` | no |
| Parse fallido | `errors.INTERNAL` | no |
| Sin contexto de ejecución | `errors.INTERNAL` | no |

Cerrar un parser, árbol, consulta o cursor ya cerrado es seguro. Llamar a cualquier otro método de un handle cerrado genera un error de argumento Lua.

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.

## Referencia de sintaxis de consultas

Las consultas de Tree-sitter usan patrones S-expression:

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

Consulta [Sintaxis de consultas de Tree-sitter](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax) para ver la documentación completa.
