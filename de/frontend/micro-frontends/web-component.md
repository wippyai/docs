---
title: "Web-Component-Rezept"
description: "Portable view.component-Rezepte für rein inhaltliche und Control-tragende Custom Elements."
---

# Web-Component-Rezept

Eine Web Component wird als `view.component` registriert und rendert normalerweise in einem Shadow Root. Wählen Sie das kleinste gültige Setup.

## Variante A: nur Inhalt

Ein Chart, Diagramm, Renderer oder eine Visualisierung darf PrimeVue und Tailwind weglassen, wenn sie kein Control rendert und keine gemeinsame Tailwind-Utility schreibt.

Sie muss dennoch:

- Ein gültiges Custom-Element-Tag veröffentlichen.
- Die Barrierefreiheit der gerenderten Inhalte wahren.
- Unterstützte Wippy-Konfiguration und CSS-Auslieferung verwenden.
- Projektprivate Facade-Klassen vermeiden.
- Über das kanonische Make-Target des Wippy-Modul-Repositories bauen.

Wird später ein Button, Input, Formular, Menü oder ein anderes PrimeVue-artiges Control ergänzt, endet diese Ausnahme.

## Variante B: Control-tragend

Eine Komponente mit Controls muss PrimeVue über das Wippy-PrimeVue-Plugin
installieren und die erforderlichen CSS-Auslieferungs-Keys konfigurieren. Der
folgende Einstieg ist der aktuell vom Package unterstützte Vue-Weg:

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

Die Package-Metadaten müssen dasselbe Custom Element benennen:

```json
{
  "name": "@example/controls",
  "version": "0.1.0",
  "type": "module",
  "specification": "wippy-component-1.0",
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

Der Komponenten-Build verwendet das strikte Wippy-Komponenten-Plugin und den
vollständigen gepinnten Import-Map-Snapshot des Ziel-Hosts:

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
    },
  },
})
```

Verwenden Sie das gemeinsame Wippy-Tailwind-Preset, wenn diese Komponente
Tailwind-Utilities schreibt. PrimeVue selbst verlangt von einem Modul nicht,
Tailwind-Utilities zu erfinden.

## Shadow-Root-Regeln

- Öffentliche CSS-Variablen dürfen in den Shadow Root vererben.
- Selektor-Regeln wirken nur, wenn der Host sie in den Root liefert.
- Gemeinsames PrimeVue-Theme-CSS ist eine unterstützte Abhängigkeit.
- Beliebige Facade-Klassen sind keine portablen APIs.
- Overlay-Platzierung muss in der echten Laufzeitumgebung verifiziert werden; erzwingen Sie kein generisches Platzierungsrezept.

## Metadaten und Build

Dokumentieren Sie Props und Events sowohl in den Package-Metadaten als auch im Registry-Eintrag, wie es das gewählte Schema verlangt. Rufen Sie das Make-Target des Modul-Repositories auf; dessen Rezept verwendet:

```text
npm run build -- --outDir <target> --emptyOutDir
```

Rufen Sie dieses zugrunde liegende Kommando nicht direkt auf. Unter Windows
rufen Sie `make.bat` auf; es delegiert an `make.ps1`.

Siehe [Theme Authoring](./theming.md), [Tailwind Contract](./tailwind-contract.md) und [Build and Dependency Contract](./build-system.md).
