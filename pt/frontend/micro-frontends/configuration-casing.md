---
title: "Configuração e casing"
description: "Regras de casing nos limites entre facade backend, registry e configuração frontend."
---

# Configuração e casing

**Classificação: referência de limites de schema.** O bloco YAML é um trecho de formato, não um entry completo do registry.

O casing segue o limite do schema. Nunca converta recursivamente um objeto de configuração.

| Limite | Regra | Exemplos |
|--------|-------|----------|
| Nomes de requirements da facade backend | `lower_case_with_underscore` no nível superior | `custom_css`, `css_variables` |
| Campos do registry | cada campo segue seu schema documentado | `base_path`, `entry_point`, `tag_name` |
| Configuração frontend aninhada transportada por YAML backend | preservar lower camelCase | `customCSS`, `themeConfig`, `iconifyIcons` |
| AppConfig frontend e metadados de pacote | lower camelCase | `configOverrides`, `hostCssKeys` |

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

Somente as chaves wrapper do backend usam snake case neste exemplo. Objetos frontend aninhados são repassados e mantêm o casing definido.

## Exceção de casing de `mountRoute`

O schema atual do registry de views lê `meta.mountRoute` e o armazena no campo interno `mount_route`; a saída da API volta a usar `mountRoute`. Trate o campo lower camelCase escrito na origem como uma exceção documentada, não como evidência de que campos do registry ou backend geralmente usam camelCase.
