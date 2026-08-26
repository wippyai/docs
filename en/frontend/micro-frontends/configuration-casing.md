---
title: "Configuration and Casing"
description: "Casing rules at backend facade, registry, and frontend configuration boundaries."
---

# Configuration and Casing

Casing follows the schema boundary. Never recursively convert a configuration object.

| Boundary | Rule | Examples |
|---|---|---|
| Backend facade requirement names | top-level `lower_case_with_underscore` | `custom_css`, `css_variables` |
| Registry fields | each field follows its documented registry schema | `base_path`, `entry_point`, `tag_name` |
| Nested frontend configuration carried by backend YAML | preserve lower camelCase | `customCSS`, `themeConfig`, `iconifyIcons` |
| Frontend AppConfig and package metadata | lower camelCase | `configOverrides`, `hostCssKeys` |

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

Only the backend wrapper keys are snake case in this example. Nested frontend objects are passed through and retain their defined casing.

## Temporary mountRoute exception

`meta.mountRoute` is a current backend compatibility bug. The intended backend field is `meta.mount_route`, but existing deployments require `mountRoute` until the backend correction ships. Treat it as one explicit exception, not evidence that registry or backend fields are generally camelCase.

Compliance must version this exception so it can be removed when the backend schema changes.
