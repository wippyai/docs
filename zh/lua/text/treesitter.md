# Tree-sitter 解析
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

使用 [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) 将源代码解析为具体语法树。基于 [go-tree-sitter](https://github.com/tree-sitter/go-tree-sitter) 绑定。

Tree-sitter 生成的语法树具有以下特点：
- 表示源代码的完整结构
- 随着代码更改增量更新
- 对语法错误具有鲁棒性（部分解析）
- 支持使用 S-expression 进行模式查询

## 加载

```lua
local treesitter = require("treesitter")
```

## 支持的语言

| 语言 | 别名 | 根节点 |
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

## 快速开始

### 解析代码

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
print(root:child_count()) -- 顶级声明的数量
```

### 查询语法树

```lua
local code = [[
func hello() {}
func world() {}
]]

local tree = treesitter.parse("go", code)
local root = tree:root_node()

-- 查找所有函数名
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

## 解析

### 简单解析

将源代码解析为语法树。内部创建临时解析器。

```lua
local tree, err = treesitter.parse("go", code)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `language` | string | 语言名称或别名 |
| `code` | string | 源代码 |

**返回值:** `Tree, error`

### 可重用解析器

创建解析器用于重复解析或增量更新。

```lua
local parser = treesitter.parser()
parser:set_language("go")

local tree1 = parser:parse("package main")

-- 使用旧树进行增量解析
local tree2 = parser:parse("package main\nfunc foo() {}", tree1)

parser:close()
```

**返回值:** `Parser`

### 解析器方法

| 方法 | 描述 |
|--------|-------------|
| `set_language(lang)` | 设置解析器语言，返回 `boolean, error` |
| `get_language()` | 获取当前语言名称 |
| `parse(code, old_tree?)` | 解析代码，可选使用旧树进行增量解析 |
| `set_timeout(duration)` | 设置解析超时（如 `"1s"` 或纳秒） |
| `set_ranges(ranges)` | 设置要解析的字节范围 |
| `reset()` | 重置解析器状态 |
| `close()` | 释放解析器资源 |

## 语法树

### 获取根节点

```lua
local tree = treesitter.parse("go", "package main")
local root = tree:root_node()

print(root:kind())  -- "source_file"
print(root:text())  -- "package main"
```

### Tree 方法

| 方法 | 描述 |
|--------|-------------|
| `root_node()` | 获取树的根节点 |
| `root_node_with_offset(bytes, point)` | 获取应用偏移量的根节点 |
| `language()` | 获取树的语言对象 |
| `copy()` | 创建树的深拷贝 |
| `walk()` | 创建用于遍历的游标 |
| `edit(edit_table)` | 应用增量编辑 |
| `changed_ranges(other_tree)` | 获取更改的范围 |
| `included_ranges()` | 获取解析期间包含的范围 |
| `dot_graph()` | 获取 DOT 图表示 |
| `close()` | 释放树资源 |

### 增量编辑

当源代码更改时更新树：

```lua
local code = "func main() { x := 1 }"
local tree = treesitter.parse("go", code)

-- 标记编辑：在字节 19 处将 "1" 更改为 "100"
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

-- 使用编辑后的树重新解析（比完整解析更快）
local parser = treesitter.parser()
parser:set_language("go")
local new_tree = parser:parse("func main() { x := 100 }", tree)
```

## 节点

节点表示语法树中的元素。

### 节点类型

```lua
local node = root:child(0)

-- 类型信息
print(node:kind())        -- "package_clause"
print(node:type())        -- 与 kind() 相同
print(node:is_named())    -- 对于重要节点为 true
print(node:grammar_name()) -- 语法规则名称
```

### 导航

```lua
-- 子节点
local child = node:child(0)           -- 按索引（从 0 开始）
local named = node:named_child(0)     -- 仅命名子节点
local count = node:child_count()
local named_count = node:named_child_count()

-- 兄弟节点
local next = node:next_sibling()
local prev = node:prev_sibling()
local next_named = node:next_named_sibling()
local prev_named = node:prev_named_sibling()

-- 父节点
local parent = node:parent()

-- 按字段名
local name_node = func_decl:child_by_field_name("name")
local field = node:field_name_for_child(0)
```

### 位置信息

```lua
-- 字节偏移
local start = node:start_byte()
local end_ = node:end_byte()

-- 行/列位置（从 0 开始）
local start_pt = node:start_point()  -- {row = 0, column = 0}
local end_pt = node:end_point()      -- {row = 0, column = 12}

-- 源文本
local text = node:text()
```

### 错误检测

```lua
if root:has_error() then
    -- 树包含语法错误
end

if node:is_error() then
    -- 此特定节点是错误
end

if node:is_missing() then
    -- 解析器插入此节点以从错误中恢复
end
```

### S-Expression

```lua
local sexp = node:to_sexp()
-- "(source_file (package_clause (package_identifier)))"
```

## 查询

使用 Tree-sitter 的查询语言（S-expression）进行模式匹配。

### 创建查询

```lua
local query, err = treesitter.query("go", [[
    (function_declaration
        name: (identifier) @func_name
        parameters: (parameter_list) @params
    )
]])
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `language` | string | 语言名称 |
| `pattern` | string | S-expression 语法的查询模式 |

**返回值:** `Query, error`

### 执行查询

```lua
-- 获取所有捕获（扁平化）
local captures = query:captures(root, source_code)
for _, capture in ipairs(captures) do
    print(capture.name)   -- "@func_name"
    print(capture.text)   -- 实际文本
    print(capture.index)  -- 捕获索引
    -- capture.node 是 Node 对象
end

-- 获取匹配（按模式分组）
local matches = query:matches(root, source_code)
for _, match in ipairs(matches) do
    print(match.id, match.pattern)
    for _, capture in ipairs(match.captures) do
        print(capture.name, capture.node:text())
    end
end
```

### 查询控制

```lua
-- 限制查询范围
query:set_byte_range(0, 1000)
query:set_point_range({row = 0, column = 0}, {row = 10, column = 0})

-- 限制匹配数
query:set_match_limit(100)
if query:did_exceed_match_limit() then
    -- 存在更多匹配
end

-- 超时（字符串持续时间或纳秒）
query:set_timeout("500ms")
query:set_timeout(1000000000)  -- 1 秒（纳秒）

-- 禁用模式/捕获
query:disable_pattern(0)
query:disable_capture("func_name")
```

### 查询检查

```lua
local pattern_count = query:pattern_count()
local capture_count = query:capture_count()
local name = query:capture_name_for_id(0)
local id = query:capture_index_for_name("func_name")
```

## 树游标

无需在每一步创建节点对象的高效遍历。

### 基本遍历

```lua
local cursor = tree:walk()

-- 从根开始
print(cursor:current_node():kind())  -- "source_file"
print(cursor:current_depth())        -- 0

-- 导航
if cursor:goto_first_child() then
    print(cursor:current_node():kind())
    print(cursor:current_depth())  -- 1
end

if cursor:goto_next_sibling() then
    -- 移动到下一个兄弟节点
end

cursor:goto_parent()  -- 返回父节点

cursor:close()
```

### 游标方法

| 方法 | 返回值 | 描述 |
|--------|---------|-------------|
| `current_node()` | `Node` | 游标位置的节点 |
| `current_depth()` | `integer` | 深度（0 = 根） |
| `current_field_name()` | `string?` | 字段名（如果有） |
| `goto_parent()` | `boolean` | 移动到父节点 |
| `goto_first_child()` | `boolean` | 移动到第一个子节点 |
| `goto_last_child()` | `boolean` | 移动到最后一个子节点 |
| `goto_next_sibling()` | `boolean` | 移动到下一个兄弟节点 |
| `goto_previous_sibling()` | `boolean` | 移动到上一个兄弟节点 |
| `goto_first_child_for_byte(n)` | `integer?` | 移动到包含该字节的子节点 |
| `goto_first_child_for_point(pt)` | `integer?` | 移动到包含该点的子节点 |
| `reset(node)` | - | 将游标重置到节点 |
| `copy()` | `Cursor` | 创建游标副本 |
| `close()` | - | 释放资源 |

## 语言元数据

```lua
local lang = treesitter.language("go")

print(lang:version())           -- ABI 版本
print(lang:node_kind_count())   -- 节点类型数量
print(lang:field_count())       -- 字段数量

-- 节点类型查找
local kind = lang:node_kind_for_id(1)
local id = lang:id_for_node_kind("identifier", true)
local is_named = lang:node_kind_is_named(1)

-- 字段查找
local field_name = lang:field_name_for_id(1)
local field_id = lang:field_id_for_name("name")
```

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 不支持的语言 | `errors.INVALID` | 否 |
| 语言没有绑定 | `errors.INVALID` | 否 |
| 无效的查询模式 | `errors.INVALID` | 否 |
| 无效的位置 | `errors.INVALID` | 否 |
| 解析失败 | `errors.INTERNAL` | 否 |

参见 [错误处理](lua/core/errors.md) 了解如何处理错误。

## 查询语法参考

Tree-sitter 查询使用 S-expression 模式：

```
; 匹配节点类型
(identifier)

; 使用字段名匹配
(function_declaration name: (identifier))

; 使用 @name 捕获
(function_declaration name: (identifier) @func_name)

; 多个模式
[
  (function_declaration)
  (method_declaration)
] @declaration

; 通配符
(_)           ; 任意节点
(identifier)+ ; 一个或多个
(identifier)* ; 零个或多个
(identifier)? ; 可选

; 谓词
((identifier) @var
  (#match? @var "^_"))  ; 正则匹配
```

完整文档请参见 [Tree-sitter 查询语法](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax)。
