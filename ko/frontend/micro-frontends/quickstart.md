---
title: "퀵스타트"
description: "공개 wippyai/app 저장소에서 가져온 두 개의 엔드투엔드 예제 — 마이크로 프론트엔드 앱(Vue)과 웹 컴포넌트(Vue). 각각 최소한의…"
---

# 퀵스타트

공개 [`wippyai/app`](https://github.com/wippyai/app) 저장소에서 가져온 두 개의 엔드투엔드 예제 — **마이크로 프론트엔드 앱**(Vue)과 **웹 컴포넌트**(Vue)입니다. 각각 최소한의 파일, 산출물을 백엔드에 등록하는 방법, 빌드하는 방법을 보여줍니다. 완전하고 실행 가능한 소스는 저장소 링크를, 각 옵션의 자세한 내용은 심화 문서를 따라가세요.

**사전 요구 사항:** [`wippy/views`](../../framework/views.md)와 [`wippy/facade`](../../framework/facade.md) 모듈이 연결된 Wippy 백엔드, Node.js 22 이상, Vite 7, 그리고 대상 웹 호스트에 맞게 선택된 현행 일관 `@wippy-fe/*` 패키지 계열. 이 툴체인 요구 사항은 선택된 웹 호스트 패키지에서 나오므로, 그 패키지가 바뀌면 다시 확인하세요. 대상 웹 호스트의 `import-map.json`을 가져와, 사용하지 않는 것을 포함해 나열된 모든 키를 외부 모듈로 지정하고, 정확한 스펙파이어가 없을 때에만 임포트한 것을 번들에 포함하세요. 툴체인은 [빌드 시스템](./build-system.md)을 참고하세요.

---

## 예제 1 — 마이크로 프론트엔드 앱 (Vue)

웹 호스트가 선택된 페이지 엔진(기본은 iframe, 또는 Web Fragment)으로 렌더링하는 완전한 Vue 3 SPA입니다. 저장소: [`frontend/applications/main`](https://github.com/wippyai/app/tree/main/frontend/applications/main).

**`package.json`** — `wippy` 블록이 이를 페이지로 선언하고 호스트가 주입할 CSS를 지정합니다:

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

**`src/app.ts`** — 호스트 서비스를 해석하고, 마운트하고, 필수인 양방향 라우트 동기화를 연결합니다:

```ts
import { config } from '@wippy-fe/proxy'   // 동기 게터 — 얻는 데 await가 필요 없습니다
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

모듈의 `_index.yaml`에 **등록하세요**(이는 운영자/배포 정책입니다 — [마이크로 프론트엔드 앱 (view.page)](../frontend-registry/view-page.md) 참조):

```yaml
- name: admin
  kind: registry.entry
  meta:
    type: view.page
    name: admin
    announced: true        # 호스트 내비게이션 사이드바에 표시
    url: /app
    base_path: app/admin
    entry_point: app.html
    mountRoute: /admin/:part(.*)*
```

모듈의 Make 타깃을 호출해 서빙 디렉터리로 빌드한 뒤, `url + base_path`가 가리키는
곳에서 출력을 서빙하세요. 호스트가 이를 `/admin`에 렌더링합니다.
Makefile 레시피는
`npm run build -- --outDir <abs-or-relative> --emptyOutDir`를 사용합니다. `make.ps1`은
Windows용으로 동일한 타깃을 구현하고, `make.bat`은 `make.ps1`을 호출하기만 합니다.
전체 안내: [마이크로 프론트엔드 앱](./micro-frontend-app.md).

---

## 예제 2 — 웹 컴포넌트 (Vue)

호스트가 페이지 DOM(Shadow DOM)에 마운트하는 커스텀 엘리먼트로, 어떤 페이지나 채팅 아티팩트에서도 임베드할 수 있습니다. 저장소: [`frontend/web-components/reaction-bar`](https://github.com/wippyai/app/tree/main/frontend/web-components/reaction-bar).

**`package.json`** — `wippy` 블록이 태그, props(HTML 어트리뷰트), 이벤트를 선언합니다:

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

**`src/index.ts`** — Vue 컴포넌트를 `WippyVueElement`로 감싸 등록합니다. `define(import.meta.url, …)`는 호스트가 덧붙이는 `?declare-tag=` 쿼리를 읽으며, 그래서 반드시 `import.meta.url`을 사용해야 합니다:

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
      hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const, // 호스트 테마 + PrimeVue를 섀도우 루트로 가져옵니다
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

**`src/app/reaction-bar.vue`** — `@wippy-fe/webcomponent-vue` 컴포저블로 props를 읽고 이벤트를 방출합니다:

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

(`useComponentProps` / `useComponentEvents`는 `src/constants.ts`에 정의된 얇은 `useProps()` / `useEvents()` 래퍼입니다.)

`view.component`로 **등록하세요**(자동 로드에는 세 관문이 모두 필요합니다 — [웹 컴포넌트 (view.component)](../frontend-registry/view-component.md) 참조):

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

빌드하고 나면 어떤 페이지(또는 채팅 아티팩트)에서든 태그를 사용할 수 있습니다:

```html
<example-reaction-bar reactions='["👍","🎉"]'></example-reaction-bar>
```

전체 안내: [웹 컴포넌트](./web-component.md).

---

## 더 살펴보기

[`app`](https://github.com/wippyai/app) 저장소는 [`frontend/web-components/`](https://github.com/wippyai/app/tree/main/frontend/web-components) 아래에 실행 가능한 여러 웹 컴포넌트를 제공합니다:

| 컴포넌트 | 보여주는 것 |
|---|---|
| `reaction-bar` | Props + 이벤트 방출 |
| `counter-persist` | `@wippy-fe/pinia-persist`로 리로드에도 살아남는 상태 |
| `chart-circle` | Shadow DOM에 서드파티 라이브러리(Chart.js) 번들링 |
| `mermaid` | 자식 콘텐츠(`<template data-type="…">`) + 지연 폴백 번들 |
| `markdown` | `markdown-it` + `sanitize-html` |
| `websocket-log` | `on(...)` 토픽 구독을 통한 실시간 데이터 |
| `model-gallery` | 프록시를 통한 인증된 API 호출 + Shadow DOM 안의 PrimeVue |

두 산출물의 테마 적용은 [테마 적용](./theming.md) → [테마 적용: 마이크로 프론트엔드 앱](./micro-frontend-app-theming.md) / [테마 적용: 웹 컴포넌트](./web-component-theming.md)를 읽으세요. 전체 호스트 없이 로컬에서 실행하려면 [호스트리스 모드](./host-less-mode.md)를 참고하세요.
