---
title: "設定と casing"
description: "backend facade、registry、frontend configuration の境界における casing rule。"
---

# 設定と casing

**分類: schema boundary reference。** YAML block は shape の抜粋であり、完全な registry entry ではありません。

casing は schema boundary に従います。configuration object を再帰的に変換しないでください。

| 境界 | ルール | 例 |
|---|---|---|
| Backend facade requirement 名 | top-level `lower_case_with_underscore` | `custom_css`、`css_variables` |
| Registry field | 各 field の documented registry schema に従う | `base_path`、`entry_point`、`tag_name` |
| backend YAML が運ぶ nested frontend configuration | lower camelCase を維持 | `customCSS`、`themeConfig`、`iconifyIcons` |
| Frontend AppConfig と package metadata | lower camelCase | `configOverrides`、`hostCssKeys` |

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

この例で snake case なのは backend wrapper key だけです。nested frontend object はそのまま渡され、定義済み casing を維持します。

## `mountRoute` casing の例外

現在の view registry schema は `meta.mountRoute` を読み、registry 内部の `mount_route` field に保存し、API output では再び `mountRoute` を使います。この authored lower-camel-case field は文書化された 1 つの例外として扱い、registry/backend field 全般が camelCase だという根拠にはしないでください。
