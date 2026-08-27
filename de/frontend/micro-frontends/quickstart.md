---
title: "Schnellstart"
description: "Wippy-spezifische Integrationsrezepte zum Registrieren einer Vue-Micro-Frontend-App oder Web Component."
---

# Schnellstart

Diese Seite enthält zwei verdichtete Vue-Integrationsrezepte aus dem
öffentlichen Repository [`wippyai/app`](https://github.com/wippyai/app): eine
**Micro-Frontend-App** und eine **Web Component**. Sie gelten für Web Host
1.0.56 und `@wippy-fe/*` 0.0.56 und konzentrieren sich auf Wippy-Metadaten,
Einstiegscode und Registry-Deklarationen. Gewöhnliches Vite-Scaffolding,
Installation und Backend-Setup fehlen bewusst. Verwenden Sie für vollständige
Anwendungen das verlinkte Repository; die Ausschnitte sind nicht eigenständig.

## Voraussetzungen

- Wippy-Backend mit eingebundenem [`wippy/views`](../../framework/views.md) und [`wippy/facade`](../../framework/facade.md).
- Node.js 22.12 oder neuer und Vite 7. Vite 7 verlangt Node 20.19+ oder 22.12+; hier wird Node 22 verwendet.
- `@wippy-fe/vite-plugin` 0.0.56 akzeptiert auch Vite 5/6; beachten Sie deren Node-Anforderungen.
- Zusammengehörige `@wippy-fe/*`-Familie für den Zielhost, hier exakt 0.0.56 mit Web Host 1.0.56.
- `import-map.json` des Zielhosts. Externalisieren Sie jeden Schlüssel; bündeln Sie einen exakten importierten Specifier nur, wenn er fehlt.

Die Consumer-Toolchain hängt von der gewählten Vite-Version ab; das Web-Host-
Quellrepository besitzt seine eigene Node-/Vite-Toolchain. Prüfen Sie bei einem
Releasewechsel beide. Siehe [Build- und Abhängigkeitsvertrag](./build-system.md).

---

## Rezept 1: Micro-Frontend-App (Vue)

Eine vollständige Vue-3-SPA, die der Host durch iframe oder Web Fragment
darstellt. Repository: [`frontend/applications/main`](https://github.com/wippyai/app/tree/master/frontend/applications/main).

**`package.json`** — der `wippy`-Block deklariert Seite und CSS-Injektionen:

```json
{
  "name": "@example/admin",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "wippy": {
    "type": "page",
    "title": "Admin",
    "icon": "tabler:layout-dashboard",
    "path": "dist/app.html",
    "proxy": {
      "enabled": true,
      "injections": {
        "css": { "themeConfig": true, "iframe": true, "primevue": true }
      }
    }
  }
}
```

**`src/app.ts`** — Hostdienste verwenden, mounten und beidseitige
Routersynchronisierung einrichten:

```ts
import { config } from '@wippy-fe/proxy'   // sync getter — no await to obtain it
import { createApp } from 'vue'
import { createAppRouter } from '@wippy-fe/router'
import App from './app/app.vue'
import { routes } from './router'

export function createMainApp() {
  const app = createApp(App)
  const initialPath = config.context?.route ?? '/'
  const router = createAppRouter(routes, { initialPath })

  app.use(router)
  app.mount('#app')
  return { app, router }
}
```

**Registrierung** in `_index.yaml`; dies ist Betreiber-/Deploymentpolicy:

```yaml
- name: admin
  kind: registry.entry
  meta:
    type: view.page
    name: admin
    announced: true        # show in the host nav sidebar
    url: /app
    base_path: app/admin
    entry_point: app.html
    mountRoute: /admin/:part(.*)*
```

Rufen Sie das Make-Ziel des Moduls auf und liefern Sie die Ausgabe an
`url + base_path` aus; der Host rendert sie unter `/admin`. Das Makefile nutzt
`npm run build -- --outDir <abs-or-relative> --emptyOutDir`; `make.ps1`
implementiert dasselbe Ziel unter Windows und `make.bat` ruft es auf.
Vollständige Anleitung: [Seitenrezept](./micro-frontend-app.md).

---

## Rezept 2: Web Component (Vue)

Ein im Hostseiten-DOM mit Shadow DOM gemountetes Custom Element, einbettbar in
jede Seite oder jedes Chat-Artefakt. Repository:
[`frontend/web-components/reaction-bar`](https://github.com/wippyai/app/tree/master/frontend/web-components/reaction-bar).

**`package.json`** — Tag, Props und Ereignisse:

```json
{
  "name": "@example/reaction-bar",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "browser": "dist/index.js",
  "wippy": {
    "tagName": "example-reaction-bar",
    "type": "widget",
    "props": {
      "type": "object",
      "properties": {
        "reactions": { "type": "array", "items": { "type": "string" }, "default": ["👍", "👎", "❤️"] },
        "allow-multiple": { "type": "boolean", "default": false }
      }
    },
    "events": {
      "type": "object",
      "properties": { "reaction": { "type": "object", "description": "Fired when a reaction is toggled" } }
    }
  }
}
```

**`src/index.ts`** — Vue-Komponente in `WippyVueElement` hüllen und registrieren.
`define(import.meta.url, …)` liest die vom Host ergänzte Query `?declare-tag=`:

```ts
import { WippyVueElement, define } from '@wippy-fe/webcomponent-vue'
import { PrimeVuePlugin } from '@wippy-fe/theme/primevue-plugin'
import ReactionBar from './app/reaction-bar.vue'
import stylesText from './styles.css?inline'
import pkg from '../package.json'

class ReactionBarElement extends WippyVueElement {
  static get wippyConfig() {
    return {
      propsSchema: pkg.wippy.props,
      hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const, // pull host theme + PrimeVue into the shadow root
      inlineCss: stylesText,
    }
  }
  static get vueConfig() {
    return { rootComponent: ReactionBar, plugins: [PrimeVuePlugin] }
  }
}

export async function webComponent() {
  return ReactionBarElement
}

define(import.meta.url, ReactionBarElement)
```

**`src/app/reaction-bar.vue`** — Props lesen und Ereignisse senden:

```vue
<script setup lang="ts">
import Button from 'primevue/button'
import { ref, computed } from 'vue'
import { useComponentProps, useComponentEvents } from '../constants'

const props = useComponentProps()
const emit = useComponentEvents()
const active = ref(new Set<string>())
const reactions = computed(() => props.value.reactions ?? [])

function toggle(emoji: string) {
  active.value.has(emoji) ? active.value.delete(emoji) : active.value.add(emoji)
  active.value = new Set(active.value)
  emit('reaction', { emoji, count: active.value.has(emoji) ? 1 : 0, active: active.value.has(emoji) })
}
</script>

<template>
  <Button
    v-for="emoji in reactions"
    :key="emoji"
    :label="emoji"
    :aria-label="`Toggle ${emoji} reaction`"
    :aria-pressed="active.has(emoji)"
    text
    @click="toggle(emoji)"
  />
</template>
```

`useComponentProps` / `useComponentEvents` sind dünne lokale Wrapper um
`useProps()` / `useEvents()` in `src/constants.ts`.

**Registrierung** als `view.component`; alle drei Autoload-Gates sind erforderlich:

```yaml
- name: reaction-bar
  kind: registry.entry
  meta:
    type: view.component
    name: reaction-bar
    tag_name: example-reaction-bar
    announced: true
    auto_register: true
    url: /app/wc/reaction-bar
    entry_point: index.js
```

Nach dem Build kann jede Seite oder jedes Chat-Artefakt den Tag verwenden:

```html
<example-reaction-bar reactions='["👍","🎉"]'></example-reaction-bar>
```

Vollständige Anleitung: [Web-Component-Rezept](./web-component.md).

---

## Weitere Beispiele

Das Repository [`app`](https://github.com/wippyai/app) enthält unter
[`frontend/web-components/`](https://github.com/wippyai/app/tree/master/frontend/web-components):

| Komponente | Demonstriert |
|---|---|
| `reaction-bar` | Props und Ereignisse |
| `counter-persist` | Reload-festen Zustand über `@wippy-fe/pinia-persist` |
| `chart-circle` | Drittanbieterbibliothek Chart.js im Shadow DOM |
| `mermaid` | Kindinhalt (`<template data-type="…">`) und lazy Fallback-Bundle |
| `markdown` | `markdown-it` + `sanitize-html` |
| `websocket-log` | Live-Daten über Themenabonnements mit `on(...)` |
| `model-gallery` | Authentifizierte Proxy-API-Aufrufe und PrimeVue im Shadow DOM |

Zum Theming siehe [Theme-Erstellung](./theming.md),
[Theming für Micro-Frontend-Apps](./micro-frontend-app-theming.md) und
[Theming für Web Components](./web-component-theming.md). Für lokale Ausführung
ohne vollständigen Host siehe [Host-less-Modus](./host-less-mode.md).
