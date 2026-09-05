---
title: "Theming: Micro-Frontend-Apps"
description: "Die Theming-Referenz behandelt den vollständigen Katalog der CSS-Variablen. Dieses Dokument behandelt, wie eine Micro-Frontend-App das Theme erhält."
---

# Theming: Micro-Frontend-Apps

Die [Theming-Referenz](./theming.md) behandelt den vollständigen Katalog der CSS-Variablen. Dieses Dokument behandelt, wie eine Micro-Frontend-App das Theme erhält.

---

## Wie das Theme Ihre App erreicht

Der Host injiziert CSS über die Proxy-Injektions-Pipeline in das iframe Ihrer Micro-Frontend-App. Das aktuelle Laufzeitschema ist `wippy-context-2.0`: Facade-Theming wird als `theming.global`, `theming.host` und `theming.children` dargestellt; eine Kindseite erhält ihr effektives kindgerichtetes Theme als `config.theming.global`.

### L1 — Global (Facade-Ebene)

CSS-Variablen, die im globalen Theming-Scope der Facade gesetzt werden, erreichen den Host und alle iframes automatisch über die Proxy-Injektionen `themeConfig` und Custom-Variablen. Das ist der primäre Ort für Markenpalette, Akzentfarbe und jedes Styling, das überall einheitlich gelten muss.

```yaml
- name: css_variables
  value: '{"--p-primary":"#4f8ef7","--p-secondary":"#6f7385","--p-danger":"#dc2626"}'
```

### L2 — Scoped (Host- oder Children-Scope)

Die Facade stellt im aktuellen Schema getrennte Scopes für das Host-Chrome und für Kind-iframes bereit:

| Schema-Scope | Erreicht | Verwendung für |
|---|---|---|
| `theming.host` | Nur das UI-Chrome des Hosts | Sidebar, Chat-Nachrichten, Splitter — BEM-Overrides des Hosts |
| `theming.children` | Nur Kind-iframes | CSS, das innerhalb von Kind-Apps gilt, aber nicht in den Host lecken darf |

CSS, das in `children_css_variables` oder `children_custom_css` gesetzt wird, erreicht Ihre Micro-Frontend-App; host-gescopte Variablen zielen nur auf das Chrome des Web Host.

### L3 — Pro Seite (`config_overrides` im Registry-YAML)

Geben Sie einer Seite ihr eigenes Theme, indem Sie `config_overrides.customization.cssVariables` / `customCSS` im YAML des Registry-Eintrags der Seite setzen. Das Override wird in `theming.global` der Seite projiziert und thematisiert daher die Seite **und alles, was die Seite einbettet** — verschachtelte `<w-artifact>`- / `<w-iframe>`- / `html.inject`-Inhalte werden aus der bereits gemergten Konfiguration der Seite gebaut und erben das Theme rekursiv über den Unterbaum. Das ist das Werkzeug, um einen **selbst thematisierten Unterbaum** auszuliefern: z. B. ein Admin-Modul, dessen Seiten ein eigenes Theme tragen, das sich auf alle von ihnen gehosteten Artefakte und Sub-Apps überträgt. Geschwisterseiten oder der Rest der App-Hülle werden nicht berührt.

```yaml
- name: iframe-demo-themed
  kind: registry.entry
  meta:
    type: view.page
    config_overrides:
      customization:
        cssVariables:
          "--p-primary": "#9c59d1"
          "@light":
            "--p-content-background": "#faf5ff"
          "@dark":
            "--p-content-background": "#1a0d22"
        customCSS: |
          .demo-banner { background: var(--p-primary-color); color: var(--p-primary-contrast-color); }
```

Einträge auf oberster Ebene gelten in jedem Theme-Modus. `@dark` und `@light` ersetzen ausgewählte Einträge und kompilieren sowohl zu Media-Blöcken für den Auto-Modus als auch zu erzwungenen Selektoren `.w-theme-dark` / `.w-theme-light`. Der Host besitzt diese Klassen; Anwendungen erfinden kein paralleles `data-theme`-Protokoll.

Ein Spiegel in der `package.json` unter `wippy.configOverrides` bietet dieselbe Form für das Host-lose Rendern (eigenständige Dev-Vorschau, Unit-Tests). Halten Sie beide synchron; das YAML gewinnt, wenn ein Host vorhanden ist.

---

## CSS-Injektion aktivieren

Konfigurieren Sie im `wippy`-Block Ihrer `package.json`, welche Injektionen Ihre Micro-Frontend-App anfordert:

```jsonc
"wippy": {
  "type": "page",
  "proxy": {
    "injections": {
      "css": {
        "themeConfig":      true,   // --p-*-CSS-Variablen (theme-config.css)
        "primevue":         true,   // CSS der PrimeVue-Komponenten (~455 KB)
        "markdown":         false,  // .data-body-Markdown-Styles
        "iframe":           true,   // Scrollbar-Styling
        "customCss":        true,   // Vom Kind projiziertes theming.global.customCSS
        "customVariables":  true    // Vom Kind projiziertes theming.global.cssVariables
      },
      "tailwindConfig": false       // NUR Legacy-Runtime-Tailwind; für Vite-Builds auf false lassen
    }
  }
}
```

Der iframe-Proxy hat weite Laufzeit-Standardwerte, wenn Flags weggelassen werden. **Aktivieren Sie diese Flags, um Theme-CSS zu erhalten** (eine auf Theming fokussierte Zusammenfassung, nicht die maßgebliche Flag-Liste):

- `css.themeConfig` — das vollständige System der `--p-*`-CSS-Variablen (`theme-config.css`). Aktivieren, um die Theme-Palette zu erben.
- `css.primevue` — Styles der PrimeVue-Komponenten. Für Apps aktivieren, die PrimeVue verwenden.
- `css.customCss` — das vom Host komponierte, kindgerichtete Custom-CSS: das Custom-CSS der Facade aus **global + children**, gemergt in `config.theming.global.customCSS`, plus etwaige Overrides pro Seite. Das Flag steuert diese Injektion, statt einen einzelnen Scope zu benennen. Aktivieren, um Custom-CSS der Facade bzw. pro Seite zu erhalten.
- `css.customVariables` — vom Kind projiziertes `config.theming.global.cssVariables` als effektive Basis sowie Blöcke für Auto-hell, Auto-dunkel, erzwungen Hell und erzwungen Dunkel. Aktivieren, um Overrides für Theme-Variablen zu erhalten.
- `css.markdown` — `.data-body`-Markdown-Styles. Nur aktivieren, wenn Ihre Seite Markdown-Inhalte rendert.

Vollständige Flag-Referenz und Laufzeit-Standardwerte: [CSS-Injektion](../web-host/css-injection.md).

> **Hinweis zum Dev-Modus:** Das Dev-Overlay startet mit `themeConfig`, `primevue`, `markdown` und `iframe` standardmäßig DEAKTIVIERT. Aktivieren Sie sie im Overlay, um lokal echtes Theme-Styling zu sehen. Aktivieren Sie "Auto-accept on reload", damit das über Neuladen hinweg bestehen bleibt.

---

## Merge-Reihenfolge — was was überschreibt

Wenn der Host die AppConfig anwendet (der letzte Schreiber gewinnt):

1. Standardwerte aus `theme-config.css` (Fallback zur Entwicklungszeit)
2. Facade-`theming.global` und kindgerichtetes `theming.children`
3. Seiten-`wippy.configOverrides` (deklarativ, in die Seite eingebacken)
4. `window.__WIPPY_CONFIG_OVERRIDES__` (zur Laufzeit, falls vor dem Laden des Proxys gesetzt)

Für `cssVariables`: Die Override-Map **ersetzt** die geerbte Kind-Map — schreiben Sie den vollständigen gewünschten Satz. Für `icons`/`iconSets`: additiver Merge. Für `axiosDefaults`, `routePrefix` und `apiRoutes`: Der Host wendet für diese Felder die aktuellen `AppConfigOverrides`-Merge-Regeln an.

### Laufzeit-Overrides (`window.__WIPPY_CONFIG_OVERRIDES__`)

Setzen Sie das Global, bevor `proxy.js` läuft, für Theming, das über Query-Parameter oder Feature-Flags gesteuert wird:

Dieses Global vor dem Proxy ist ein Notausgang für Einbettungs-/Host-lose Integration. In einem gehosteten Kind gehört `window.location` der gewählten Seiten-Engine — bei iframe-Auslieferung `about:srcdoc` — und ist weder Host-Route noch Query-Kontext. Verwenden Sie deklarative `config_overrides` der Seite oder die vom Host gelieferte AppConfig. Leiten Sie Host-Zustand niemals aus Browser-Locations von Kind oder Parent ab.

---

## Verifizieren

Um zu bestätigen, dass CSS-Variablen in Ihrer laufenden Seite aktiv sind: Öffnen Sie die DevTools, wählen Sie den Frame-Kontext des inneren iframes (nicht die äußere Seite) und führen Sie aus:

```js
getComputedStyle(document.documentElement).getPropertyValue('--p-primary-color')
```

Ein nicht leeres Ergebnis beweist nur, dass irgendein Theme-CSS geladen wurde. Vergleichen Sie den exakten konfigurierten Wert am Seiten-Root, am WC-Host, am inneren WC-Root und in der gerenderten semantischen Farbe; prüfen Sie jede konfigurierte Familie. Vollständiger Ablauf: [Debugging](./debugging.md).

---

## Verwandte Dokumente

- [theming.md](./theming.md) — Katalog der CSS-Variablen und Anti-Patterns
- [web-component-theming.md](./web-component-theming.md) — Theming für Web Components (Shadow DOM)
- [micro-frontend-app.md](./micro-frontend-app.md) — vollständige Anleitung zur Entwicklung von Micro-Frontend-Apps
- [host-less-mode.md](./host-less-mode.md) — Dev-Overlay und CSS-Injektion im Host-losen Modus
- [compliance-checklist.md](./compliance-checklist.md) — vollständige REJECT/WARN-Regeln für Theming
