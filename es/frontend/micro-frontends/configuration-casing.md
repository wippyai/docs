---
title: "Configuración y Casing"
description: "Reglas de casing en los límites del facade de backend, el registry y la configuración de frontend."
---

# Configuración y Casing

El casing sigue el límite del esquema. Nunca convierta recursivamente un objeto de configuración.

| Límite | Regla | Ejemplos |
|---|---|---|
| Nombres de requirement del facade de backend | `lower_case_with_underscore` de nivel superior | `custom_css`, `css_variables` |
| Campos del registry | cada campo sigue su esquema de registry documentado | `base_path`, `entry_point`, `tag_name` |
| Configuración de frontend anidada transportada por YAML de backend | preserve lower camelCase | `customCSS`, `themeConfig`, `iconifyIcons` |
| AppConfig de frontend y metadatos de paquete | lower camelCase | `configOverrides`, `hostCssKeys` |

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

En este ejemplo, solo las claves envolventes del backend usan snake case. Los objetos de frontend anidados se pasan tal cual y conservan su casing definido.

## Excepción temporal de mountRoute

`meta.mountRoute` es un bug actual de compatibilidad del backend. El campo previsto en el backend es `meta.mount_route`, pero los despliegues existentes requieren `mountRoute` hasta que llegue la corrección del backend. Trátelo como una única excepción explícita, no como evidencia de que los campos del registry o del backend son camelCase en general.

La conformidad debe versionar esta excepción para poder eliminarla cuando cambie el esquema del backend.
