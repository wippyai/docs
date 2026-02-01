# HTML 过滤
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

过滤不受信任的 HTML 以防止 XSS 攻击。基于 [bluemonday](https://github.com/microcosm-cc/bluemonday)。

过滤通过解析 HTML 并通过白名单策略进行过滤来工作。未明确允许的元素和属性会被移除。输出始终是格式良好的 HTML。

## 加载

```lua
local html = require("html")
```

## 预设策略

三个内置策略用于常见场景：

| 策略 | 用途 | 允许内容 |
|--------|----------|--------|
| `new_policy` | 自定义过滤 | 无（从头构建） |
| `ugc_policy` | 用户评论、论坛 | 常见格式化（`p`、`b`、`i`、`a`、列表等） |
| `strict_policy` | 纯文本提取 | 无（移除所有 HTML） |

### 空策略

创建一个不允许任何内容的策略。用于从头构建自定义白名单。

```lua
local policy, err = html.sanitize.new_policy()

policy:allow_elements("p", "strong", "em")
policy:allow_attrs("class"):globally()

local clean = policy:sanitize(user_input)
```

**返回:** `Policy, error`

### 用户内容策略

为用户生成内容预配置。允许常见的格式化元素。

```lua
local policy = html.sanitize.ugc_policy()

local safe = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'

local xss = policy:sanitize('<p>Hello <script>alert("xss")</script></p>')
-- '<p>Hello </p>'
```

**返回:** `Policy, error`

### 严格策略

移除所有 HTML，仅返回纯文本。

```lua
local policy = html.sanitize.strict_policy()

local text = policy:sanitize('<p>Hello <b>world</b>!</p>')
-- 'Hello world!'
```

**返回:** `Policy, error`

## 元素控制

### 允许元素

将特定 HTML 元素加入白名单。

```lua
local policy = html.sanitize.new_policy()
policy:allow_elements("p", "strong", "em", "br")
policy:allow_elements("h1", "h2", "h3")
policy:allow_elements("a", "img")

local result = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `...` | string | 元素标签名 |

**返回:** `Policy`

## 属性控制

### 允许属性

开始属性权限配置。链式调用 `on_elements()` 或 `globally()`。

```lua
policy:allow_attrs("href"):on_elements("a")
policy:allow_attrs("src", "alt"):on_elements("img")
policy:allow_attrs("class", "id"):globally()
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `...` | string | 属性名 |

**返回:** `AttrBuilder`

### 在特定元素上

仅在特定元素上允许属性。

```lua
policy:allow_elements("a", "img")
policy:allow_attrs("href", "target"):on_elements("a")
policy:allow_attrs("src", "alt", "width", "height"):on_elements("img")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `...` | string | 元素标签名 |

**返回:** `Policy`

### 在所有元素上

在任何允许的元素上全局允许属性。

```lua
policy:allow_attrs("class"):globally()
policy:allow_attrs("id"):globally()
```

**返回:** `Policy`

### 使用模式匹配

根据正则表达式模式验证属性值。

```lua
-- Only allow hex colors in style
local builder, err = policy:allow_attrs("style"):matching("^color:#[0-9a-fA-F]{6}$")
if err then
    return nil, err
end
builder:on_elements("span")

policy:sanitize('<span style="color:#ff0000">Red</span>')
-- '<span style="color:#ff0000">Red</span>'

policy:sanitize('<span style="background:red">Bad</span>')
-- '<span>Bad</span>'
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `pattern` | string | 正则表达式模式 |

**返回:** `AttrBuilder, error`

## URL 安全

### 标准 URL

启用带安全默认值的 URL 处理。

```lua
policy:allow_elements("a")
policy:allow_attrs("href"):on_elements("a")
policy:allow_standard_urls()
```

**返回:** `Policy`

### URL 协议

限制允许哪些 URL 协议。

```lua
policy:allow_url_schemes("https", "mailto")

policy:sanitize('<a href="https://example.com">OK</a>')
-- '<a href="https://example.com">OK</a>'

policy:sanitize('<a href="javascript:alert(1)">XSS</a>')
-- '<a>XSS</a>'
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `...` | string | 允许的协议 |

**返回:** `Policy`

### 相对 URL

允许或禁止相对 URL。

```lua
policy:allow_relative_urls(true)

policy:sanitize('<a href="/page">Link</a>')
-- '<a href="/page">Link</a>'
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `allow` | boolean | 允许相对 URL |

**返回:** `Policy`

### Nofollow 链接

为所有链接添加 `rel="nofollow"`。防止 SEO 垃圾信息。

```lua
policy:allow_attrs("href", "rel"):on_elements("a")
policy:require_nofollow_on_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" rel="nofollow">Link</a>'
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `require` | boolean | 添加 nofollow |

**返回:** `Policy`

### Noreferrer 链接

为所有链接添加 `rel="noreferrer"`。防止引用来源泄露。

```lua
policy:require_noreferrer_on_links(true)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `require` | boolean | 添加 noreferrer |

**返回:** `Policy`

### 外部链接在新标签页打开

为完整 URL 添加 `target="_blank"`。

```lua
policy:allow_attrs("href", "target"):on_elements("a")
policy:add_target_blank_to_fully_qualified_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" target="_blank">Link</a>'
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `add` | boolean | 添加 target blank |

**返回:** `Policy`

## 便捷方法

### 允许图片

允许带标准属性的 `<img>`。

```lua
policy:allow_images()

policy:sanitize('<img src="photo.jpg" alt="Photo">')
-- '<img src="photo.jpg" alt="Photo">'
```

**返回:** `Policy`

### 允许 Data URI 图片

允许 base64 嵌入图片。

```lua
policy:allow_elements("img")
policy:allow_attrs("src"):on_elements("img")
policy:allow_data_uri_images()

policy:sanitize('<img src="data:image/png;base64,iVBORw...">')
-- '<img src="data:image/png;base64,iVBORw...">'
```

**返回:** `Policy`

### 允许列表

允许列表元素：`ul`、`ol`、`li`、`dl`、`dt`、`dd`。

```lua
policy:allow_lists()

policy:sanitize('<ul><li>Item 1</li><li>Item 2</li></ul>')
-- '<ul><li>Item 1</li><li>Item 2</li></ul>'
```

**返回:** `Policy`

### 允许表格

允许表格元素：`table`、`thead`、`tbody`、`tfoot`、`tr`、`td`、`th`、`caption`。

```lua
policy:allow_tables()

policy:sanitize('<table><tr><td>Cell</td></tr></table>')
-- '<table><tr><td>Cell</td></tr></table>'
```

**返回:** `Policy`

### 允许标准属性

允许常见属性：`id`、`class`、`title`、`dir`、`lang`。

```lua
policy:allow_elements("p")
policy:allow_standard_attributes()

policy:sanitize('<p id="intro" class="text" title="Introduction">Hello</p>')
-- '<p id="intro" class="text" title="Introduction">Hello</p>'
```

**返回:** `Policy`

## 过滤

将策略应用于 HTML 字符串。

```lua
local policy = html.sanitize.ugc_policy()
policy:require_nofollow_on_links(true)

local dirty = '<p>Hello</p><script>alert("xss")</script>'
local clean = policy:sanitize(dirty)
-- '<p>Hello</p>'
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `html` | string | 要过滤的 HTML |

**返回:** `string`

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 无效的正则表达式模式 | `errors.INVALID` | 否 |

参见 [错误处理](lua/core/errors.md) 了解错误处理方法。
