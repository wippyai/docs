---
title: "Text Processing"
description: "Compile regular expressions, compare text, create patches, and split documents into chunks."
---

# Text Processing
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

The `text` module provides regular expressions, text comparison and patching, and document splitting.

## Loading

```lua
local text = require("text")
```

## Regular Expressions

### Compile

```lua
local re, err = text.regexp.compile("[0-9]+")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pattern` | string | RE2 compatible regex pattern |

**Returns:** `Regexp, error`

### Match

```lua
local ok = re:match_string("abc123")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `s` | string | String to match |

**Returns:** `boolean`

### Find

```lua
local match = re:find_string("abc123def")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `s` | string | String to search |

**Returns:** `string | nil`

### Find All

```lua
local matches = re:find_all_string("a1b2c3")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `s` | string | String to search |

**Returns:** `string[]`

### Find with Groups

```lua
local match = re:find_string_submatch("user@example.com")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `s` | string | String to search |

**Returns:** `string[] | nil` (full match + capture groups)

### Find All with Groups

```lua
local matches = re:find_all_string_submatch("a=1 b=2")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `s` | string | String to search |

**Returns:** `string[][]`

### Find Index

```lua
local pos = re:find_string_index("abc123")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `s` | string | String to search |

**Returns:** `table | nil` ({start, end}, 1-based)

### Find All Index

```lua
local positions = re:find_all_string_index("a1b2c3")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `s` | string | String to search |

**Returns:** `table[] | nil` (nil when there are no matches)

### Replace

```lua
local result = re:replace_all_string("a1b2", "X")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `s` | string | Input string |
| `repl` | string | Replacement string |

**Returns:** `string`

### Split

```lua
local parts = re:split("a,b,c", -1)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `s` | string | String to split |
| `n` | integer | Max parts, -1 for all |

**Returns:** `string[]`

### Subexpression Count

```lua
local count = re:num_subexp()
```

**Returns:** `number`

### Subexpression Names

```lua
local names = re:subexp_names()
```

**Returns:** `string[]`

### Pattern String

```lua
local pattern = re:string()
```

**Returns:** `string`

## Text Diffing

Compare text versions and generate patches with [go-diff](https://github.com/sergi/go-diff), an implementation of Google's diff-match-patch algorithm.

### Creating a Differ

```lua
local diff, err = text.diff.new()
local diff, err = text.diff.new(options)
```

**Returns:** `Differ, error`

#### Options {id="diff-options"}

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `diff_timeout` | number | 1.0 | Timeout in seconds |
| `diff_edit_cost` | integer | 4 | Cost of an empty edit |
| `match_threshold` | number | 0.5 | Match tolerance 0-1 |
| `match_distance` | integer | 1000 | Distance to search for match |
| `patch_delete_threshold` | number | 0.5 | Delete threshold |
| `patch_margin` | integer | 4 | Context margin |

### Compare

Compare two strings and return operations that transform `text1` into `text2`.

```lua
local diff, _ = text.diff.new()
local diffs, err = diff:compare("hello world", "hello there")

-- diffs contains:
-- {operation = "equal", text = "hello "}
-- {operation = "delete", text = "world"}
-- {operation = "insert", text = "there"}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `text1` | string | Original text |
| `text2` | string | Modified text |

**Returns:** `table, error` (array of {operation, text})

Operations: `"equal"`, `"delete"`, `"insert"`

### Summarize

Count the unchanged, inserted, and deleted characters.

```lua
local diffs, _ = diff:compare("hello world", "hello there")
local summary = diff:summarize(diffs)

-- summary.equals = 6 (characters unchanged)
-- summary.deletions = 5 (characters removed)
-- summary.insertions = 5 (characters added)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `diffs` | table | Diff array from compare |

**Returns:** `table` ({insertions, deletions, equals})

### Pretty Text

Format a diff with ANSI colors for terminal output.

```lua
local formatted, err = diff:pretty_text(diffs)
print(formatted)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `diffs` | table | Diff array from compare |

**Returns:** `string, error`

### Pretty HTML

Format a diff as HTML with `<del>` and `<ins>` elements.

```lua
local html, err = diff:pretty_html(diffs)
-- Returns: "hello <del>world</del><ins>there</ins>"
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `diffs` | table | Diff array from compare |

**Returns:** `string, error`

### Create Patches

Create patches that transform one string into another. The patches can be serialized and applied later.

```lua
local text1 = "The quick brown fox jumps over the lazy dog"
local text2 = "The quick red fox jumps over the lazy cat"

local patches, err = diff:patch_make(text1, text2)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `text1` | string | Original text |
| `text2` | string | Modified text |

**Returns:** `table, error`

### Apply Patches

Apply patches to a string and return the result and whether every patch succeeded.

```lua
local result, success = diff:patch_apply(patches, text1)
-- result = "The quick red fox jumps over the lazy cat"
-- success = true
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `patches` | table | Patches from patch_make |
| `text` | string | Text to apply patches to |

**Returns:** `string, boolean`

## Text Splitting

Split documents into chunks while preserving semantic boundaries. The splitters are based on the [langchaingo](https://github.com/tmc/langchaingo) implementation.

### Recursive Splitter

The recursive splitter tries double newlines, single newlines, spaces, and then individual characters. It moves to the next separator when a chunk exceeds the size limit.

```lua
local splitter, err = text.splitter.recursive({
    chunk_size = 1000,
    chunk_overlap = 100
})

local long_text = "This is a long text that needs splitting..."
local chunks, err = splitter:split_text(long_text)
-- chunks = {"This is a long...", "...text that needs...", "...splitting..."}
```

**Returns:** `Splitter, error`

#### Options {id="recursive-splitter-options"}

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `chunk_size` | integer | 512 | Max characters per chunk |
| `chunk_overlap` | integer | 100 | Characters repeated between adjacent chunks |
| `keep_separator` | boolean | false | Keep separators in output |
| `separators` | string[] | nil | Custom separator list |

### Markdown Splitter

The Markdown splitter can keep headings with their content, preserve code blocks, and group table rows.

```lua
local splitter, err = text.splitter.markdown({
    chunk_size = 2000,
    code_blocks = true,
    heading_hierarchy = true
})

local readme = fs.read("README.md")
local chunks, err = splitter:split_text(readme)
```

**Returns:** `Splitter, error`

#### Options {id="markdown-splitter-options"}

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `chunk_size` | integer | 512 | Max characters per chunk |
| `chunk_overlap` | integer | 100 | Characters repeated between adjacent chunks |
| `code_blocks` | boolean | false | Keep code blocks together |
| `reference_links` | boolean | false | Preserve reference links |
| `heading_hierarchy` | boolean | false | Respect heading levels |
| `join_table_rows` | boolean | false | Keep table rows together |

### Split Text

Split a single document into an array of chunks.

```lua
local chunks, err = splitter:split_text(document)

for i, chunk in ipairs(chunks) do
    -- Process each chunk (e.g., create embedding, send to LLM)
    process(chunk)
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | string | Text to split |

**Returns:** `string[], error`

### Split Batch

Split multiple documents while preserving their metadata. One input document can produce several chunks, each with the source document's metadata.

```lua
-- Input: pages from a PDF with page numbers
local pages = {
    {content = "First page content...", metadata = {page = 1}},
    {content = "Second page content...", metadata = {page = 2}}
}

local chunks, err = splitter:split_batch(pages)

-- Output: each chunk knows which page it came from
for _, chunk in ipairs(chunks) do
    print("Page " .. chunk.metadata.page .. ": " .. chunk.content:sub(1, 50))
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pages` | table | Array of {content, metadata} |

**Returns:** `table, error` (array of {content, metadata})

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Invalid pattern syntax | `errors.INVALID` | no |
| Internal error | `errors.INTERNAL` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
