# Tree-sitter Parsing
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Parse source code into concrete syntax trees using [Tree-sitter](https://tree-sitter.github.io/tree-sitter/). Based on [go-tree-sitter](https://github.com/tree-sitter/go-tree-sitter) bindings.

Tree-sitter produces syntax trees that:
- Represent the full structure of source code
- Update incrementally as code changes
- Are robust to syntax errors (partial parsing)
- Support pattern-based queries using S-expressions

## Loading

```lua
local treesitter = require("treesitter")
```

## Supported Languages

| Language | Aliases | Root Node |
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

## Quick Start

### Parse Code

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
print(root:child_count()) -- number of top-level declarations
```

### Query Syntax Tree

```lua
local code = [[
func hello() {}
func world() {}
]]

local tree = treesitter.parse("go", code)
local root = tree:root_node()

-- Find all function names
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

### Simple Parse

Parse source code into a syntax tree. Creates a temporary parser internally.

```lua
local tree, err = treesitter.parse("go", code)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `language` | string | Language name or alias |
| `code` | string | Source code |

**Returns:** `Tree, error`

### Reusable Parser

Create a parser for repeated parsing or incremental updates.

```lua
local parser = treesitter.parser()
parser:set_language("go")

local tree1 = parser:parse("package main")

-- Incremental parse with old tree
local tree2 = parser:parse("package main\nfunc foo() {}", tree1)

parser:close()
```

**Returns:** `Parser`

### Parser Methods

| Method | Description |
|--------|-------------|
| `set_language(lang)` | Set parser language, returns `boolean, error` |
| `get_language()` | Get current language name |
| `parse(code, old_tree?)` | Parse code, optionally with old tree for incremental parsing |
| `set_timeout(duration)` | Set parse timeout (string like `"1s"` or nanoseconds) |
| `set_ranges(ranges)` | Set byte ranges to parse |
| `reset()` | Reset parser state |
| `close()` | Release parser resources |

## Syntax Trees

### Get Root Node

```lua
local tree = treesitter.parse("go", "package main")
local root = tree:root_node()

print(root:kind())  -- "source_file"
print(root:text())  -- "package main"
```

### Tree Methods

| Method | Description |
|--------|-------------|
| `root_node()` | Get root node of tree |
| `root_node_with_offset(bytes, point)` | Get root with offset applied |
| `language()` | Get tree's language object |
| `copy()` | Create deep copy of tree |
| `walk()` | Create cursor for traversal |
| `edit(edit_table)` | Apply incremental edit |
| `changed_ranges(other_tree)` | Get ranges that changed |
| `included_ranges()` | Get ranges included during parsing |
| `dot_graph()` | Get DOT graph representation |
| `close()` | Release tree resources |

### Incremental Editing

Update the tree when source code changes:

```lua
local code = "func main() { x := 1 }"
local tree = treesitter.parse("go", code)

-- Mark edit: changed "1" to "100" at byte 19
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

-- Re-parse with edited tree (faster than full parse)
local parser = treesitter.parser()
parser:set_language("go")
local new_tree = parser:parse("func main() { x := 100 }", tree)
```

## Nodes

Nodes represent elements in the syntax tree.

### Node Types

```lua
local node = root:child(0)

-- Type information
print(node:kind())        -- "package_clause"
print(node:type())        -- same as kind()
print(node:is_named())    -- true for significant nodes
print(node:grammar_name()) -- grammar rule name
```

### Navigation

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

### Position Information

```lua
-- Byte offsets
local start = node:start_byte()
local end_ = node:end_byte()

-- Row/column positions (0-based)
local start_pt = node:start_point()  -- {row = 0, column = 0}
local end_pt = node:end_point()      -- {row = 0, column = 12}

-- Source text
local text = node:text()
```

### Error Detection

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

Pattern matching using Tree-sitter's query language (S-expressions).

### Create Query

```lua
local query, err = treesitter.query("go", [[
    (function_declaration
        name: (identifier) @func_name
        parameters: (parameter_list) @params
    )
]])
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `language` | string | Language name |
| `pattern` | string | Query pattern in S-expression syntax |

**Returns:** `Query, error`

### Execute Query

```lua
-- Get all captures (flattened)
local captures = query:captures(root, source_code)
for _, capture in ipairs(captures) do
    print(capture.name)   -- "@func_name"
    print(capture.text)   -- actual text
    print(capture.index)  -- capture index
    -- capture.node is the Node object
end

-- Get matches (grouped by pattern)
local matches = query:matches(root, source_code)
for _, match in ipairs(matches) do
    print(match.id, match.pattern)
    for _, capture in ipairs(match.captures) do
        print(capture.name, capture.node:text())
    end
end
```

### Query Control

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

### Query Inspection

```lua
local pattern_count = query:pattern_count()
local capture_count = query:capture_count()
local name = query:capture_name_for_id(0)
local id = query:capture_index_for_name("func_name")
```

## Tree Cursor

Efficient traversal without creating node objects at each step.

### Basic Traversal

```lua
local cursor = tree:walk()

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

### Cursor Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `current_node()` | `Node` | Node at cursor position |
| `current_depth()` | `integer` | Depth (0 = root) |
| `current_field_name()` | `string?` | Field name if any |
| `goto_parent()` | `boolean` | Move to parent |
| `goto_first_child()` | `boolean` | Move to first child |
| `goto_last_child()` | `boolean` | Move to last child |
| `goto_next_sibling()` | `boolean` | Move to next sibling |
| `goto_previous_sibling()` | `boolean` | Move to previous sibling |
| `goto_first_child_for_byte(n)` | `integer?` | Move to child containing byte |
| `goto_first_child_for_point(pt)` | `integer?` | Move to child containing point |
| `reset(node)` | - | Reset cursor to node |
| `copy()` | `Cursor` | Create copy of cursor |
| `close()` | - | Release resources |

## Language Metadata

```lua
local lang = treesitter.language("go")

print(lang:version())           -- ABI version
print(lang:node_kind_count())   -- number of node types
print(lang:field_count())       -- number of fields

-- Node kind lookup
local kind = lang:node_kind_for_id(1)
local id = lang:id_for_node_kind("identifier", true)
local is_named = lang:node_kind_is_named(1)

-- Field lookup
local field_name = lang:field_name_for_id(1)
local field_id = lang:field_id_for_name("name")
```

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Language not supported | `errors.INVALID` | no |
| Language has no binding | `errors.INVALID` | no |
| Invalid query pattern | `errors.INVALID` | no |
| Invalid positions | `errors.INVALID` | no |
| Parse failed | `errors.INTERNAL` | no |

See [Error Handling](lua-errors.md) for working with errors.

## Query Syntax Reference

Tree-sitter queries use S-expression patterns:

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

See [Tree-sitter Query Syntax](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax) for complete documentation.
