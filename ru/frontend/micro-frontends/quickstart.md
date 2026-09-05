---
title: "Быстрый старт"
description: "Два сквозных примера — приложение-микрофронтенд (Vue) и веб-компонент (Vue) — взяты из публичного репозитория wippyai/app. Каждый показывает минимальный…"
---

# Быстрый старт

Два сквозных примера — **приложение-микрофронтенд** (Vue) и **веб-компонент** (Vue) — взяты из публичного репозитория [`wippyai/app`](https://github.com/wippyai/app). Каждый показывает минимальный набор файлов, как зарегистрировать артефакт на бэкенде и как его собрать. Переходите по ссылкам в репозиторий за полным работающим исходным кодом, а в подробную документацию — за каждой опцией.

**Предварительные требования:** бэкенд Wippy с подключёнными модулями [`wippy/views`](../../framework/views.md) и [`wippy/facade`](../../framework/facade.md), Node.js 22 или новее, Vite 7 и текущее согласованное семейство пакетов `@wippy-fe/*`, выбранное для целевого Web Host. Эти требования к инструментарию исходят из выбранного пакета Web Host; перепроверяйте их при смене этого пакета. Загрузите `import-map.json` целевого Web Host, вынесите во внешние зависимости каждый перечисленный ключ, включая неиспользуемые, и включайте импортируемый точный спецификатор в бандл только когда он отсутствует. Об инструментарии см. [Система сборки](./build-system.md).

---

## Пример 1 — приложение-микрофронтенд (Vue)

Полноценное SPA на Vue 3, которое Web Host отрисовывает через выбранный движок страниц (по умолчанию iframe или Web Fragment). Репозиторий: [`frontend/applications/main`](https://github.com/wippyai/app/tree/main/frontend/applications/main).

**`package.json`** — блок `wippy` объявляет его страницей и указывает, какой CSS внедряет хост:

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

**`src/app.ts`** — получите сервисы хоста, смонтируйте приложение и подключите обязательную двустороннюю синхронизацию маршрутов:

```ts
import { config } from '@wippy-fe/proxy'   // синхронный геттер — await для получения не нужен
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

**Зарегистрируйте его** в `_index.yaml` вашего модуля (это политика оператора/развёртывания — см. [Приложения-микрофронтенды (view.page)](../frontend-registry/view-page.md)):

```yaml
- name: admin
  kind: registry.entry
  meta:
    type: view.page
    name: admin
    announced: true        # показывать в боковой панели навигации хоста
    url: /app
    base_path: app/admin
    entry_point: app.html
    mountRoute: /admin/:part(.*)*
```

Вызовите Make-цель модуля, чтобы собрать вывод в раздаваемый каталог, затем раздавайте
вывод там, куда указывает `url + base_path`; хост отрисует его по адресу `/admin`.
Рецепт Makefile использует
`npm run build -- --outDir <abs-or-relative> --emptyOutDir`; `make.ps1`
реализует ту же цель для Windows, а `make.bat` лишь вызывает
`make.ps1`. Полное руководство: [Приложение-микрофронтенд](./micro-frontend-app.md).

---

## Пример 2 — веб-компонент (Vue)

Пользовательский элемент, который хост монтирует в DOM страницы (Shadow DOM), встраиваемый с любой страницы или из артефакта чата. Репозиторий: [`frontend/web-components/reaction-bar`](https://github.com/wippyai/app/tree/main/frontend/web-components/reaction-bar).

**`package.json`** — блок `wippy` объявляет тег, props (HTML-атрибуты) и события:

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

**`src/index.ts`** — оберните Vue-компонент в `WippyVueElement` и зарегистрируйте его. `define(import.meta.url, …)` читает параметр запроса `?declare-tag=`, добавляемый хостом, — поэтому он обязан использовать `import.meta.url`:

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
      hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const, // подтянуть тему хоста и PrimeVue в shadow root
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

**`src/app/reaction-bar.vue`** — читайте props и испускайте события с помощью composable-функций `@wippy-fe/webcomponent-vue`:

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

(`useComponentProps` / `useComponentEvents` — тонкие обёртки над `useProps()` / `useEvents()`, определённые в `src/constants.ts`.)

**Зарегистрируйте его** как `view.component` (для автозагрузки требуются все три условия — см. [Веб-компоненты (view.component)](../frontend-registry/view-component.md)):

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

Соберите его, и любая страница (или артефакт чата) сможет использовать тег:

```html
<example-reaction-bar reactions='["👍","🎉"]'></example-reaction-bar>
```

Полное руководство: [Веб-компонент](./web-component.md).

---

## Изучить дальше

Репозиторий [`app`](https://github.com/wippyai/app) содержит несколько работающих веб-компонентов в каталоге [`frontend/web-components/`](https://github.com/wippyai/app/tree/main/frontend/web-components):

| Компонент | Что демонстрирует |
|---|---|
| `reaction-bar` | Props и испускание событий |
| `counter-persist` | Состояние, переживающее перезагрузку, через `@wippy-fe/pinia-persist` |
| `chart-circle` | Включение сторонней библиотеки (Chart.js) в Shadow DOM |
| `mermaid` | Содержимое-потомки (`<template data-type="…">`) и ленивый запасной бандл |
| `markdown` | `markdown-it` + `sanitize-html` |
| `websocket-log` | Живые данные через подписки на топики `on(...)` |
| `model-gallery` | Аутентифицированные вызовы API через прокси и PrimeVue в Shadow DOM |

О темизации любого из артефактов читайте [Темизация](./theming.md) → [Темизация: приложения-микрофронтенды](./micro-frontend-app-theming.md) / [Темизация: веб-компоненты](./web-component-theming.md). Чтобы запустить локально без полного хоста, см. [Режим без хоста](./host-less-mode.md).
