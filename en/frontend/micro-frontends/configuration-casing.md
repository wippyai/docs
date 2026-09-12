---
title: "Configuration and Casing"
description: "Casing rules at backend facade, registry, and frontend configuration boundaries."
---

# Configuration and Casing

**Classification: schema-boundary reference.** The YAML block is a shape
excerpt, not a complete registry entry.

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

## `mountRoute` casing exception

The current view registry schema reads `meta.mountRoute` and stores it in the registry's internal `mount_route` field; API output uses `mountRoute` again. Treat the authored lower-camel-case field as one documented exception, not evidence that registry or backend fields are generally camelCase.
