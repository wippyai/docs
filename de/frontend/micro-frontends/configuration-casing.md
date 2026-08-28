---
title: "Konfiguration und Schreibweise"
description: "Regeln für die Schreibweise an den Grenzen von Backend-Facade, Registry und Frontendkonfiguration."
---

# Konfiguration und Schreibweise

**Klassifizierung: Referenz für Schemengrenzen.** Der YAML-Block ist ein
Formausschnitt, kein vollständiger Registry-Eintrag.

Die Schreibweise folgt der Schemengrenze. Konvertieren Sie ein
Konfigurationsobjekt nie rekursiv.

| Grenze | Regel | Beispiele |
|---|---|---|
| Namen von Backend-Facade-Requirements | oberste Ebene `lower_case_with_underscore` | `custom_css`, `css_variables` |
| Registry-Felder | jedes Feld folgt seinem dokumentierten Registry-Schema | `base_path`, `entry_point`, `tag_name` |
| Verschachtelte Frontendkonfiguration in Backend-YAML | lower camelCase beibehalten | `customCSS`, `themeConfig`, `iconifyIcons` |
| Frontend-AppConfig und Paketmetadaten | lower camelCase | `configOverrides`, `hostCssKeys` |

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

Nur die Backend-Wrapper-Schlüssel verwenden hier snake_case. Verschachtelte
Frontendobjekte werden unverändert durchgereicht.

## Ausnahme für `mountRoute`

Das aktuelle View-Registry-Schema liest `meta.mountRoute`, speichert es intern
als `mount_route` und gibt es in der API wieder als `mountRoute` aus. Behandeln
Sie das verfasste lower-camel-case-Feld als dokumentierte Ausnahme, nicht als
Beleg dafür, dass Registry- oder Backendfelder allgemein camelCase verwenden.
