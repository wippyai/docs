# 文本处理
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

正则表达式、文本差异比较和语义文本分割。

## 加载

```lua
local text = require("text")
```

## 正则表达式

### 编译

```lua
local re, err = text.regexp.compile("[0-9]+")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `pattern` | string | RE2 兼容的正则表达式模式 |

**返回值:** `Regexp, error`

### 匹配

```lua
local ok = re:match_string("abc123")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `s` | string | 要匹配的字符串 |

**返回值:** `boolean`

### 查找

```lua
local match = re:find_string("abc123def")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `s` | string | 要搜索的字符串 |

**返回值:** `string | nil`

### 查找全部

```lua
local matches = re:find_all_string("a1b2c3")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `s` | string | 要搜索的字符串 |

**返回值:** `string[]`

### 带分组查找

```lua
local match = re:find_string_submatch("user@example.com")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `s` | string | 要搜索的字符串 |

**返回值:** `string[] | nil` (完整匹配 + 捕获组)

### 查找全部带分组

```lua
local matches = re:find_all_string_submatch("a=1 b=2")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `s` | string | 要搜索的字符串 |

**返回值:** `string[][]`

### 查找索引

```lua
local pos = re:find_string_index("abc123")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `s` | string | 要搜索的字符串 |

**返回值:** `table | nil` ({start, end}，从 1 开始)

### 查找全部索引

```lua
local positions = re:find_all_string_index("a1b2c3")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `s` | string | 要搜索的字符串 |

**返回值:** `table[]`

### 替换

```lua
local result = re:replace_all_string("a1b2", "X")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `s` | string | 输入字符串 |
| `repl` | string | 替换字符串 |

**返回值:** `string`

### 分割

```lua
local parts = re:split("a,b,c", -1)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `s` | string | 要分割的字符串 |
| `n` | integer | 最大分割数，-1 表示全部 |

**返回值:** `string[]`

### 子表达式数量

```lua
local count = re:num_subexp()
```

**返回值:** `number`

### 子表达式名称

```lua
local names = re:subexp_names()
```

**返回值:** `string[]`

### 模式字符串

```lua
local pattern = re:string()
```

**返回值:** `string`

## 文本差异比较

比较文本版本并生成补丁。基于 [go-diff](https://github.com/sergi/go-diff) (Google 的 diff-match-patch)。

### 创建 Differ

```lua
local diff, err = text.diff.new()
local diff, err = text.diff.new(options)
```

**返回值:** `Differ, error`

#### 选项 {id="diff-options"}

| 字段 | 类型 | 默认值 | 描述 |
|-------|------|---------|-------------|
| `diff_timeout` | number | 1.0 | 超时时间（秒） |
| `diff_edit_cost` | integer | 4 | 空编辑的代价 |
| `match_threshold` | number | 0.5 | 匹配容差 0-1 |
| `match_distance` | integer | 1000 | 搜索匹配的距离 |
| `patch_delete_threshold` | number | 0.5 | 删除阈值 |
| `patch_margin` | integer | 4 | 上下文边距 |

### 比较

查找两个文本之间的差异。返回描述如何将 text1 转换为 text2 的操作数组。

```lua
local diff, _ = text.diff.new()
local diffs, err = diff:compare("hello world", "hello there")

-- diffs 包含：
-- {operation = "equal", text = "hello "}
-- {operation = "delete", text = "world"}
-- {operation = "insert", text = "there"}
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `text1` | string | 原始文本 |
| `text2` | string | 修改后的文本 |

**返回值:** `table, error` ({operation, text} 数组)

操作类型: `"equal"`, `"delete"`, `"insert"`

### 汇总

统计版本之间更改的字符数。

```lua
local diffs, _ = diff:compare("hello world", "hello there")
local summary = diff:summarize(diffs)

-- summary.equals = 6 (未更改的字符)
-- summary.deletions = 5 (删除的字符)
-- summary.insertions = 5 (添加的字符)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `diffs` | table | 来自 compare 的差异数组 |

**返回值:** `table` ({insertions, deletions, equals})

### 美化文本

使用 ANSI 颜色格式化差异以便终端显示。

```lua
local formatted, err = diff:pretty_text(diffs)
print(formatted)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `diffs` | table | 来自 compare 的差异数组 |

**返回值:** `string, error`

### 美化 HTML

使用 `<del>` 和 `<ins>` 标签将差异格式化为 HTML。

```lua
local html, err = diff:pretty_html(diffs)
-- 返回: "hello <del>world</del><ins>there</ins>"
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `diffs` | table | 来自 compare 的差异数组 |

**返回值:** `string, error`

### 创建补丁

生成可用于将一个文本转换为另一个文本的补丁。补丁可以序列化并稍后应用。

```lua
local text1 = "The quick brown fox jumps over the lazy dog"
local text2 = "The quick red fox jumps over the lazy cat"

local patches, err = diff:patch_make(text1, text2)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `text1` | string | 原始文本 |
| `text2` | string | 修改后的文本 |

**返回值:** `table, error`

### 应用补丁

应用补丁来转换文本。返回结果以及所有补丁是否成功应用。

```lua
local result, success = diff:patch_apply(patches, text1)
-- result = "The quick red fox jumps over the lazy cat"
-- success = true
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `patches` | table | 来自 patch_make 的补丁 |
| `text` | string | 要应用补丁的文本 |

**返回值:** `string, boolean`

## 文本分割

将大型文档分割成较小的块，同时保留语义边界。基于 [langchaingo](https://github.com/tmc/langchaingo) 文本分割器。

### 递归分割器

使用分隔符层次结构分割文本。首先尝试按双换行符（段落）分割，然后是单换行符、空格、最后是字符。当块超过大小限制时，回退到较小的分隔符。

```lua
local splitter, err = text.splitter.recursive({
    chunk_size = 1000,
    chunk_overlap = 100
})

local long_text = "This is a long text that needs splitting..."
local chunks, err = splitter:split_text(long_text)
-- chunks = {"This is a long...", "...text that needs...", "...splitting..."}
```

**返回值:** `Splitter, error`

#### 选项 {id="recursive-splitter-options"}

| 字段 | 类型 | 默认值 | 描述 |
|-------|------|---------|-------------|
| `chunk_size` | integer | 4000 | 每个块的最大字符数 |
| `chunk_overlap` | integer | 200 | 相邻块之间重复的字符数 |
| `keep_separator` | boolean | false | 在输出中保留分隔符 |
| `separators` | string[] | nil | 自定义分隔符列表 |

### Markdown 分割器

分割 Markdown 文档，同时尊重其结构。尝试将标题与其内容保持在一起，保持代码块完整，并将表格行保持在一起。

```lua
local splitter, err = text.splitter.markdown({
    chunk_size = 2000,
    code_blocks = true,
    heading_hierarchy = true
})

local readme = fs.read("README.md")
local chunks, err = splitter:split_text(readme)
```

**返回值:** `Splitter, error`

#### 选项 {id="markdown-splitter-options"}

| 字段 | 类型 | 默认值 | 描述 |
|-------|------|---------|-------------|
| `chunk_size` | integer | 4000 | 每个块的最大字符数 |
| `chunk_overlap` | integer | 200 | 相邻块之间重复的字符数 |
| `code_blocks` | boolean | false | 保持代码块在一起 |
| `reference_links` | boolean | false | 保留引用链接 |
| `heading_hierarchy` | boolean | false | 尊重标题层级 |
| `join_table_rows` | boolean | false | 保持表格行在一起 |

### 分割文本

将单个文档分割成块数组。

```lua
local chunks, err = splitter:split_text(document)

for i, chunk in ipairs(chunks) do
    -- 处理每个块（例如，创建 embedding，发送给 LLM）
    process(chunk)
end
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `text` | string | 要分割的文本 |

**返回值:** `string[], error`

### 批量分割

分割多个文档，同时保留其元数据。每个输入文档可以产生多个输出块。所有块都继承其源文档的元数据。

```lua
-- 输入：带有页码的 PDF 页面
local pages = {
    {content = "First page content...", metadata = {page = 1}},
    {content = "Second page content...", metadata = {page = 2}}
}

local chunks, err = splitter:split_batch(pages)

-- 输出：每个块知道它来自哪一页
for _, chunk in ipairs(chunks) do
    print("Page " .. chunk.metadata.page .. ": " .. chunk.content:sub(1, 50))
end
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `pages` | table | {content, metadata} 数组 |

**返回值:** `table, error` ({content, metadata} 数组)

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 无效的模式语法 | `errors.INVALID` | 否 |
| 内部错误 | `errors.INTERNAL` | 否 |

参见 [错误处理](lua/core/errors.md) 了解如何处理错误。
