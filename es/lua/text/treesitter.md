# Parsing Tree-sitter
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Parsear codigo fuente en arboles de sintaxis concretos usando [Tree-sitter](https://tree-sitter.github.io/tree-sitter/). Basado en bindings de [go-tree-sitter](https://github.com/tree-sitter/go-tree-sitter).

Tree-sitter produce arboles de sintaxis que:
- Representan la estructura completa del codigo fuente
- Se actualizan incrementalmente cuando el codigo cambia
- Son robustos ante errores de sintaxis (parsing parcial)
- Soportan consultas basadas en patrones usando S-expressions

## Carga

```lua
local treesitter = require("treesitter")
```

## Lenguajes Soportados

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

## Inicio Rapido

### Parsear Codigo

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
print(root:child_count()) -- numero de declaraciones de nivel superior
```

### Consultar Arbol de Sintaxis

```lua
local code = [[
func hello() {}
func world() {}
]]

local tree = treesitter.parse("go", code)
local root = tree:root_node()

-- Encontrar todos los nombres de funcion
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

### Parse Simple

Parsear codigo fuente en un arbol de sintaxis. Crea un parser temporal internamente.

```lua
local tree, err = treesitter.parse("go", code)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `language` | string | Nombre o alias de lenguaje |
| `code` | string | Codigo fuente |

**Devuelve:** `Tree, error`

### Parser Reutilizable

Crear un parser para parsing repetido o actualizaciones incrementales.

```lua
local parser = treesitter.parser()
parser:set_language("go")

local tree1 = parser:parse("package main")

-- Parse incremental con arbol anterior
local tree2 = parser:parse("package main\nfunc foo() {}", tree1)

parser:close()
```

**Devuelve:** `Parser`

### Metodos de Parser

| Metodo | Descripcion |
|--------|-------------|
| `set_language(lang)` | Establecer lenguaje del parser, devuelve `boolean, error` |
| `get_language()` | Obtener nombre de lenguaje actual |
| `parse(code, old_tree?)` | Parsear codigo, opcionalmente con arbol anterior para parsing incremental |
| `set_timeout(duration)` | Establecer timeout de parsing (string como `"1s"` o nanosegundos) |
| `set_ranges(ranges)` | Establecer rangos de bytes a parsear |
| `reset()` | Reiniciar estado del parser |
| `close()` | Liberar recursos del parser |

## Arboles de Sintaxis

### Obtener Nodo Raiz

```lua
local tree = treesitter.parse("go", "package main")
local root = tree:root_node()

print(root:kind())  -- "source_file"
print(root:text())  -- "package main"
```

### Metodos de Tree

| Metodo | Descripcion |
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

### Edicion Incremental

Actualizar el arbol cuando el codigo fuente cambia:

```lua
local code = "func main() { x := 1 }"
local tree = treesitter.parse("go", code)

-- Marcar edicion: cambio "1" a "100" en byte 19
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

-- Re-parsear con arbol editado (mas rapido que parse completo)
local parser = treesitter.parser()
parser:set_language("go")
local new_tree = parser:parse("func main() { x := 100 }", tree)
```

## Nodos

Los nodos representan elementos en el arbol de sintaxis.

### Tipos de Nodo

```lua
local node = root:child(0)

-- Informacion de tipo
print(node:kind())        -- "package_clause"
print(node:type())        -- igual que kind()
print(node:is_named())    -- true para nodos significativos
print(node:grammar_name()) -- nombre de regla gramatical
```

### Navegacion

```lua
-- Hijos
local child = node:child(0)           -- por indice (basado en 0)
local named = node:named_child(0)     -- solo hijos nombrados
local count = node:child_count()
local named_count = node:named_child_count()

-- Hermanos
local next = node:next_sibling()
local prev = node:prev_sibling()
local next_named = node:next_named_sibling()
local prev_named = node:prev_named_sibling()

-- Padre
local parent = node:parent()

-- Por nombre de campo
local name_node = func_decl:child_by_field_name("name")
local field = node:field_name_for_child(0)
```

### Informacion de Posicion

```lua
-- Offsets de byte
local start = node:start_byte()
local end_ = node:end_byte()

-- Posiciones fila/columna (basado en 0)
local start_pt = node:start_point()  -- {row = 0, column = 0}
local end_pt = node:end_point()      -- {row = 0, column = 12}

-- Texto fuente
local text = node:text()
```

### Deteccion de Errores

```lua
if root:has_error() then
    -- El arbol contiene errores de sintaxis
end

if node:is_error() then
    -- Este nodo especifico es un error
end

if node:is_missing() then
    -- El parser inserto esto para recuperarse del error
end
```

### S-Expression

```lua
local sexp = node:to_sexp()
-- "(source_file (package_clause (package_identifier)))"
```

## Consultas

Coincidencia de patrones usando el lenguaje de consultas de Tree-sitter (S-expressions).

### Crear Consulta

```lua
local query, err = treesitter.query("go", [[
    (function_declaration
        name: (identifier) @func_name
        parameters: (parameter_list) @params
    )
]])
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `language` | string | Nombre de lenguaje |
| `pattern` | string | Patron de consulta en sintaxis S-expression |

**Devuelve:** `Query, error`

### Ejecutar Consulta

```lua
-- Obtener todas las capturas (aplanadas)
local captures = query:captures(root, source_code)
for _, capture in ipairs(captures) do
    print(capture.name)   -- "@func_name"
    print(capture.text)   -- texto real
    print(capture.index)  -- indice de captura
    -- capture.node es el objeto Node
end

-- Obtener coincidencias (agrupadas por patron)
local matches = query:matches(root, source_code)
for _, match in ipairs(matches) do
    print(match.id, match.pattern)
    for _, capture in ipairs(match.captures) do
        print(capture.name, capture.node:text())
    end
end
```

### Control de Consulta

```lua
-- Limitar alcance de consulta
query:set_byte_range(0, 1000)
query:set_point_range({row = 0, column = 0}, {row = 10, column = 0})

-- Limitar coincidencias
query:set_match_limit(100)
if query:did_exceed_match_limit() then
    -- Existen mas coincidencias
end

-- Timeout (string de duracion o nanosegundos)
query:set_timeout("500ms")
query:set_timeout(1000000000)  -- 1 segundo en nanosegundos

-- Deshabilitar patrones/capturas
query:disable_pattern(0)
query:disable_capture("func_name")
```

### Inspeccion de Consulta

```lua
local pattern_count = query:pattern_count()
local capture_count = query:capture_count()
local name = query:capture_name_for_id(0)
local id = query:capture_index_for_name("func_name")
```

## Cursor de Arbol

Recorrido eficiente sin crear objetos nodo en cada paso.

### Recorrido Basico

```lua
local cursor = tree:walk()

-- Comenzar en raiz
print(cursor:current_node():kind())  -- "source_file"
print(cursor:current_depth())        -- 0

-- Navegar
if cursor:goto_first_child() then
    print(cursor:current_node():kind())
    print(cursor:current_depth())  -- 1
end

if cursor:goto_next_sibling() then
    -- movido al siguiente hermano
end

cursor:goto_parent()  -- volver al padre

cursor:close()
```

### Metodos de Cursor

| Metodo | Devuelve | Descripcion |
|--------|----------|-------------|
| `current_node()` | `Node` | Nodo en posicion del cursor |
| `current_depth()` | `integer` | Profundidad (0 = raiz) |
| `current_field_name()` | `string?` | Nombre de campo si hay |
| `goto_parent()` | `boolean` | Mover al padre |
| `goto_first_child()` | `boolean` | Mover al primer hijo |
| `goto_last_child()` | `boolean` | Mover al ultimo hijo |
| `goto_next_sibling()` | `boolean` | Mover al siguiente hermano |
| `goto_previous_sibling()` | `boolean` | Mover al hermano anterior |
| `goto_first_child_for_byte(n)` | `integer?` | Mover al hijo que contiene byte |
| `goto_first_child_for_point(pt)` | `integer?` | Mover al hijo que contiene punto |
| `reset(node)` | - | Reiniciar cursor al nodo |
| `copy()` | `Cursor` | Crear copia del cursor |
| `close()` | - | Liberar recursos |

## Metadatos de Lenguaje

```lua
local lang = treesitter.language("go")

print(lang:version())           -- version ABI
print(lang:node_kind_count())   -- numero de tipos de nodo
print(lang:field_count())       -- numero de campos

-- Busqueda de tipo de nodo
local kind = lang:node_kind_for_id(1)
local id = lang:id_for_node_kind("identifier", true)
local is_named = lang:node_kind_is_named(1)

-- Busqueda de campo
local field_name = lang:field_name_for_id(1)
local field_id = lang:field_id_for_name("name")
```

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Lenguaje no soportado | `errors.INVALID` | no |
| Lenguaje sin binding | `errors.INVALID` | no |
| Patron de consulta invalido | `errors.INVALID` | no |
| Posiciones invalidas | `errors.INVALID` | no |
| Parse fallido | `errors.INTERNAL` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.

## Referencia de Sintaxis de Consultas

Las consultas de Tree-sitter usan patrones S-expression:

```
; Coincidir un tipo de nodo
(identifier)

; Coincidir con nombres de campo
(function_declaration name: (identifier))

; Capturar con @nombre
(function_declaration name: (identifier) @func_name)

; Multiples patrones
[
  (function_declaration)
  (method_declaration)
] @declaration

; Comodines
(_)           ; cualquier nodo
(identifier)+ ; uno o mas
(identifier)* ; cero o mas
(identifier)? ; opcional

; Predicados
((identifier) @var
  (#match? @var "^_"))  ; coincidencia regex
```

Consulte [Sintaxis de Consultas Tree-sitter](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax) para documentacion completa.
