---
title: "Proxy API"
description: "자식 앱과 웹 컴포넌트는 proxy 런타임(proxy.js)을 통해 Wippy 호스트와 통신합니다. 여러분의 코드는 그 런타임과 직접 대화하지 않으며 —…"
---

# Proxy API

자식 앱과 웹 컴포넌트는 proxy 런타임(`proxy.js`)을 통해 Wippy 호스트와 통신합니다. 여러분의 코드는 그 런타임과 직접 대화하지 않으며, 그 위에 놓인 얇은 동기 파사드인 **`@wippy-fe/proxy`** 에서 이름 있는 getter를 import합니다. 동일한 import가 두 서피스 모두에서 동작합니다:

- **마이크로 프론트엔드 앱(`view.page`)** 은 호스트가 `proxy.js`를 주입하는 srcdoc iframe 안에서 실행됩니다.
- **웹 컴포넌트(`view.component`)** 는 호스트 페이지에서 ESM 모듈로 실행되며, 호스트가 import map을 통해 `@wippy-fe/proxy`를 제공합니다.

각 컨텍스트에 런타임이 로드되는 방식은 [Proxy 및 격리](../web-host/proxy-isolation.md)를 참고하세요.

## 초기화

`@wippy-fe/proxy`는 동기 getter를 export합니다 — `host`, `api`, `on`, `config`, `state`, `ws`, `logger`, `sanitize`, `html`, `loadCss`, `loadWebComponent`, `loadByTagName`, `hostCss`, `define`, `classifyLink`, `installVueWarnSuppressor`, `addIcons`, `tailwindConfig`. 필요한 것을 import해서 바로 사용하세요. `getWippyApi`도, `instance`도, 기다려야 할 `GetConfig`/`SetConfig` 핸드셰이크도 **없습니다**.

동기 getter 패턴은 마이크로 프론트엔드 앱과 웹 컴포넌트가 공유합니다:

```ts
import { host, api, config, state, ws, logger } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const agents = await api.get('/api/v1/agents')   // api는 axios입니다. await 대상은 HTTP 호출이지 `api`를 얻는 과정이 아닙니다
const token = config.auth.token
```

iframe 및 Web Fragment 앱은 proxy `@visibility` 토픽을 통해 생명주기
가시성을 전달받습니다. 직접 웹 컴포넌트는 그렇지 않으며,
`@wippy-fe/webcomponent-vue`의 `useHostVisibility()` 또는
`useHostVisibilityRefresh()`나 그에 대응하는 `WippyElement` API를 사용하세요.

이 getter들은 **동기**입니다 — `host`, `api`, `on`, `config` 등은 코드가 실행되는 순간 사용할 수 있습니다. 호스트는 (`view.page` 앱과 `view.component` 웹 컴포넌트 모두에 대해) 런타임이 로드되기 **전에 동기적으로** 자식 config를 주입하므로, 스크립트가 실행되기 전에 런타임이 초기화됩니다. getter를 *얻기* 위해 `await`할 일은 없고, `GetConfig`/`SetConfig` 핸드셰이크도 없습니다. 여러분이 작성하는 유일한 `await`는 실제 비동기 작업(`api`를 통한 HTTP 호출, `state` 읽기 등)에 대한 것입니다.

개발 중에 대상 Web Host 릴리스의 `import-map.json`을 한 번 가져와서
그 `imports` 객체의 모든 키를 Rollup external로 사용하세요. 여기에는
`@wippy-fe/proxy`도 포함됩니다. 패키지 하나만 담거나 import된 것만 담은
external 목록을 관리하지 마세요. Web Host 태그가 바뀌거나, 의존성을 추가하면서
그 정확한 스펙파이어를 external로 둘 수 있는지 확인할 때만 다시 가져오세요:

```typescript
// vite.config.ts (가져온 응답을 import-map.json으로 저장한 뒤)
import { readFileSync } from 'node:fs'

const hostImportMap = JSON.parse(
  readFileSync(new URL('./import-map.json', import.meta.url), 'utf8'),
)

export default defineConfig({
  build: {
    rollupOptions: {
      external: Object.keys(hostImportMap.imports),
    },
  },
})
```

### TypeScript 타입

proxy 타입 — `AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi` 및 WebSocket 메시지 타입 — 은 어떤 패키지의 이름 있는 export가 아니라 `@wippy-fe/types-global-proxy`의 **앰비언트 선언**으로 제공됩니다. `tsconfig.json`의 `types`에 추가하거나 triple-slash 참조를 사용하면 import 없이 전역에서 사용할 수 있습니다:

```jsonc
// tsconfig.json
{ "compilerOptions": { "types": ["@wippy-fe/types-global-proxy"] } }
```

```typescript
// AppConfig, ProxyApiInstance 등은 앰비언트 전역입니다 — import 없이 바로 타입 표기에 사용하세요:
function render(cfg: AppConfig) { /* … */ }
type HostApi = ProxyApiInstance['host']   // HostApi는 별도 export가 아니라 이 인덱스 타입입니다
```

위의 proxy API에는 `import … from '@wippy-fe/shared'`가 **없습니다**. `@wippy-fe/shared`는 패키지 간 공유 타입과 `GLOBAL_*` 이름 상수를 담고 있으며, `0.0.52`부터는 런타임 retained-WC
헬퍼인 `readWippyVisibility`, `setWippyVisibility`,
`WIPPY_VISIBILITY_ATTRIBUTE`도 export합니다. 직접 WC 작성자는 보통
`@wippy-fe/webcomponent-vue`의 `useHostVisibility()` 또는
`useHostVisibilityRefresh()`를 사용하며, proxy `@visibility` 이벤트는
iframe/Web Fragment 채널로 남아 있습니다.

### 내부 구현(사용 금지)

런타임은 자체 용도로 몇 가지 전역을 설치합니다 — `window.$W`, `window.getWippyApi`, `window.initWippyApi`, 그리고 `window.__WIPPY_*` 계열입니다. **애플리케이션 및 컴포넌트 코드는 절대로 이들을 읽거나 덮어써서는 안 됩니다.** 항상 `@wippy-fe/proxy`를 거치세요. 실수로 덮어쓰지 않도록 하기 위해 나열해 둔 것뿐입니다 — [Proxy 및 격리 § 내부 구현](../web-host/proxy-isolation.md#internals--do-not-read-or-override)을 참고하세요.

> 여기서 설명하는 `@wippy-fe/proxy`가 자식 코드가 사용하는 API입니다. 호스트 자체의 부트스트랩인 `initWippyApp(config, rootContainer?)`은 모듈 임베드 / 파사드 경로에서 Web Host 전체를 마운트합니다. 자식 앱 코드는 이를 절대 호출하지 않습니다.

---

## Config

### `config`

호스트가 전달하는 자식 애플리케이션 설정입니다. 함수가 아닌 평범한 객체이며, 직접 import해서 동기적으로 읽을 수 있습니다. 새 문서는 현재의 `wippy-context-2.0` 계약만을 대상으로 합니다.

```typescript
import { config } from '@wippy-fe/proxy'

const token = config.auth.token
```

```typescript
interface ChildAppConfig {
  $schema: 'wippy-context-2.0'
  auth: {
    token: string
    expiresAt: string
  }
  env: {
    APP_API_URL: string
    APP_AUTH_API_URL: string
    APP_WEBSOCKET_URL: string
    [key: string]: string | undefined
  }
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: Record<string, string>
  themeMode?: 'auto' | 'light' | 'dark'
  theming: {
    global?: {
      customCSS?: string
      cssVariables?: Record<string, string>
      icons?: Record<string, unknown>
      iconSets?: Record<string, Record<string, unknown>>
    }
  }
  context: {
    resourceId: string
    resourceType: 'page' | 'artifact'
    route?: string
    [key: string]: unknown
  }
  selfPageId?: string
  mountRoutes?: Record<string, string>
}
```

동적 페이지에서 호스트 URL이 `/c/page-id/something/else?foo=1`인 경우:
- `config.context?.route`는 `/something/else?foo=1`을 담습니다.
- `config.path`는 `wippy-context-2.0` 이전 페이로드에서 온 사용 중단된 호환 필드이며 새 코드에서는 사용하지 않아야 합니다.

---

## 호스트 제어

### `host`

호스트 통신 API(`HostApi`)입니다. 직접 import해서 동기적으로 사용합니다.

```typescript
import { host } from '@wippy-fe/proxy'
```

---

### `host.setThemeMode(mode)` 및 `host.getThemeMode()`

테마 모드는 AppConfig가 실어 나르는 호스트 상태입니다. 전환은 오직
공개 proxy API를 통해서만 하세요:

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  await new Promise<void>((resolve, reject) => {
    const unsubscribe = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      unsubscribe()
      const currentMode = host.getThemeMode()
      if (currentMode !== mode) {
        reject(new Error(`Theme propagation mismatch: ${currentMode}`))
        return
      }
      resolve()
    })

    // 빠른 전파 이벤트를 놓치지 않도록 명령보다 먼저 구독합니다.
    host.setThemeMode(mode)
  })
}

await setThemeMode('dark')
```

허용되는 모드는 `auto`, `light`, `dark`입니다. `auto`는 운영체제
설정을 따릅니다. 변경은 호스트에 적용되고, AppConfig에 다시 기록되며,
살아 있는 페이지 iframe과 웹 컴포넌트에 브로드캐스트되고, 중첩된 Wippy
컨테이너로 전달됩니다. 적용된 자식 상태를 기다려야 하는 코드에서는
`@theme`를 구독하세요. 컴포넌트 언마운트 시 구독을
해제하세요.

호스트는 영속화를 담당하지 않습니다. 임베딩 파사드가 호스트 테마 변경
이벤트를 수신해 사용자 선택을 영속화하며, 자세한 내용은
[테마 영속화](../web-host/theme-persistence.md)에 설명되어 있습니다.

`w-theme-dark` / `w-theme-light` 클래스를 추가하거나 제거하지 말고, 내부의
`applyThemeMode`를 호출하지 말고, AppConfig 스토어를 변경하지 말고, proxy 메시지를
합성하지 말고, `window.getWippyApi`를 사용하지 마세요. 이들은 Web Host 구현
세부사항이며 애플리케이션이나 브라우저 테스트용 API가 아닙니다. 런타임 테스트는
`host.setThemeMode()`를 사용하고, 전파된 `@theme` 이벤트를 기다린 뒤
`host.getThemeMode()`로 검증하고 나서 외형을 캡처해야 합니다. AppConfig는
호스트에서 자식으로 가는 전송 수단입니다. 그 내부 스토어를 변경하거나 앞서 import한
config 스냅샷을 완료 신호로 삼지 마세요.

`host.applyTheme()` 메서드는 존재하지 않습니다.

---

### `host.startChat(agentToken, options?)`

제공된 에이전트 시작 토큰으로 새 채팅 세션을 엽니다.

```typescript
host.startChat(agentToken: string, options?: { sidebar?: boolean }): void
```

| 파라미터 | 타입 | 기본값 | 설명 |
|-----------|------|---------|-------------|
| `agentToken` | `string` | — | 어떤 에이전트를 시작할지 식별하는 토큰 |
| `options.sidebar` | `boolean` | `false` | `true`는 오른쪽 사이드바 패널에서, `false`는 메인 영역에서 채팅을 엽니다 |

```typescript
host.startChat('my-agent-token')                     // 메인 영역
host.startChat('my-agent-token', { sidebar: true })  // 오른쪽 사이드바
```

---

### `host.openSession(sessionId, options?)`

UUID로 기존 채팅 세션을 엽니다.

```typescript
host.openSession(sessionId: string, options?: { sidebar?: boolean }): void
```

```typescript
host.openSession('abc-123-uuid', { sidebar: false })
```

---

### `host.navigate(url)`

호스트에 SPA 내비게이션을 요청합니다. 지원되는 패턴:

- `/c/<page-id>` — 동적 페이지로 이동
- `/c/<page-id>/<sub-path>` — 하위 경로가 있는 동적 페이지
- `/chat/<session-id>` — 채팅 세션 열기
- 레지스트리 엔트리에 `mountRoute`가 있는 페이지가 점유한 모든 마운트 라우트

```typescript
host.navigate(url: string): void
```

```typescript
host.navigate('/c/my-page-id')
host.navigate('/chat/session-uuid')
host.navigate('/keeper')
```

> **managed 레이아웃 주의사항.** `startChat`, `openSession`, `openArtifact`, `navigate`는 표준 호환 셸(채팅 뷰, 오른쪽 패널, 루트 라우트)을 대상으로 합니다. `fe_mode = managed`에서는 여전히 디스패치되지만 내장 렌더링 서피스가 없습니다. 대신 선언된 패널을 통해 채팅, 아티팩트, 하위 라우트를 렌더링하세요. [멀티 패널 레이아웃 § 모드별 동작 범위](../web-host/multi-panel-layout.md#what-works-in-which-mode)를 참고하세요.

---

### `host.onRouteChanged(internalRoute, navId?)` — 저수준 라우터 연동

페이지의 내부 라우트가 바뀌었을 때 호스트에 알립니다. 호스트는 자식의 라우트를 포함하도록 브라우저 URL 표시줄을 갱신합니다. 이 호출은 **필수**입니다 — 호출하지 않으면 호스트 URL이 페이지 루트에 머물고 자식 내비게이션에 대해 브라우저 뒤로 가기 버튼이 동작하지 않습니다.

```typescript
host.onRouteChanged(internalRoute: string, navId?: number): void
```

이식 가능한 Vue 애플리케이션은 `@wippy-fe/router`의 `createAppRouter()`를 사용합니다. 이 패키지가 해당 호출, 대응하는 `@history` 구독, 정규화, 에코 루프 억제를 모두 담당합니다. 애플리케이션 코드에서 그 구성요소들을 수동으로 연결하지 마세요. 이 메서드는 플랫폼 어댑터 작성자와 Vue가 아닌 통합을 위해 계속 문서화되어 있습니다.

---

### `host.confirm(options)` → `Promise<boolean>`

PrimeVue 확인 다이얼로그를 표시합니다. 사용자가 수락하면 `true`, 거부하거나 닫으면 `false`로 resolve됩니다.

```typescript
host.confirm(options: LimitedConfirmationOptions): Promise<boolean>
```

```typescript
const confirmed = await host.confirm({
  message: 'Delete this item permanently?',
  header: 'Confirm Delete',
  icon: 'tabler:trash',
  acceptLabel: 'Delete',
  rejectLabel: 'Cancel',
  acceptClass: 'p-button-danger',
})

if (confirmed) {
  await api.delete('/api/v1/items/123')
}
```

---

### `host.toast(options)`

PrimeVue 토스트 알림을 표시합니다.

```typescript
host.toast(options: ToastMessageOptions): void
```

| `severity` | 외형 |
|------------|-----------|
| `success` | 초록 |
| `info` | 파랑 |
| `warn` | 노랑 |
| `error` | 빨강 |

```typescript
host.toast({
  severity: 'success',
  summary: 'Saved',
  detail: 'Your changes have been saved.',
  life: 3000,
})
```

---

### `host.openArtifact(artifactUUID, options?)`

사이드바 또는 모달에서 아티팩트를 엽니다.

```typescript
host.openArtifact(
  artifactUUID: string,
  options?: { target?: 'sidebar' | 'modal' }
): void
```

기본 대상은 `'sidebar'`입니다.

```typescript
host.openArtifact('artifact-uuid-123', { target: 'modal' })
```

---

### `host.setContext(context, sessionUUID?, source?)`

현재 채팅 세션에 컨텍스트 데이터를 보냅니다. 아직 열린 세션이 없으면 컨텍스트는 큐에 쌓였다가 `startChat` 또는 `openSession`으로 다음에 열리는 세션에 적용됩니다. 선택적으로 컨텍스트를 특정 세션 UUID로 한정하거나 소스 디스크립터로 표시할 수 있습니다.

```typescript
host.setContext(
  context: Record<string, unknown>,
  sessionUUID?: string,
  source?: { type: 'page' | 'artifact', uuid: string, instanceUUID?: string }
): void
```

```typescript
host.setContext({
  currentPage: 'dashboard',
  selectedItemIds: [1, 2, 3],
})
```

---

### `host.classifyLink(url)` → `LinkClassification`

href를 host-nav, child-nav, external, ignore 중 하나로 분류합니다. 자식 config의 `mountRoutes`와 `routePrefix`, 그리고 내장된 시스템 라우트 세그먼트를 사용합니다. 순수 함수이며 부수 효과가 없습니다.

```typescript
host.classifyLink(href: string): LinkClassification

interface LinkClassification {
  kind: 'host-nav' | 'child-nav' | 'external' | 'ignore'
  href: string
  normalizedPath?: string
  targetPageId?: string  // host-nav가 특정 mountRoute와 일치했을 때 설정됨
}
```

```typescript
// 분류기를 활용하는 앵커 핸들러
import { host } from '@wippy-fe/proxy'

document.addEventListener('click', (ev) => {
  const a = (ev.target as HTMLElement)?.closest('a')
  if (!a) return
  const cls = host.classifyLink(a.getAttribute('href') ?? '')

  if (cls.kind === 'host-nav') {
    ev.preventDefault()
    host.navigate(cls.normalizedPath ?? cls.href)
  }
  // child-nav / external / ignore: 기존 핸들러가 처리하도록 둡니다
})
```

Vue 앱에서는 `vue-router`의 `RouterLink`를 `@wippy-fe/router`의 `RouterLink`로 교체하세요 — 내부적으로 `classifyLink`를 사용하며 실제 `RouterLink`와 prop 호환됩니다.

---

### `host.handleError(code, error)`

중앙 집중식 처리를 위해 호스트에 오류를 보고합니다.

```typescript
host.handleError(
  code: 'auth-expired' | 'other',
  error: Record<string, unknown>
): void
```

- `'auth-expired'` — 호스트 재인증 흐름을 트리거합니다
- `'other'` — 일반 오류이며, 로그로 남고 적절한 경우 사용자에게 표시됩니다

```typescript
try {
  await api.get('/protected-endpoint')
} catch (error) {
  if ((error as any).response?.status === 401) {
    host.handleError('auth-expired', error as Record<string, unknown>)
  } else {
    host.handleError('other', error as Record<string, unknown>)
  }
}
```

---

### `host.logout()`

현재 사용자를 로그아웃시키고 세션을 종료합니다.

```typescript
host.logout(): void
```

---

### `host.bridge`

페이지가 `<w-iframe>` 안에 임베드되었을 때의 채널 기반 부모-자식 메시징입니다. 전체 프로토콜은 [Proxy 및 격리 § 부모-자식 브리지](../web-host/proxy-isolation.md#parent-child-bridge)를 참고하세요.

```typescript
// 부모로의 fire-and-forget
host.bridge.post(channel: string, payload?: unknown): void

// 요청/응답 (부모 핸들러의 반환값으로 resolve)
host.bridge.request<T>(
  channel: string,
  payload?: unknown,
  options?: { timeoutMs?: number }
): Promise<T>

// 부모로부터 오는 메시지에 대한 핸들러 등록
host.bridge.on(
  channel: string,
  handler: (payload: unknown) => unknown | Promise<unknown>
): () => void  // 구독 해제 함수를 반환
```

`options.timeoutMs`를 생략하면 `host.bridge.request()`는 기본적으로 10초(`10000` ms) 마감 시간을 사용합니다. 타임아웃 시 반환된 promise는 메시지가 `` Bridge request <id> timed out after <ms>ms `` 인 `Error`로 reject됩니다. 부모에 핸들러가 없는 채널에 대한 요청은 마감 시간을 기다리지 않고 즉시 `` No handler registered for channel "<channel>" `` 로 reject됩니다.

---

### `host.layout`

managed 레이아웃 API에 대한 접근입니다. `hostConfig.layout`이 설정된 경우(즉 `fe_mode = managed`)에만 사용할 수 있습니다. 그 밖의 컨텍스트에서는 `host.layout.snapshot`이 `null`이고 변경 호출은 no-op입니다.

```typescript
const layout = host.layout

// 현재 스냅샷 읽기
if (layout.snapshot) {
  console.log(layout.snapshot.activeBreakpoint)  // 'default' | 'sm' | ...
  console.log(layout.snapshot.panels)             // 패널 정의 맵
  console.log(layout.snapshot.layouts)            // 브레이크포인트를 키로 하는 패널 트리
}

// 변경 구독 (새 스냅샷이 핸들러로 전달됩니다)
import { on } from '@wippy-fe/proxy'

on('@layout-change', (snapshot) => {
  console.log(snapshot.activeBreakpoint)
})

// 변경 연산
layout.resizePanel('right', '40%')
layout.collapsePanel('nav')
layout.expandPanel('nav')
layout.movePanel('right', { relativeTo: 'main', position: 'after' })
layout.removePanel('right')
layout.updatePanel('right', { kind: 'page', id: 'chat-panel' })  // {kind,id}는 콘텐츠를 통째로 교체합니다
layout.updatePanel('right', { props: { artifactId: 'abc-123' } })  // {props}는 기존 props에 얕게 병합됩니다

layout.addFloating('flap', {
  kind: 'component',
  tagName: 'w-right-flap',
  position: { x: 0, y: 200 },
  size: { width: 48, height: 80 },
  dismissable: false,
})
layout.removeFloating('flap')
layout.closeModal('confirm-discard')

// 탭 내부 버스
layout.broadcast('open-chat', { token: 'abc' })       // 1:N (발신자 제외)
layout.send('right', 'open-chat', { token: 'abc' })   // 지정한 패널로 1:1

const off = layout.on('open-chat', ({ payload, sourcePanelId, targetPanelId }) => {
  // 처리
})
off()  // 구독 해제
```

managed 레이아웃 모델 전체는 [멀티 패널 레이아웃](../web-host/multi-panel-layout.md)을 참고하세요.

---

## API

### `api`

다음이 미리 설정된 axios 인스턴스입니다:
- 배포 환경에서 가져온 Base URL
- 모든 요청에 대한 `Authorization: Bearer <token>` 자동 주입

```typescript
import { api } from '@wippy-fe/proxy'

const response = await api.get('/api/v1/users')
const result   = await api.post('/api/v1/items', { name: 'New item' })
```

### 파일 업로드

```typescript
import { api, on } from '@wippy-fe/proxy'

const formData = new FormData()
formData.append('file', file)

const abort = new AbortController()

const response = await api.post('/api/v1/uploads', formData, {
  signal: abort.signal,
  headers: { 'Content-Type': 'multipart/form-data' },
  onUploadProgress: (evt) => {
    if (!evt.total) return
    const pct = Math.round((evt.loaded * 100) / evt.total)
    uploadProgress.value = pct
  },
})

const uploadedUuid = response.data.uuid  // { success: boolean, uuid: string }

// WebSocket으로 처리 상태 추적
on(`upload:${uploadedUuid}`, (msg) => {
  // msg.data.status: 'uploaded' | 'completed' | 'error' | 'processing'
})

// 진행 중인 업로드 취소
abort.abort()
```

최대 파일 크기: 100 MB.

### 파일 다운로드

```typescript
const response = await api.get('/api/v1/uploads/{uuid}/download', {
  responseType: 'blob',
})

const url = URL.createObjectURL(response.data)
const a = document.createElement('a')
a.href = url
a.download = 'filename.pdf'
a.click()
URL.revokeObjectURL(url)
```

### 업로드 정보 조회

```typescript
// 페이지네이션 목록
const list = await api.get('/api/v1/uploads/list', {
  params: { limit: 10, offset: 0 },
})
// list.data.uploads: Array<{ uuid, mime_type, size, status, meta: { filename } }>

// 단일 업로드
const upload = await api.get(`/api/v1/uploads/${uuid}`)
// upload.data: { uuid, mime_type, size, status, meta: { filename, content_sample? } }
```

### SSE 스트리밍

proxy `api`는 fetch 어댑터를 통해 server-sent event 스트림을 지원합니다. 토큰 단위 LLM 완성, 장시간 진행 스트림, 또는 모든 `text/event-stream` 응답에 사용하세요.

> 브라우저 기본 `EventSource`는 사용하지 마세요 — 커스텀 헤더를 붙일 수 없어 proxy의 `Authorization: Bearer` 토큰을 실을 수 없습니다.

```typescript
import { api } from '@wippy-fe/proxy'

const abort = new AbortController()

const response = await api.post('/api/v1/agents/stream', { prompt: 'Hello' }, {
  adapter: 'fetch',          // 필수 — 기본 xhr 어댑터는 본문 전체를 버퍼링합니다
  responseType: 'stream',
  headers: { Accept: 'text/event-stream' },
  signal: abort.signal,
})

const reader = (response.data as ReadableStream<Uint8Array>).getReader()
const decoder = new TextDecoder()
let buffer = ''

try {
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    while (true) {
      const sep = buffer.indexOf('\n\n')
      if (sep === -1) break
      const rawEvent = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)

      const dataLines = rawEvent
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())

      if (dataLines.length === 0) continue
      const payload = dataLines.join('\n')
      if (payload === '[DONE]') return

      try {
        const evt = JSON.parse(payload)
        handleEvent(evt)
      } catch {
        handleText(payload)
      }
    }
  }
} finally {
  reader.releaseLock()
}

// 스트림 취소
abort.abort()
```

모든 요청이 기본적으로 fetch 어댑터를 쓰도록 하려면:

```jsonc
// package.json → wippy.configOverrides, 또는 window.__WIPPY_CONFIG_OVERRIDES__ 에서
{
  "axiosDefaults": { "adapter": "fetch" }
}
```

---

## Surface

Web Host가 이 앱에 할당한 영역의 기하 정보입니다. 그 영역은 대개 브라우저 창이 **아닙니다** — 앱이 여러 패널 중 하나일 수 있으므로 `window.innerWidth`와 뷰포트 단위는 크기 계산의 기준으로 부적절합니다. 전체 계약은 [Surface 이식성](./surface-portability.md)을, 변환 레시피는 [Surface 마이그레이션](./surface-migration.md)을 참고하세요.

### `host.surface.snapshot`

현재 기하 정보이며, 앱의 CSS가 해석하는 것과 동일한 계산된 커스텀 속성에서 다시 읽어 옵니다 — 따라서 `@container wippy-surface (…)` 및 `cqw`가 보는 값과 어긋날 수 없습니다.

```typescript
const { contract, revision, engine, sizing, width, widthUnit, height, heightUnit } = host.surface.snapshot
```

| 필드 | 타입 | 비고 |
|-------|------|-------|
| `contract` | `1` | 계약 버전 |
| `revision` | `number` | 단조 증가하며, 기하 정보가 바뀔 때 증가합니다 |
| `engine` | `'iframe' \| 'fragment' \| 'host'` | `host`는 서피스가 할당되지 않았음을 의미합니다 |
| `sizing` | `'container' \| 'content'` | |
| `width` / `widthUnit` | `number` | 전체 너비, 그리고 그 1%를 CSS 픽셀로 나타낸 값 |
| `height` / `heightUnit` | `number \| null` | content sizing에서는 `null` — 블록 축을 실제로 사용할 수 없습니다 |

### `host.surface.onChange(listener)` → `() => void`

기하 변경을 구독합니다. 멱등한 구독 해제 함수를 반환하며, 정리 시점에 **반드시** 호출해야 합니다.

```typescript
const off = host.surface.onChange((snapshot) => {
  canvas.width = snapshot.width
})
```

### `host.surface.supports(capability)` → `boolean`

```typescript
if (host.surface.supports('block-size')) {
  // 블록 축을 사용할 수 있습니다 (container sizing)
}
```

케이퍼빌리티: `block-size`와 `surface-scroll`은 현재 실제 값을 그대로 응답합니다. `registered-hit-testing`, `native-document-hit-testing`, `owner-visibility`는 예약된 어휘이며 항상 `false`를 보고합니다.

`engine`으로 분기하기보다 `supports()`를 사용하세요 — 중요한 것은 어떤 엔진이 렌더링하는지가 아니라 케이퍼빌리티를 사용할 수 있는지입니다.

### `host.surface.engine` 및 `host.surface.sizing`

스냅샷의 동일한 값에 대한 읽기 전용 단축 접근자입니다. `engine: 'host'`는 코드가 할당된 서피스 없이 호스트 문서에 직접 마운트되었음(또는 독립 실행형 개발 proxy에서 실행 중임)을 의미하며, 스냅샷은 설계상 `width: 0`과 `sizing: 'content'`를 보고합니다.

`engine`은 "서피스가 할당되었는가"를 판단하는 신뢰할 만한 기준이 아닙니다. `<w-iframe>`/`<w-artifact>`로 임베드된 페이지 역시 서피스를 받지 않지만 — 중첩 서피스 지원이 나오기 전까지 중첩 임베드는 제외됩니다 — `engine: 'iframe'`에 `width: 0`으로 보고합니다. 그 구분이 중요할 때는 `snapshot.width`를 확인하세요.

---

## 이벤트

### `on(topic, handler)` → `() => void`

`on`은 호스트의 WebSocket 계층에서 오는 이벤트나 내부 proxy 이벤트를 구독합니다. 구독 해제 함수를 반환합니다.

```typescript
on(topic: string, handler: (event: unknown) => void): () => void
```

토픽은 콜론으로 구분된 세그먼트를 사용합니다. `*`는 단일 세그먼트 와일드카드입니다. 패턴은 매칭 대상 토픽과 세그먼트 개수가 같아야 합니다.

```typescript
import { on } from '@wippy-fe/proxy'

// 다 쓰면 구독 해제
const unsub = on('session:abc:message:*', (msg) => {
  console.log(msg.data)
})
unsub()
```

모든 `on()` 호출은 구독 해제 함수를 반환합니다. 누수를 막기 위해 컴포넌트가 언마운트될 때 항상 호출하세요. iframe 언로드 시 남은 구독은 자동으로 정리되지만, 오래 유지되는 iframe 안에서 마운트/언마운트되는 컴포넌트에는 여전히 명시적 정리가 필요합니다.

```typescript
// Vue Composition API
import { onUnmounted } from 'vue'

const unsub1 = on('session:*:message:*', handler)
const unsub2 = on('artifact:*', handler)

onUnmounted(() => {
  unsub1()
  unsub2()
})
```

```typescript
// 바닐라 / 웹 컴포넌트
import { on } from '@wippy-fe/proxy'

class MyEl extends HTMLElement {
  private unsubs: Array<() => void> = []

  connectedCallback() {
    this.unsubs.push(on('session:*:message:*', handler))
  }

  disconnectedCallback() {
    this.unsubs.forEach(fn => fn())
    this.unsubs = []
  }
}
```

### 내장 토픽

| 토픽 | 핸들러 페이로드 | 설명 |
|-------|-----------------|-------------|
| `@history` | `{ path: string }` | 호스트 URL 변경(SPA 내비게이션). 부모가 새 라우트를 push할 때 발생합니다. |
| `@visibility` | `boolean` | iframe/Web Fragment 가시성 변경. 직접 웹 컴포넌트는 대신 타입이 있는 host-visibility 계약을 사용합니다. |
| `@message` | 전체 WS 메시지 | 모든 WebSocket 메시지. 내부적으로 `*`, `*:*`, `*:*:*`, `*:*:*:*` 를 구독합니다. |
| `@state-error` | `{ error: string, key?: string }` | 상태 저장 작업 실패(할당량 초과, 직렬화 오류). |
| `@layout-change` | `LayoutSnapshot` | managed 레이아웃 스냅샷 갱신. 새 스냅샷이 핸들러로 전달됩니다. `host.layout.snapshot`을 읽는 것과 동일합니다. |
| `@layout-breakpoint` | `{ name: string, width: number }` | 활성 managed 레이아웃 브레이크포인트 변경. `name`은 새 브레이크포인트, `width`는 그 임계값(px)입니다. |

### 와일드카드 패턴

```typescript
// iframe/Web Fragment 페이지 전용. 직접 WC는 useHostVisibility()를 사용합니다.
on('@visibility', (visible: boolean) => { /* 표시되거나 숨겨짐 */ })

// 특정 세션의 모든 세션 메시지
on('session:abc-123:message:*', (msg) => { /* ... */ })

// 모든 세션에 걸친 모든 메시지
on('@message', (msg) => { /* ... */ })

// 구성 요소에 ':'가 포함된 토픽은 인코딩해야 합니다
on(`session:${encodeURIComponent('id:with:colons')}:message:*`, handler)
```

`@history`는 프로토콜 완결성을 위해 나열되어 있습니다. 이식 가능한 Vue 애플리케이션은 `@wippy-fe/router`가 이를 구독하도록 두어야 하며, 애플리케이션이 소유하는 두 번째 핸들러를 추가하지 마세요.

같은 프레임에서 같은 토픽을 여러 번 구독해도 안전합니다. proxy가 호스트 수준에서 중복을 제거합니다. 각 `on()` 호출은 여전히 자신만의 독립적인 구독 해제 핸들을 받습니다.

---

## State

### `state` — iframe 간 키-값 영속화

`state`는 iframe이 파괴되어도 살아남는 호스트 매개 저장소를 제공합니다. 상태는 페이지 또는 아티팩트 UUID 단위로 스코프되며, 각 앱은 격리된 네임스페이스를 갖습니다.

모든 메서드는 기본 스코프를 재정의하기 위한 선택적 `{ scope?: string }` 옵션을 받습니다. 같은 컴포넌트의 여러 인스턴스가 별도의 상태 버킷을 필요로 할 때 `scope`를 사용하세요.

> **스코프 유일성:** 스코프 값은 원시 `state` API에서 그대로 전달되므로 애플리케이션 전체에서 전역적으로 유일해야 합니다. `@wippy-fe/pinia-persist` 플러그인은 시스템 스코프와의 충돌을 막기 위해 커스텀 스코프에 `@custom:` 접두사를 자동으로 붙입니다.

```typescript
import { state } from '@wippy-fe/proxy'

// 쓰기 (fire-and-forget이며, 할당량 초과 시 @state-error가 발생합니다)
await state.set('filters', { search: 'john', status: 'active' })

// 읽기 (키가 없으면 null을 반환)
const filters = await state.get<{ search: string, status: string }>('filters')

// 키 삭제
await state.remove('filters')

// 이 페이지의 모든 상태 삭제
await state.clear()

// 한 번에 전체 읽기 (일괄 하이드레이션에 유용)
const all = await state.getAll()

// 커스텀 스코프
await state.set('count', 42, { scope: 'my-widget-instance-1' })
const count = await state.get<number>('count', { scope: 'my-widget-instance-1' })
```

**메서드 시그니처:**

```typescript
state.get<T = unknown>(key: string, options?: { scope?: string }): Promise<T | null>
state.set(key: string, value: unknown, options?: { scope?: string }): Promise<void>
state.remove(key: string, options?: { scope?: string }): Promise<void>
state.clear(options?: { scope?: string }): Promise<void>
state.getAll(options?: { scope?: string }): Promise<Record<string, unknown>>
```

**권장 iframe/Web Fragment 저장 패턴** — 변경할 때마다가 아니라 페이지가 백그라운드로 갈 때 저장하세요. 직접 WC는 동일한 생명주기 판단에 `useHostVisibility()`를 사용합니다:

```typescript
on('@visibility', async (visible) => {
  if (!visible) {
    await state.set('scrollY', document.documentElement.scrollTop)
    await state.set('formData', currentFormData)
  }
})
```

**제한:** 페이지당 2 MB(JSON 직렬화 기준이며, 호스트가 `hostConfig.stateCache`로 설정 가능). 상태는 호스트 메모리에 존재하므로 iframe 리로드는 견디지만 브라우저 페이지 전체 새로고침은 견디지 못합니다.

### Pinia 연동

Pinia를 사용하는 Vue 앱에서는 `@wippy-fe/pinia-persist`가 영속화를 자동화합니다:

```typescript
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const preloaded = await preloadWippyState()
const pinia = createPinia()
pinia.use(createWippyPersist(preloaded))
app.use(pinia)
```

그런 다음 스토어를 표시합니다:

```typescript
const useMyStore = defineStore('my-store', () => {
  const filters = ref({ search: '' })
  return { filters }
}, {
  wippyPersist: true,
  // 또는: wippyPersist: { pick: ['filters'], debounce: 500 }
})
```

---

## WebSocket

### `ws`

`ws`는 호스트의 WebSocket 연결을 통해 명령을 보냅니다. 응답은 `on()` 토픽 구독으로 도착합니다.

### `ws.send(command)`

Fire-and-forget입니다. 응답이 전달되지 않으므로 관련 토픽을 먼저 구독하세요.

```typescript
ws.send(command: WsCommand): void
```

```typescript
import { ws, on } from '@wippy-fe/proxy'

on('session:my-session:message:*', (msg) => {
  console.log('Response:', msg.data)
})

ws.send({
  type: 'session_message',
  session_id: 'my-session',
  message_id: crypto.randomUUID(),
  data: { text: 'Hello from child app' },
})
```

### `ws.sendWithResponse(command)` → `Promise<WsMessage>`

명령을 보내고 대응하는 서버 응답을 기다립니다. 30초 후 타임아웃됩니다.

```typescript
ws.sendWithResponse(command: WsCommand): Promise<WsMessage>
```

```typescript
const response = await ws.sendWithResponse({
  type: 'session_open',
  start_token: 'my-token',
})
console.log('Session opened:', response.data)
```

### `ws.sendCommand(sessionId, data)`

세션 제어 명령을 위한 편의 래퍼입니다.

```typescript
ws.sendCommand(sessionId: string, data: { command: string, [key: string]: unknown }): void
```

```typescript
ws.sendCommand('session-uuid', { command: 'stop' })
ws.sendCommand('session-uuid', { command: 'model', name: 'gpt-4' })
ws.sendCommand('session-uuid', { command: 'agent', name: 'my-agent' })
```

---

## Logger

### `logger`

iframe 경계를 넘나드는 구조화 로깅입니다. 로그는 자식 → 호스트 → 부모 웹사이트로 흐르고, 그곳에서 트랜스포트(Sentry, Graylog, 콘솔)가 이를 처리합니다. 각 자식의 컨텍스트(`resourceId`, `resourceType`, 중첩 깊이)가 모든 로그 항목에 자동으로 첨부됩니다.

프로덕션 모니터링에 나타나기를 원하는 모든 것에는 `console.log/error` 대신 `logger`를 사용하세요.

```typescript
import { logger } from '@wippy-fe/proxy'

logger.debug('Component mounted', { pageId: 'abc' })
logger.info('User loaded page', { pageId: 'abc' })
logger.warn('Slow API response', { ms: 3200 })
logger.error('Failed to save', { endpoint: '/api/save' })
```

### `logger.captureException(error, context?)`

예외를 캡처해 전달합니다. `ProxyConfig.injections.errorCapture`가 `true`이면 처리되지 않은 오류(`window.onerror`, `unhandledrejection`)가 자동으로 캡처됩니다.

```typescript
try {
  await riskyOperation()
} catch (error) {
  logger.captureException(error, { operation: 'riskyOperation' })
}
```

### 브레드크럼과 컨텍스트

```typescript
// 브레드크럼은 디버깅 컨텍스트를 위해 다음 예외에 첨부됩니다
logger.addBreadcrumb({ category: 'navigation', message: 'Navigated to /settings' })
logger.addBreadcrumb({ category: 'ui', message: 'Clicked Save button' })

// 영속 컨텍스트 — 이 자식에서 이후에 나오는 모든 로그에 첨부됩니다
logger.setContext('user', { id: 'user-123', role: 'admin' })

// 태그 — 필터링과 검색을 위한 키/값 쌍
logger.setTag('version', '1.2.0')
logger.setTag('feature', 'dashboard')
```

---

## 웹 컴포넌트

### `loadByTagName(tagName, options?)` → `Promise<void>`

동료 웹 컴포넌트를 HTML 태그 이름으로 로드하고 등록합니다. `customElements.define`이 실행된 후 resolve되므로, 직후에 `document.createElement(tagName)`을 호출해도 안전합니다. 성공 시 해당 태그는 `sanitize` 허용 목록에 자동으로 추가됩니다.

```typescript
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('wc-thread-picker')
await loadByTagName('wc-slow-pkg', { timeoutMs: 60_000 })

// 즉시 사용해도 안전합니다
document.body.appendChild(document.createElement('wc-thread-picker'))
```

`options.timeoutMs`는 스크립트가 추가된 뒤 `customElements.define`을 기다리는 기본 30초 마감 시간을 재정의합니다. 멈추거나 망가진 컴포넌트(404, 파싱 오류, `define` 호출 누락)를 무기한 대기 대신 reject로 드러냅니다.

### `loadWebComponent(componentId, tagName?)` → `Promise<void>`

태그 이름이 아니라 Wippy 레지스트리 아티팩트 id로 웹 컴포넌트를 로드합니다. config 값이나 백엔드 응답에서 레지스트리 id를 받은 경우에 유용합니다.

```typescript
import { loadWebComponent } from '@wippy-fe/proxy'

await loadWebComponent('wippy.components:my-chart')
```

### DOM 스캔 로더 (`<script type="wippy-components-loader">`)

여러 컴포넌트가 필요한 페이지를 위해, proxy는 초기화 시 이런 script 태그를 스캔해 각 항목을 `loadWebComponent`로 로드합니다:

```html
<script type="wippy-components-loader">
{ "wc-foo": "wippy.components:foo", "wc-bar": "wippy.components:bar" }
</script>
```

중복 제거 및 허용 목록 자동 갱신 동작은 `loadByTagName`과 동일합니다.

---

## 유틸리티

### `sanitize(html, options?)` → `string`

현재 proxy 컨텍스트로 스코프된, 기본 허용 목록 방식의 HTML 새니타이저입니다. 채팅 렌더링 기본값(`<p>`, `<a>`, `<code>`, `<table>` 등)과 이 런타임에 현재 등록된 모든 웹 컴포넌트 태그를 결합합니다.

```typescript
import { sanitize, loadByTagName } from '@wippy-fe/proxy'

const safe = sanitize('<p>hi</p><script>alert(1)</script>')
// → '<p>hi</p>'

// loadByTagName 이후에는 해당 태그가 자동으로 허용됩니다:
await loadByTagName('wc-thread-picker')
sanitize('<wc-thread-picker thread-id="42"></wc-thread-picker>')
// → '<wc-thread-picker thread-id="42"></wc-thread-picker>'

// 일회성 추가 태그
sanitize(dialogBody, { extraTags: { 'iconify-icon': ['icon'] } })
```

`sanitize`는 호출할 때마다 태그 허용 목록을 다시 읽으므로, import 이후에 등록된 태그도 반영됩니다.

### `html.inject(sourceHtml, options)` → `Promise<string>`

요소를 마운트하지 않고 소스 HTML을 srcdoc으로 변환합니다. 일반적인 용도에는 `<w-iframe>`을 사용하고, 이 함수는 커스텀 호스팅 인프라를 만들 때만 사용하세요.

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

---

## Config 재정의

페이지는 별도 배포 없이 자식에게 노출되는 일부 config 필드를 페이지 단위로 재정의할 수 있습니다. 재정의 형태는 호환성을 위해 여전히 `customization`을 사용하며, 호스트는 페이지가 `wippy-context-2.0` config를 받기 전에 그 값들을 현재 자식의 `theming.global` 결과에 투영합니다.

### 재정의 설정하기

**레지스트리 페이지(권장):** 페이지의 `_index.yaml`에 `meta.config_overrides`를 설정합니다. 호스트가 이를 콘텐츠 API 응답에 포함시켜 자동으로 주입합니다.

**독립 패키지:** 페이지의 `package.json`에 `wippy.configOverrides`를 설정합니다.

**수동 / 테스트:** `proxy.js`보다 먼저 실행되는 `<script>` 태그에서 `window.__WIPPY_CONFIG_OVERRIDES__`를 설정합니다.

```typescript
window.__WIPPY_CONFIG_OVERRIDES__ = {
  customization: {
    cssVariables: {
      '--p-primary': '#ff6b00',
    },
    customCSS: '.my-page-header { border-radius: 12px; }',
  },
}
```

### 병합 규칙

| 필드 | 병합 동작 |
|-------|---------------|
| `cssVariables` | 호스트 값을 **대체**합니다 — 페이지가 자체 테마를 제공합니다 |
| `customCSS` | 호스트 값을 **대체**합니다 |
| `iconSets` | 추가 방식으로 **병합**됩니다 |
| `axiosDefaults` | **깊은 병합** |
| `routePrefix` | **대체** |
| `apiRoutes` | **깊은 병합** |

페이지가 임베드하는 모든 중첩 자식 — `<w-iframe>`, `<w-artifact>`, `html.inject` 콘텐츠 — 은 페이지의 이미 병합된 config로부터 만들어지며 이를 자동으로 상속하고, 하위 트리 전체로 재귀적으로 이어집니다. 따라서 페이지의 재정의(특히 테마)는 페이지 자신뿐 아니라 그 아래의 모든 것에 전파됩니다.

---

## Vue 유틸리티

### `installVueWarnSuppressor(app)`

현재의 일관된 `@wippy-fe/proxy` 패밀리에서 사용할 수 있습니다. `app.component(...)`가 아니라 `customElements.define(...)`으로 등록된 태그에 대한 `[Vue warn]: Failed to resolve component: foo-bar` 경고를 억제합니다. Vue의 템플릿 컴파일러는 인식하지 못하는 웹 컴포넌트 태그에 이런 경고를 내보내며, 요소 자체는 올바르게 렌더링되지만 콘솔이 잡음으로 가득 찹니다.

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/proxy'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.use(router)
app.mount('#app')
```

억제되는 대상:

- 이미 `customElements.define(...)`으로 등록된 태그 — 시스템 태그(`w-iframe`, `w-artifact`, `wippy-loading`, `wippy-error`)와 자동 로드 파이프라인(`loadByTagName`, 스캐너)이 등록한 모든 태그.
- 아직 등록되지 않았지만 커스텀 엘리먼트 명명 형태(`^[a-z][a-z0-9]*-[a-z0-9-]*$`)에 일치하는 태그 — 자동 로드 스크립트가 도착하기 전에 Vue가 렌더링하는 경쟁 구간을 포함합니다.

여전히 경고가 나는 대상:

- **PascalCase 컴포넌트 오타**(`<UsreCard />`). 억제기는 이를 케밥 패턴과 매칭하지 않고 `customElements.get`이 `undefined`를 반환하므로 콘솔로 그대로 전달됩니다 — 실제 버그와 잡음을 구분하는 신호를 보존합니다.

이 함수는 멱등합니다: 같은 `app`에 대한 두 번째 호출은 완전한 no-op입니다. `app.config`에 `Symbol.for('@wippy-fe/proxy/vue-warn-suppressor-installed')` 마커가 심어지며, 리로드 간에 이를 지워야 하는 테스트 설정을 위해 `VUE_WARN_SUPPRESSOR_INSTALLED_MARKER`로 export됩니다.

이미 `warnHandler`가 설치되어 있었다면 `previous`로 보존되며, 억제기가 침묵시키지 않는 경고에 대해 호출됩니다.

### `@wippy-fe/router`의 `createAppRouter(routes, options?)`

srcdoc 서브앱을 위한 표준 메모리 라우터 팩토리입니다. 현재 모든 서브앱이 중복해서 작성하는 보일러플레이트(메모리 히스토리, 호스트로의 `afterEach` 라우트 동기화, `@history` 구독)를 대체합니다:

```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route,
})
app.use(router)
```

---

## 로딩 및 오류 컴포넌트

두 개의 웹 컴포넌트가 (`proxy.js`보다 먼저 주입되는) `loading.js`를 통해 자동 등록됩니다. import나 수동 등록이 필요하지 않습니다.

### `<wippy-loading>`

테마를 인식하는 색상의 전체 화면 로딩 스피너입니다.

| 속성 | 설명 |
|-----------|-------------|
| `title` | 주 텍스트 (예: "Loading...") |
| `subtitle` | 보조 텍스트 |
| `no-bg` | Boolean — 오버레이 용도의 투명 배경 |

```html
<wippy-loading title="Loading..." subtitle="Please wait"></wippy-loading>
<wippy-loading no-bg title="Loading page content..."></wippy-loading>
```

### `<wippy-error>`

심각도에 따라 색상이 달라지는 전체 화면 오류 표시입니다.

| 속성 | 값 | 기본값 |
|-----------|--------|---------|
| `title` | 임의 문자열 | "Something went wrong" |
| `message` | 임의 문자열 | (비어 있음) |
| `icon` | `circle`, `triangle`, `sad` | `circle` |
| `severity` | `danger`, `warning` | `danger` |
| `no-bg` | Boolean | (없음) |

```html
<wippy-error title="Failed to load" message="Server returned 500" severity="danger"></wippy-error>
<wippy-error title="Connection Lost" message="Retrying..." icon="triangle" severity="warning"></wippy-error>
```

두 컴포넌트 모두 Shadow DOM과 `@wippy-fe/theme`의 CSS 변수를 사용하며, 테마 적용 이전 컨텍스트를 위한 하드코딩된 폴백을 포함합니다.

**바닐라 HTML 페이지 권장 패턴:**

```html
<body>
  <wippy-loading id="loader" title="Loading..."></wippy-loading>
  <div id="content" style="display:none"><!-- 콘텐츠 --></div>

  <script type="module">
    import { api, host } from '@wippy-fe/proxy'

    async function init() {
      try {
        // 데이터 가져오기, 페이지 설정...
        document.getElementById('loader').remove()
        document.getElementById('content').style.display = 'block'
      } catch (error) {
        const errorEl = document.createElement('wippy-error')
        errorEl.setAttribute('title', 'Initialization failed')
        errorEl.setAttribute('message', error.message)
        document.getElementById('loader').replaceWith(errorEl)
      }
    }
    init()
  </script>
</body>
```

**Vue 3 — `app.html` 엔트리:**
```html
<div id="app">
  <wippy-loading title="Loading..."></wippy-loading>
</div>
<script type="module" src="./src/app.ts"></script>
```

Vue가 `#app`에 마운트되면 `<wippy-loading>` 요소를 자동으로 대체합니다.
