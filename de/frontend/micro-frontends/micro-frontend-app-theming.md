---
title: "Theming: Micro-Frontend-Apps"
description: "Wie Micro-Frontend-Apps Theme-Konfiguration aus Facade, Kind-Scope und Seiteneinstellungen erhalten."
---

# Theming: Micro-Frontend-Apps

**Klassifizierung: Konfigurationsreferenz mit Teilrezepten.** YAML,
Paketmetadaten und Runtime-Ausschnitte zeigen jeweils eine Vertragsschicht und
müssen mit einem vollständigen `view.page`-Projekt und Facade-Eintrag verbunden werden.

Micro-Frontend-Apps erhalten über enginespezifische CSS-Bereitstellung dasselbe
effektive Kind-Theme. Der gemeinsame Erstellungsvertrag steht unter
[Theme-Erstellung](./theming.md).

---

## Wie das Theme die App erreicht

Bei iframe injiziert der Host CSS über die Proxy-Pipeline und legt eigene
Variablen sowie CSS in dokumentweiten Adopted Stylesheets ab. Bei Web Fragment
liefert das Framework-Gateway Plattform-CSS; der Fragment-Adapter setzt eigene
Variablen und CSS als normale `<style>`-Elemente in den reflektierten Head. Das
aktuelle Runtime-Schema ist `wippy-context-2.0`: Facade-Theming erscheint als
`theming.global`, `theming.host` und `theming.children`; beide Engines erhalten
das effektive Kind-Theme als `config.theming.global`.

### L1 — Global (Facade-Ebene)

Variablen im globalen Facade-Scope erreichen Host und Kindseiten über den
CSS-Pfad der Engine. Verwenden Sie ihn für Markenpalette, Akzent und überall
einheitliche Styles.

```yaml
- name: css_variables
  value: '{"--p-primary":"#4f8ef7","--p-secondary":"#6f7385","--p-danger":"#dc2626"}'
```

### L2 — Begrenzt (Host- oder Children-Scope)

| Schema-Scope | Erreicht | Zweck |
|---|---|---|
| `theming.host` | Nur Host-Chrome | Sidebar, Chatnachrichten, Splitter und Host-BEM-Überschreibungen |
| `theming.children` | Nur Kindseiten | CSS in Kind-Apps ohne Wirkung im Host |

`children_css_variables` und `children_custom_css` erreichen die Micro-
Frontend-App; Hostvariablen nur die Web-Host-Chrome.

### L3 — Je Seite (`config_overrides` im Registry-YAML) :id=l3-seitenspezifische-config_overrides-im-registry-yaml

Ein eigenes Seitentheme entsteht über
`config_overrides.customization.cssVariables` / `customCSS`. Die Überschreibung
wird nach `theming.global` der Seite projiziert und thematisiert die Seite
**sowie alles Eingebettete**. `<w-artifact>`, `<w-iframe>` und `html.inject`
erben die bereits zusammengeführte Konfiguration rekursiv. Das eignet sich für
einen selbst thematisierten Unterbaum, wirkt aber nicht auf Geschwisterseiten
oder die übrige Shell.

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

Einträge auf oberster Ebene gelten in jedem Modus. `@dark` und `@light`
ersetzen ausgewählte Werte und werden zu Medienblöcken für Auto sowie
erzwungenen Selektoren `.w-theme-dark` / `.w-theme-light` kompiliert. Der Host
besitzt diese Klassen; Apps erfinden kein paralleles `data-theme`-Protokoll.

Ein Spiegel unter `wippy.configOverrides` in `package.json` liefert dieselbe
Form für Host-less-Vorschau und Unit-Tests. Halten Sie beide synchron; bei
vorhandenem Host gewinnt YAML.

---

## iframe-CSS-Injektion aktivieren

Für iframe und Host-less legt der `wippy`-Block in `package.json` die
angeforderten Injektionen fest:

```jsonc
"wippy": {
  "type": "page",
  "proxy": {
    "injections": {
      "css": {
        "themeConfig":      true,   // --p-* CSS vars (theme-config.css)
        "primevue":         true,   // PrimeVue component CSS and Tailwind utilities
        "markdown":         false,  // .data-body markdown styles
        "iframe":           true,   // Scrollbar styling
        "customCss":        true,   // Child-projected theming.global.customCSS
        "customVariables":  true    // Child-projected theming.global.cssVariables
      },
      "tailwindConfig": false       // LEGACY runtime-Tailwind only; leave false for Vite builds
    }
  }
}
```

Der iframe-Proxy besitzt breite Standards, wenn Flags fehlen. Für Theme-CSS
sind ausdrücklich zu aktivieren:

- `css.themeConfig` — vollständiges `--p-*`-System aus `theme-config.css`.
- `css.primevue` — PrimeVue-Komponentenstyles.
- `css.customCss` — vom Host aus global + children zusammengesetztes Custom CSS plus Seitenüberschreibung; das Flag ist ein Gate, kein einzelner Scope.
- `css.customVariables` — projizierte Variablen als effektive Basis-, Auto- und erzwungene Hell-/Dunkel-Blöcke.
- `css.markdown` — `.data-body`-Styles, nur bei Markdown-Inhalten.

Vollständige Standards: [CSS-Injektion](../web-host/css-injection.md).

Web Fragment nutzt diese Flags nicht als Gate für festes Host-CSS. Gateway und
Fragment-Adapter wenden Assets, Variablen und CSS nach Empfang der AppConfig an.

> **Entwicklungsmodus:** Das Overlay startet mit deaktiviertem `themeConfig`,
> `primevue`, `markdown` und `iframe`. Aktivieren Sie sie für lokale Vorschau.
> „Auto-accept on reload“ bewahrt die Auswahl über Reloads.

---

## Zusammenführungsreihenfolge

Beim Anwenden von AppConfig gewinnt der letzte Schreiber:

1. Standards aus `theme-config.css`
2. Facade `theming.global` und kindseitiges `theming.children`
3. `wippy.configOverrides` der Seite
4. `window.__WIPPY_CONFIG_OVERRIDES__`, wenn vor dem Proxy gesetzt

Bei `cssVariables` **ersetzt** die Override-Map die geerbte Kind-Map; schreiben
Sie den vollständigen gewünschten Satz. `icons`/`iconSets` werden additiv
zusammengeführt. Für `axiosDefaults`, `routePrefix` und `apiRoutes` gelten die
aktuellen Regeln von `AppConfigOverrides`.

### Runtime-Überschreibungen (`window.__WIPPY_CONFIG_OVERRIDES__`)

Setzen Sie dieses Global für query- oder featuregetriebenes Theming vor
`proxy.js`. Es ist ein Ausweg für Embedder/Host-less. In einem gehosteten Kind
gehört `window.location` zur gewählten Engine und ist kein Host-Routen- oder
Query-Kontext. Nutzen Sie deklarative `config_overrides` oder Host-AppConfig;
leiten Sie Hostzustand nie aus Kind- oder Eltern-URL ab.

---

## Prüfen

Wählen Sie in DevTools den Ausführungs-Realm der Seite und führen Sie aus:

```js
getComputedStyle(document.documentElement).getPropertyValue('--p-primary-color')
```

Ein nicht leerer Wert beweist nur, dass irgendein Theme-CSS geladen wurde.
Vergleichen Sie den exakten konfigurierten Wert an Seiten-Root, WC-Host,
WC-Inner-Root und gerenderter semantischer Farbe für jede Familie. Vollständiger
Ablauf: [Debugging](./debugging.md).

## Verwandte Dokumentation

- [Theme-Erstellung](./theming.md)
- [Theming für Web Components](./web-component-theming.md)
- [Seitenrezept](./micro-frontend-app.md)
- [Host-less-Modus](./host-less-mode.md)
- [Index der Compliance-Regeln](./compliance-checklist.md)
