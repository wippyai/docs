---
title: "빠른 시작"
description: "Vue 마이크로 프런트엔드 앱 또는 웹 컴포넌트를 등록하는 Wippy 전용 통합 레시피입니다."
---

# 빠른 시작

이 페이지는 공개 [`wippyai/app`](https://github.com/wippyai/app) 저장소에서 가져온 두 가지 압축된 Vue 통합 레시피, 즉 **마이크로 프런트엔드 앱**과 **웹 컴포넌트**를 제공합니다. 코드 조각은 Web Host 1.0.56과 공개 `@wippy-fe/*` 0.0.56 패키지군을 대상으로 합니다. Wippy 전용 메타데이터, 진입 코드, 레지스트리 선언에 집중하며 일반적인 Vite 스캐폴딩, 의존성 설치, 백엔드 설정은 생략합니다. 이 발췌를 독립 실행형 프로젝트로 취급하지 말고 링크된 저장소에서 완전한 애플리케이션을 확인하세요.

## 사전 요구 사항

- [`wippy/views`](../../framework/views.md)와 [`wippy/facade`](../../framework/facade.md) 모듈이 연결된 Wippy 백엔드
- 이 예제 기준으로 Node.js 22.12 이상과 Vite 7. Vite 7은 Node 20.19 이상 또는 22.12 이상을 요구하며 이 문서는 Node 22 릴리스 계열을 사용합니다.
- `@wippy-fe/vite-plugin` 0.0.56은 Vite 5와 6도 허용합니다. 해당 버전을 선택했다면 그 Vite 릴리스의 Node 요구 사항을 따르세요.
- 대상 Web Host에 맞춰 선택한 일관된 `@wippy-fe/*` 패키지군. 이 기준에서는 Web Host `1.0.56`과 정확히 `0.0.56`인 공개 패키지를 사용합니다.
- 대상 Web Host의 `import-map.json`. 사용하지 않는 키를 포함한 모든 나열 키를 external로 지정하고, import한 정확한 지정자가 맵에 없을 때만 번들에 포함합니다.

소비자 도구 체인은 선택한 Vite 버전의 제약을 받으며 Web Host 소스 저장소에는 별도의 Node/Vite 개발 도구 체인이 있습니다. 대상 릴리스를 변경할 때 둘 다 확인하세요. 전체 도구 체인 계약은 [빌드 시스템](./build-system.md)을 참조하세요.

---

## 레시피 1: 마이크로 프런트엔드 앱(Vue)

Web Host가 선택한 페이지 엔진(기본은 iframe, 또는 Web Fragment)으로 렌더링하는 완전한 Vue 3 SPA입니다. 저장소: [`frontend/applications/main`](https://github.com/wippyai/app/tree/master/frontend/applications/main).

**`package.json`** — `wippy` 블록에서 페이지 유형과 호스트가 주입할 CSS를 선언합니다.

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

**`src/app.ts`** — 호스트 서비스를 해석하고 마운트하며 필수 양방향 라우트 동기화를 연결합니다.

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

모듈의 `_index.yaml`에 **등록**합니다. 이는 운영자/배포 정책입니다. [마이크로 프런트엔드 앱(view.page)](../frontend-registry/view-page.md)을 참조하세요.

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

모듈의 Make 대상을 호출해 제공 디렉터리로 빌드합니다. `url + base_path`가 가리키는 곳에서 출력을 제공하면 호스트가 `/admin`에 렌더링합니다. Makefile 레시피는 `npm run build -- --outDir <abs-or-relative> --emptyOutDir`를 사용합니다. `make.ps1`은 Windows에서 같은 대상을 구현하고 `make.bat`는 `make.ps1`만 호출합니다. 전체 절차는 [마이크로 프런트엔드 앱](./micro-frontend-app.md)을 참조하세요.

---

## 레시피 2: 웹 컴포넌트(Vue)

호스트가 페이지 DOM(Shadow DOM)에 마운트하며 어느 페이지나 채팅 아티팩트에도 삽입할 수 있는 커스텀 엘리먼트입니다. 저장소: [`frontend/web-components/reaction-bar`](https://github.com/wippyai/app/tree/master/frontend/web-components/reaction-bar).

**`package.json`** — `wippy` 블록에서 태그, props(HTML 속성), 이벤트를 선언합니다.

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

**`src/index.ts`** — Vue 컴포넌트를 `WippyVueElement`로 감싸 등록합니다. `define(import.meta.url, …)`는 호스트가 붙인 `?declare-tag=` 쿼리를 읽으므로 반드시 `import.meta.url`을 사용해야 합니다.

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

**`src/app/reaction-bar.vue`** — `@wippy-fe/webcomponent-vue` composable로 props를 읽고 이벤트를 발생시킵니다.

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

(`useComponentProps`/`useComponentEvents`는 `src/constants.ts`에 정의된 얇은 `useProps()`/`useEvents()` 래퍼입니다.)

`view.component`로 **등록**합니다. 자동 로드에는 세 게이트가 모두 필요합니다. [웹 컴포넌트(view.component)](../frontend-registry/view-component.md)를 참조하세요.

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

빌드 후 어느 페이지나 채팅 아티팩트에서도 태그를 사용할 수 있습니다.

```html
<example-reaction-bar reactions='["👍","🎉"]'></example-reaction-bar>
```

전체 절차는 [웹 컴포넌트](./web-component.md)를 참조하세요.

---

## 더 살펴보기

[`app`](https://github.com/wippyai/app) 저장소는 [`frontend/web-components/`](https://github.com/wippyai/app/tree/master/frontend/web-components)에 여러 실행 가능한 웹 컴포넌트를 제공합니다.

| 컴포넌트 | 보여 주는 내용 |
|---|---|
| `reaction-bar` | Props와 이벤트 발생 |
| `counter-persist` | `@wippy-fe/pinia-persist`로 다시 로드해도 유지되는 상태 |
| `chart-circle` | Shadow DOM에 타사 라이브러리(Chart.js) 번들링 |
| `mermaid` | 자식 콘텐츠(`<template data-type="…">`)와 지연 로드 대체 번들 |
| `markdown` | `markdown-it`과 `sanitize-html` |
| `websocket-log` | `on(...)` 토픽 구독을 통한 실시간 데이터 |
| `model-gallery` | 프록시를 통한 인증 API 호출과 Shadow DOM의 PrimeVue |

두 아티팩트의 테마 설정은 [테마 작성](./theming.md) → [테마: 마이크로 프런트엔드 앱](./micro-frontend-app-theming.md)/[테마: 웹 컴포넌트](./web-component-theming.md)를 읽으세요. 전체 호스트 없이 로컬에서 실행하려면 [호스트 없이 실행](./host-less-mode.md)을 참조하세요.
