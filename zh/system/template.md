# Template Engine
<secondary-label ref="external"/>

使用 [CloudyKit Jet](https://github.com/CloudyKit/jet) 的模板渲染。

## Entry 类型

| Kind | 描述 |
|------|------|
| `template.set` | 带共享配置的模板集 |
| `template.jet` | 单个模板 |

## 模板集

模板集是包含相关模板的命名空间。集合中的模板共享配置，可以通过名称相互引用。

```yaml
- name: views
  kind: template.set
```

所有配置都是可选的，有合理的默认值：

| 字段 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `engine.development_mode` | bool | false | 禁用模板缓存 |
| `engine.delimiters.left` | string | `{{` | 变量左分隔符 |
| `engine.delimiters.right` | string | `}}` | 变量右分隔符 |
| `engine.globals` | map | - | 所有模板可用的变量 |

## 模板

模板属于一个集合，通过名称进行内部解析标识。

```yaml
- name: layout
  kind: template.jet
  set: app.views:views
  source: |
    <html>
    <body>{{ yield content() }}</body>
    </html>

- name: home
  kind: template.jet
  set: app.views:views
  source: |
    {{ extends "layout" }}
    {{ block content() }}
      <h1>Welcome, {{ name }}</h1>
    {{ end }}
```

| 字段 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `set` | reference | 是 | 父模板集 |
| `source` | string | 是 | 模板内容 |

## 模板解析

模板使用名称相互引用，而不是 registry ID。解析像集合内的虚拟文件系统一样工作：

1. 默认情况下，registry entry 名称（`entry.ID.Name`）成为模板名称
2. 使用 `meta.name` 覆盖自定义命名：

```yaml
- name: email-welcome-v2
  kind: template.jet
  set: app.emails:templates
  meta:
    name: welcome
  source: |
    {{ include "header" }}
    Hello {{ user }}!
```

此模板在集合中注册为 `welcome`，因此其他模板使用 `{{ include "welcome" }}` 或 `{{ extends "welcome" }}`。

## 继承

模板可以扩展父模板并覆盖块：

```yaml
# Parent defines yield points
- name: base
  kind: template.jet
  set: app.views:views
  source: |
    <html>
    <head><title>{{ yield title() }}</title></head>
    <body>{{ yield body() }}</body>
    </html>

# Child extends and fills blocks
- name: page
  kind: template.jet
  set: app.views:views
  source: |
    {{ extends "base" }}
    {{ block title() }}My Page{{ end }}
    {{ block body() }}<p>Content here</p>{{ end }}
```

## Lua API

参见 [Template 模块](lua/text/template.md) 了解渲染操作。
