---
title: "Configuración y uso de mayúsculas"
description: "Reglas de nombres entre la fachada backend, el registro y los límites de configuración frontend."
---

# Configuración y uso de mayúsculas

**Clasificación: referencia de límites de esquema.** El bloque YAML es un
extracto de forma, no una entrada de registro completa.

El uso de mayúsculas depende del límite del esquema. Nunca convierta recursivamente un objeto de configuración.

| Límite | Regla | Ejemplos |
|---|---|---|
| Nombres de requisitos de la fachada backend | `lower_case_with_underscore` en el nivel superior | `custom_css`, `css_variables` |
| Campos del registro | cada campo sigue su esquema de registro documentado | `base_path`, `entry_point`, `tag_name` |
| Configuración frontend anidada transportada por YAML del backend | conserve lower camelCase | `customCSS`, `themeConfig`, `iconifyIcons` |
| AppConfig frontend y metadatos de paquetes | lower camelCase | `configOverrides`, `hostCssKeys` |

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

En este ejemplo solo las claves contenedoras del backend usan snake case. Los objetos frontend anidados se transmiten sin cambios y conservan el uso de mayúsculas definido.

## Excepción de mayúsculas de `mountRoute`

El esquema actual del registro de vistas lee `meta.mountRoute` y lo almacena en el campo interno `mount_route`; la salida de la API vuelve a usar `mountRoute`. Trate el campo lower camelCase escrito por el autor como una excepción documentada, no como prueba de que los campos del registro o del backend sean camelCase en general.
