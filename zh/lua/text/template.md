# 模板引擎
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="external"/>

使用 [Jet 模板引擎](https://github.com/CloudyKit/jet) 渲染动态内容。使用模板继承和包含构建 HTML 页面、电子邮件和文档。

关于模板集配置，请参见 [模板引擎](system/template.md)。

## 加载

```lua
local templates = require("templates")
```

## 获取模板集

通过注册表 ID 获取模板集以开始渲染：

```lua
local set, err = templates.get("app.views:emails")
if err then
    return nil, err
end

-- 使用模板集...

set:release()
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `id` | string | 模板集注册表 ID |

**返回值:** `Set, error`

## 渲染模板

使用数据按名称渲染模板：

```lua
local set = templates.get("app.views:emails")

local html, err = set:render("welcome", {
    user = {name = "Alice", email = "alice@example.com"},
    activation_url = "https://example.com/activate?token=abc"
})

if err then
    set:release()
    return nil, err
end

set:release()
return html
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `name` | string | 模板集中的模板名称 |
| `data` | table | 传递给模板的变量（可选） |

**返回值:** `string, error`

## Set 方法

| 方法 | 返回值 | 描述 |
|--------|---------|-------------|
| `render(name, data?)` | `string, error` | 使用数据渲染模板 |
| `release()` | `boolean` | 将模板集释放回池 |

## Jet 语法参考

Jet 使用 `{{ }}` 表示表达式和控制结构，`{* *}` 表示注释。

### 变量

```html
{{ user.name }}
{{ user.email }}
{{ items[0].price }}
```

### 条件

```html
{{ if order.shipped }}
    <p>Shipped!</p>
{{ else if order.processing }}
    <p>Processing...</p>
{{ else }}
    <p>Received.</p>
{{ end }}
```

### 循环

```html
{{ range items }}
    <li>{{ .name }} - ${{ .price }}</li>
{{ end }}

{{ range i, item := items }}
    <p>{{ i }}. {{ item.name }}</p>
{{ end }}
```

### 继承

```html
{* 父模板: layout.jet *}
<html>
<head><title>{{ yield title() }}</title></head>
<body>{{ yield body() }}</body>
</html>

{* 子模板: page.jet *}
{{ extends "layout" }}
{{ block title() }}My Page{{ end }}
{{ block body() }}<p>Content</p>{{ end }}
```

### 包含

```html
{{ include "partials/header" }}
<main>Content</main>
{{ include "partials/footer" }}
```

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| ID 为空 | `errors.INVALID` | 否 |
| 模板名称为空 | `errors.INVALID` | 否 |
| 权限被拒绝 | `errors.PERMISSION_DENIED` | 否 |
| 模板未找到 | `errors.NOT_FOUND` | 否 |
| 渲染错误 | `errors.INTERNAL` | 否 |
| 模板集已释放 | `errors.INTERNAL` | 否 |

参见 [错误处理](lua/core/errors.md) 了解如何处理错误。
