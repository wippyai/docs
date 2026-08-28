---
title: "Web-Component-Rezept"
description: "Portable view.component-Rezepte für reine Inhalts- und steuerungsbehaftete Custom Elements."
---

# Web-Component-Rezept

Eine Web Component wird als `view.component` registriert und normalerweise in
einem Shadow Root gerendert. Wählen Sie die kleinste gültige Einrichtung.

Die Rezepte setzen ein vorhandenes Vue-/Vite-Projekt voraus. Sie zeigen
Wippy-spezifisches Element, Metadaten und Buildkonfiguration, kein eigenständiges Scaffold.

## Variante A: nur Inhalt

Chart, Diagramm, Renderer oder Visualisierung dürfen PrimeVue und Tailwind
weglassen, solange sie weder Steuerelement noch gemeinsame Tailwind-Utility darstellen.

Trotzdem erforderlich:

- gültigen Custom-Element-Tag veröffentlichen,
- Barrierefreiheit des Inhalts bewahren,
- unterstützte Wippy-Konfiguration und CSS-Bereitstellung verwenden,
- private Facade-Klassen vermeiden,
- über das kanonische Make-Ziel des Wippy-Modulrepositories bauen.

Sobald Button, Eingabe, Formular, Menü oder ein anderes PrimeVue-artiges
Steuerelement hinzukommt, endet diese Ausnahme.

## Variante B: mit Steuerelementen

Eine Komponente mit Steuerelementen installiert PrimeVue über das Wippy-
PrimeVue-Plugin und erhält Theme- und PrimeVue-CSS vom Host. Das Web-Component-
Paket lädt standardmäßig alle Host-CSS-Schlüssel; die folgende Liste begrenzt
dies auf die verwendeten Assets plus gemeinsames iframe-/Scrollbar-CSS:

```ts
import { defineComponent, h } from 'vue'
import Button from 'primevue/button'
import { PrimeVuePlugin } from '@wippy-fe/theme/primevue-plugin'
import {
  WippyVueElement,
  define,
  type WippyElementConfig,
} from '@wippy-fe/webcomponent-vue'
import pkg from '../package.json'

const Root = defineComponent({
  name: 'ExampleControlsRoot',
  setup() {
    return () => h(Button, { label: 'Save' })
  },
})

class ExampleControlsElement extends WippyVueElement {
  static get wippyConfig(): WippyElementConfig {
    return {
      propsSchema: pkg.wippy.props,
      hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl'],
    }
  }

  static get vueConfig() {
    return {
      rootComponent: Root,
      plugins: [PrimeVuePlugin],
    }
  }
}

export async function webComponent() {
  return ExampleControlsElement
}

define(import.meta.url, ExampleControlsElement)
```

### Vertrag der Paketmetadaten

Die Paketmetadaten müssen dasselbe Custom Element benennen:

```json
{
  "name": "@example/controls",
  "version": "0.1.0",
  "type": "module",
  "specification": "wippy-component-1.0",
  "browser": "dist/index.js",
  "wippy": {
    "type": "component",
    "tagName": "example-controls",
    "props": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  }
}
```

Gültige Werte für `wippy.type` sind `"component"` und `"widget"`. Verwenden
Sie den Registry-Kind `view.component` nicht als Paketwert.

Der Komponenten-Build nutzt das strikte Wippy-Plugin und den vollständigen
fixierten Import-Map-Snapshot des Zielhosts:

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
import hostImportMap from './wippy-import-map.json'

export default defineConfig({
  plugins: [vue(), wippyComponentPlugin({ required: true })],
  build: {
    lib: {
      entry: 'src/element.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: Object.keys(hostImportMap.imports),
      preserveEntrySignatures: 'strict',
    },
  },
})
```

Behalten Sie `preserveEntrySignatures: 'strict'`; andere Rollup-Werte erfüllen
den dokumentierten Wippy-Komponentenvertrag nicht. Verwenden Sie das gemeinsame
Wippy-Tailwind-Preset, wenn die Komponente Tailwind-Utilities verfasst. PrimeVue
selbst verlangt keine erfundenen Utilities.

## Regeln für Shadow Roots

- Öffentliche CSS-Variablen können in den Shadow Root vererbt werden.
- Selektorregeln wirken nur, wenn der Host sie in den Root liefert.
- Gemeinsames PrimeVue-Theme-CSS ist eine unterstützte Abhängigkeit.
- Beliebige Facade-Klassen sind keine portablen APIs.
- Overlay-Platzierung muss in der echten Runtime geprüft werden; erzwingen Sie kein generisches Rezept.

## Metadaten und Build

Dokumentieren Sie Props und Ereignisse in Paketmetadaten. Ein Registry-Eintrag
kann sie als deploymentspezifische `meta.props`- und `meta.events`-
Überschreibungen wiederholen; diese gewinnen gegen Bundlemetadaten. Rufen Sie
das Make-Ziel des Modulrepositories auf; dessen Rezept verwendet:

```text
npm run build -- --outDir <target> --emptyOutDir
```

Rufen Sie den zugrunde liegenden Befehl nicht direkt auf. Unter Windows
verwenden Sie `make.bat`, das an `make.ps1` delegiert.

Siehe [Theme-Erstellung](./theming.md), [Tailwind-Vertrag](./tailwind-contract.md)
und [Build- und Abhängigkeitsvertrag](./build-system.md).
