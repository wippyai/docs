---
title: "Configuration and Casing"
description: "后端 facade、注册表与前端配置边界上的大小写规则。"
---

# Configuration and Casing

大小写规则跟随 schema 边界。永远不要递归地转换一个配置对象。

| 边界 | 规则 | 示例 |
|---|---|---|
| 后端 facade 需求名 | 顶层 `lower_case_with_underscore` | `custom_css`、`css_variables` |
| 注册表字段 | 每个字段遵循其文档化的注册表 schema | `base_path`、`entry_point`、`tag_name` |
| 由后端 YAML 携带的嵌套前端配置 | 保留小驼峰 | `customCSS`、`themeConfig`、`iconifyIcons` |
| 前端 AppConfig 与包元数据 | 小驼峰 | `configOverrides`、`hostCssKeys` |

```yaml
config_overrides:
  customization:
    customCSS: ""
    cssVariables: {}
  routePrefix: /admin

proxy:
  injections:
    css:
      themeConfig: true
      customCss: true
      iframe: true
```

在这个例子中只有后端包装键是蛇形命名。嵌套的前端对象被原样传递并保留其定义好的大小写。

## 临时的 mountRoute 例外

`meta.mountRoute` 是当前后端的一处兼容性缺陷。后端预期的字段是 `meta.mount_route`，但在后端修正发布之前，现有部署需要 `mountRoute`。请把它当作一个明确的例外，而不是注册表或后端字段普遍使用驼峰命名的证据。

合规检查必须为该例外标注版本，以便后端 schema 变更时可以移除它。
