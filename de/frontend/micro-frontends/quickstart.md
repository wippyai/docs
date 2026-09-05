---
title: "Quickstart"
description: "Zwei End-to-End-Beispiele — eine Micro-Frontend-App (Vue) und eine Web Component (Vue) — aus dem öffentlichen Repository wippyai/app. Jedes zeigt die minimalen…"
---

# Quickstart

Zwei End-to-End-Beispiele — eine **Micro-Frontend-App** (Vue) und eine **Web Component** (Vue) — aus dem öffentlichen Repository [`wippyai/app`](https://github.com/wippyai/app). Jedes zeigt die minimal nötigen Dateien, wie das Artefakt beim Backend registriert wird und wie es gebaut wird. Folgen Sie den Links zum Repo für den vollständigen, lauffähigen Quellcode und zu den Vertiefungsdokumenten für jede Option.

**Voraussetzungen:** ein Wippy-Backend mit verdrahteten Modulen [`wippy/views`](../../framework/views.md) und [`wippy/facade`](../../framework/facade.md), Node.js 22 oder neuer, Vite 7 und die aktuelle kohärente `@wippy-fe/*`-Package-Familie für den Ziel-Web-Host. Diese Toolchain-Anforderungen stammen aus dem gewählten Web-Host-Package; prüfen Sie sie erneut, wenn sich dieses Package ändert. Holen Sie die `import-map.json` des Ziel-Web-Hosts, externalisieren Sie jeden aufgeführten Key einschließlich der ungenutzten, und bundeln Sie einen importierten exakten Specifier nur, wenn er fehlt. Siehe [Build System](./build-system.md) für die Toolchain.

---

## Beispiel 1 — Micro-Frontend-App (Vue)

Eine vollständige Vue-3-SPA, die der Web Host über seine gewählte Page-Engine rendert (standardmäßig ein iframe oder ein Web Fragment). Repo: [`frontend/applications/main`](https://github.com/wippyai/app/tree/main/frontend/applications/main).

**`package.json`** — der `wippy`-Block deklariert sie als Page und legt fest, welches CSS der Host injiziert:

```json
{
  "name": "@example/admin",
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

**`src/app.ts`** — Host-Dienste auflösen, mounten und den obligatorischen bidirektionalen Routen-Sync verdrahten:

```ts
import { config } from '@wippy-fe/proxy'   // synchroner Getter — kein await nötig
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

**Registrieren Sie sie** in der `_index.yaml` Ihres Moduls (das ist Betreiber-/Deployment-Policy — siehe [Micro Frontend Apps (view.page)](../frontend-registry/view-page.md)):

```yaml
- name: admin
  kind: registry.entry
  meta:
    type: view.page
    name: admin
    announced: true        # in der Navigationsleiste des Hosts anzeigen
    url: /app
    base_path: app/admin
    entry_point: app.html
    mountRoute: /admin/:part(.*)*
```

Rufen Sie das Make-Target des Moduls auf, um in das ausgelieferte Verzeichnis
zu bauen, und liefern Sie die Ausgabe dort aus, wohin `url + base_path` zeigt;
der Host rendert sie unter `/admin`. Das Makefile-Rezept verwendet
`npm run build -- --outDir <abs-or-relative> --emptyOutDir`; `make.ps1`
implementiert dasselbe Target für Windows, und `make.bat` ruft lediglich
`make.ps1` auf. Vollständige Anleitung: [Micro Frontend App](./micro-frontend-app.md).

---

## Beispiel 2 — Web Component (Vue)

Ein Custom Element, das der Host im DOM der Page (Shadow DOM) mountet, einbettbar aus jeder Page oder jedem Chat-Artefakt. Repo: [`frontend/web-components/reaction-bar`](https://github.com/wippyai/app/tree/main/frontend/web-components/reaction-bar).

**`package.json`** — der `wippy`-Block deklariert das Tag, die Props (HTML-Attribute) und die Events:

```json
{
  "name": "@example/reaction-bar",
  "specification": "wippy-component-1.0",
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

**`src/index.ts`** — eine Vue-Komponente in `WippyVueElement` einwickeln und registrieren. `define(import.meta.url, …)` liest den vom Host angehängten Query-Parameter `?declare-tag=`, deshalb muss es `import.meta.url` verwenden:

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
      hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const, // Host-Theme + PrimeVue in den Shadow Root ziehen
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

**`src/app/reaction-bar.vue`** — Props lesen und Events auslösen mit den Composables aus `@wippy-fe/webcomponent-vue`:

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

(`useComponentProps` / `useComponentEvents` sind dünne Wrapper um `useProps()` / `useEvents()`, definiert in `src/constants.ts`.)

**Registrieren Sie sie** als `view.component` (alle drei Tore sind für den Autoload erforderlich — siehe [Web Components (view.component)](../frontend-registry/view-component.md)):

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

Bauen Sie sie, und jede Page (oder jedes Chat-Artefakt) kann das Tag verwenden:

```html
<example-reaction-bar reactions='["👍","🎉"]'></example-reaction-bar>
```

Vollständige Anleitung: [Web Component](./web-component.md).

---

## Mehr entdecken

Das Repo [`app`](https://github.com/wippyai/app) liefert mehrere lauffähige Web Components unter [`frontend/web-components/`](https://github.com/wippyai/app/tree/main/frontend/web-components):

| Komponente | Zeigt |
|---|---|
| `reaction-bar` | Props + Auslösen von Events |
| `counter-persist` | Zustand, der Reloads überlebt, via `@wippy-fe/pinia-persist` |
| `chart-circle` | Bundling einer Drittanbieter-Bibliothek (Chart.js) im Shadow DOM |
| `mermaid` | Children-Inhalte (`<template data-type="…">`) + ein Lazy-Fallback-Bundle |
| `markdown` | `markdown-it` + `sanitize-html` |
| `websocket-log` | Live-Daten über `on(...)`-Topic-Subscriptions |
| `model-gallery` | Authentifizierte API-Aufrufe über den Proxy + PrimeVue im Shadow DOM |

Zum Theming beider Artefakte lesen Sie [Theming](./theming.md) → [Theming: Micro Frontend Apps](./micro-frontend-app-theming.md) / [Theming: Web Components](./web-component-theming.md). Zum lokalen Betrieb ohne vollständigen Host siehe [Host-less Mode](./host-less-mode.md).
