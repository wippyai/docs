---
title: "Konfiguration und Schreibweise"
description: "Schreibweisenregeln an den Grenzen von Backend-Facade, Registry und Frontend-Konfiguration."
---

# Konfiguration und Schreibweise

Die Schreibweise folgt der Schemagrenze. Wandeln Sie ein Konfigurationsobjekt niemals rekursiv um.

| Grenze | Regel | Beispiele |
|---|---|---|
| Namen von Backend-Facade-Requirements | oberste Ebene `lower_case_with_underscore` | `custom_css`, `css_variables` |
| Registry-Felder | jedes Feld folgt seinem dokumentierten Registry-Schema | `base_path`, `entry_point`, `tag_name` |
| Verschachtelte Frontend-Konfiguration, die im Backend-YAML transportiert wird | lower camelCase beibehalten | `customCSS`, `themeConfig`, `iconifyIcons` |
| Frontend-AppConfig und Paket-Metadaten | lower camelCase | `configOverrides`, `hostCssKeys` |

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

Nur die Wrapper-Schlüssel des Backends sind in diesem Beispiel snake case. Verschachtelte Frontend-Objekte werden durchgereicht und behalten ihre definierte Schreibweise.

## Vorübergehende Ausnahme mountRoute

`meta.mountRoute` ist ein aktueller Kompatibilitäts-Bug im Backend. Das vorgesehene Backend-Feld ist `meta.mount_route`, aber bestehende Deployments benötigen `mountRoute`, bis die Backend-Korrektur ausgeliefert wird. Behandeln Sie das als eine explizite Ausnahme, nicht als Beleg dafür, dass Registry- oder Backend-Felder generell camelCase wären.

Die Compliance muss diese Ausnahme versionieren, damit sie entfernt werden kann, wenn sich das Backend-Schema ändert.
