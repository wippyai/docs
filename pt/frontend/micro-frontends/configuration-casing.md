---
title: "Configuração e Casing"
description: "Regras de casing nas fronteiras de facade do backend, do registry e da configuração de frontend."
---

# Configuração e Casing

O casing segue a fronteira do schema. Nunca converta recursivamente um objeto de configuração.

| Fronteira | Regra | Exemplos |
|---|---|---|
| Nomes de requisitos da facade do backend | `lower_case_with_underscore` no nível superior | `custom_css`, `css_variables` |
| Campos do registry | cada campo segue seu schema de registry documentado | `base_path`, `entry_point`, `tag_name` |
| Configuração de frontend aninhada carregada por YAML do backend | preserva lower camelCase | `customCSS`, `themeConfig`, `iconifyIcons` |
| AppConfig do frontend e metadados de pacote | lower camelCase | `configOverrides`, `hostCssKeys` |

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

Apenas as chaves do wrapper do backend estão em snake case neste exemplo. Objetos de frontend aninhados são repassados e mantêm seu casing definido.

## Exceção temporária do mountRoute

`meta.mountRoute` é um bug atual de compatibilidade do backend. O campo pretendido no backend é `meta.mount_route`, mas os deployments existentes exigem `mountRoute` até que a correção do backend seja lançada. Trate isso como uma exceção explícita, não como evidência de que campos do registry ou do backend sejam geralmente camelCase.

A conformidade deve versionar essa exceção para que ela possa ser removida quando o schema do backend mudar.
