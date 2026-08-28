---
title: "프록시 API"
description: "@wippy-fe/proxy가 노출하는 설정, 호스트 제어, API 접근, 이벤트, 상태, WebSocket, 로깅, 유틸리티 레퍼런스입니다."
---

# 프록시 API

**분류: 부분 통합 코드 조각을 포함한 API 레퍼런스.** 예제는 Host가 전달한 자식, 유효한 배포 URL과 자격 증명, `file`, `uuid`, 이벤트 핸들러, 라우트 같은 애플리케이션 값이 있다고 가정합니다. 독립 실행형 프로젝트가 아니라 한 번에 하나의 API 작업을 보여 줍니다.

자식 앱과 웹 컴포넌트는 프록시 런타임(`proxy.js`)을 통해 Wippy 호스트와 통신합니다. 애플리케이션 코드는 얇은 동기 facade인 **`@wippy-fe/proxy`**의 이름 있는 getter를 사용합니다. 같은 import가 두 표면에서 작동합니다.

- **마이크로 프런트엔드 앱(`view.page`)**은 선택된 srcdoc iframe 또는 동일한 프록시 계약을 제공하는 Web Fragment adapter를 통해 실행됩니다.
- **웹 컴포넌트(`view.component`)**는 호스트 페이지의 ESM 모듈로 실행되며 호스트가 import map을 통해 `@wippy-fe/proxy`를 제공합니다.

각 컨텍스트에 런타임을 로드하는 방법은 [프록시 및 격리](../web-host/proxy-isolation.md)를 참조하세요.

## 초기화

`@wippy-fe/proxy`는 `host`, `api`, `on`, `config`, `state`, `ws`, `logger`, `sanitize`, `html`, `loadCss`, `loadWebComponent`, `loadByTagName`, `hostCss`, `define`, `classifyLink`, `installVueWarnSuppressor`, `addIcons`, `tailwindConfig` 동기 getter를 내보냅니다. 필요한 항목을 가져와 직접 사용하세요. 호스트는 `view.page` 앱과 `view.component` 웹 컴포넌트 모두에서 런타임 로드 전에 자식 설정을 주입하므로 애플리케이션 코드가 실행될 때 getter를 사용할 수 있습니다. `getWippyApi`, `instance`, 기다려야 할 `GetConfig`/`SetConfig` 핸드셰이크는 **없습니다**. HTTP 호출과 상태 읽기 같은 실제 비동기 작업만 await합니다.

```ts
import { host, api, config, state, ws, logger } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const agents = await api.get('/api/v1/agents')   // api is axios; the await is the HTTP call, not obtaining `api`
const token = config.auth.token
```

iframe 및 Web Fragment 앱은 프록시 `@visibility` 토픽을 통해 수명 주기 가시성을 받습니다. 직접 웹 컴포넌트는 그렇지 않으므로 `@wippy-fe/webcomponent-vue`의 `useHostVisibility()` 또는 `useHostVisibilityRefresh()`, 혹은 동일한 `WippyElement` API를 사용합니다.

개발 중 대상 Web Host 릴리스의 `import-map.json`을 한 번 가져오고 `imports` 객체의 모든 키를 Rollup external로 사용합니다. 여기에는 `@wippy-fe/proxy`도 포함됩니다. 한 패키지 또는 현재 import한 패키지만 담은 external 목록을 관리하지 마세요. Web Host 태그가 바뀌거나 새 의존성을 추가해 정확한 지정자를 external로 둘 수 있는지 확인할 때만 다시 가져옵니다.

```typescript
// vite.config.ts (after saving the fetched response as import-map.json)
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

`AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi`, WebSocket 메시지 타입은 어느 패키지의 이름 있는 export가 아니라 `@wippy-fe/types-global-proxy`의 **ambient 선언**으로 제공됩니다. `tsconfig.json`의 `types`에 추가하거나 triple-slash 참조를 사용하면 import 없이 전역에서 사용할 수 있습니다.

```jsonc
// tsconfig.json
{ "compilerOptions": { "types": ["@wippy-fe/types-global-proxy"] } }
```

```typescript
// AppConfig, ProxyApiInstance, … are ambient globals — annotate with them directly, no import:
function render(cfg: AppConfig) { /* … */ }
type HostApi = ProxyApiInstance['host']   // HostApi is this indexed type, not a separate export
```

위 프록시 API에 대한 `import … from '@wippy-fe/shared'`는 **없습니다**. `@wippy-fe/shared`는 패키지 간 타입과 `GLOBAL_*` 이름 상수를 담고, `0.0.52`부터 런타임 유지 WC 헬퍼 `readWippyVisibility`, `setWippyVisibility`, `WIPPY_VISIBILITY_ATTRIBUTE`도 내보냅니다. 직접 WC 작성자는 보통 `@wippy-fe/webcomponent-vue`의 `useHostVisibility()` 또는 `useHostVisibilityRefresh()`를 사용합니다. 프록시 `@visibility` 이벤트는 iframe/Web Fragment 채널로 유지됩니다.

### 내부 항목(사용 금지)

런타임은 자체 사용을 위해 `window.$W`, `window.getWippyApi`, `window.initWippyApi`, `window.__WIPPY_*` 집합을 설치합니다. **애플리케이션과 컴포넌트 코드는 이를 읽거나 재정의하면 안 됩니다.** 항상 `@wippy-fe/proxy`를 사용하세요. 이름은 충돌 방지를 위해 나열했을 뿐입니다. [프록시 및 격리의 내부 항목](../web-host/proxy-isolation.md#내부-전용-읽거나-재정의하지-않기)을 참조하세요.

> 여기에 문서화한 `@wippy-fe/proxy`가 자식 코드용 API입니다. 호스트 자체 부트스트랩인 `initWippyApp(config, rootContainer?)`은 module-embed/facade 경로에서 전체 Web Host를 마운트하며 자식 앱 코드는 절대 호출하지 않습니다.

---

## 설정

### `config`

호스트가 전달한 자식 애플리케이션 설정입니다. 함수가 아닌 일반 객체이며 직접 import하고 동기식으로 읽습니다. 이 페이지는 현재 `wippy-context-2.0` 계약만 문서화합니다.

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

동적 페이지의 호스트 URL이 `/c/page-id/something/else?foo=1`이면:
- `config.context?.route`는 `/something/else?foo=1`을 담습니다.
- `config.path`는 `wippy-context-2.0` 이전 페이로드의 더 이상 권장하지 않는 호환성 필드이며 새 코드에서 사용하면 안 됩니다.

---

## 호스트 제어

### `host`

호스트 통신 API(`HostApi`)입니다. 직접 가져와 동기식으로 사용합니다.

```typescript
import { host } from '@wippy-fe/proxy'
```

---

### `host.setThemeMode(mode)` 및 `host.getThemeMode()`

테마 모드는 AppConfig가 전달하는 호스트 상태입니다. 공개 프록시 API를 통해서만 전환합니다.

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  if (host.getThemeMode() === mode) return

  await new Promise<void>((resolve, reject) => {
    let settled = false
    let unsubscribe = () => {}
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      unsubscribe()
      if (error) reject(error)
      else resolve()
    }
    const timeout = window.setTimeout(
      () => finish(new Error(`Timed out waiting for theme mode: ${mode}`)),
      5_000,
    )

    unsubscribe = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      finish()
    })

    // Subscribe before the command so a fast propagation event cannot be lost.
    try {
      host.setThemeMode(mode)
    } catch (error) {
      finish(error)
    }
  })
}

await setThemeMode('dark')
```

허용 모드는 `auto`, `light`, `dark`입니다. `auto`는 운영 체제 환경설정을 따릅니다. 변경은 호스트에 적용되고 AppConfig에 다시 기록되며 활성 iframe 및 Web Fragment 페이지 실행 영역과 직접 웹 컴포넌트에 브로드캐스트되고 중첩 Wippy 컨테이너를 통해 전달됩니다. 코드가 적용된 자식 상태를 기다려야 하면 `@theme`을 구독하고 컴포넌트 언마운트 시 구독을 해제합니다.

호스트는 지속성을 소유하지 않습니다. 임베딩 facade가 호스트 테마 변경 이벤트를 수신하고 [테마 지속성](../web-host/theme-persistence.md)에 설명된 방식으로 사용자 선택을 저장합니다.

`w-theme-dark`/`w-theme-light` 클래스를 추가 또는 제거하거나 내부 `applyThemeMode`를 호출하거나 AppConfig 저장소를 변경하거나 프록시 메시지를 합성하거나 `window.getWippyApi`를 사용하지 마세요. 이는 애플리케이션 또는 브라우저 테스트 API가 아니라 Web Host 구현 세부 사항입니다. 런타임 테스트는 `host.setThemeMode()`를 호출하고 전파된 `@theme` 이벤트를 기다린 뒤 외형을 캡처하기 전에 `host.getThemeMode()`를 검증해야 합니다. AppConfig는 호스트에서 자식으로 가는 전달 수단입니다. 내부 저장소를 변경하거나 이전에 가져온 config 스냅샷을 완료 신호로 사용하지 마세요.

`host.applyTheme()` 메서드는 없습니다.

---

### `host.startChat(agentToken, options?)`

지정한 에이전트 시작 토큰으로 새 채팅 세션을 엽니다.

```typescript
host.startChat(agentToken: string, options?: { sidebar?: boolean }): void
```

| 매개변수 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `agentToken` | `string` | — | 시작할 에이전트를 식별하는 토큰 |
| `options.sidebar` | `boolean` | `false` | `true`이면 오른쪽 사이드바 패널, `false`이면 주 영역에서 채팅 열기 |

```typescript
host.startChat('my-agent-token')                     // Main area
host.startChat('my-agent-token', { sidebar: true })  // Right sidebar
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

호스트에 SPA 내비게이션을 요청합니다. 지원 패턴은 다음과 같습니다.

- `/c/<page-id>` — 동적 페이지로 이동
- `/c/<page-id>/<sub-path>` — 하위 경로가 있는 동적 페이지
- `/chat/<session-id>` — 채팅 세션 열기
- 레지스트리 항목의 `mountRoute`로 페이지가 점유한 모든 마운트 라우트

```typescript
host.navigate(url: string): void
```

```typescript
host.navigate('/c/my-page-id')
host.navigate('/chat/session-uuid')
host.navigate('/keeper')
```

> **관리형 레이아웃 주의:** `startChat`, `openSession`, `openArtifact`, `navigate`는 표준 호환 셸에 직접 작용합니다. `fe_mode = managed`에서는 타입이 지정된 `@HOST/intent` 메시지를 게시합니다. 제공되는 `@HOST/compat-coordinator` 또는 동등한 coordinator를 선언해 이러한 intent를 선언된 채팅, 아티팩트, 모달, 주 라우트 패널에 매핑하세요. 관리형 모드에는 암묵적 호환 크롬이 없으므로 coordinator가 없으면 intent는 게시되지만 아무것도 렌더링하지 않습니다. [다중 패널 레이아웃의 모드별 지원](../web-host/multi-panel-layout.md#모드별-동작)을 참조하세요.

---

### `host.onRouteChanged(internalRoute, navId?)` — 저수준 라우터 통합

페이지 내부 라우트가 바뀌었음을 호스트에 알립니다. 호스트는 자식 라우트를 포함하도록 브라우저 URL 표시줄을 업데이트합니다. 이 호출은 **필수**입니다. 없으면 호스트 URL이 페이지 루트에 머물고 브라우저 뒤로 가기가 자식 내비게이션에서 작동하지 않습니다.

```typescript
host.onRouteChanged(internalRoute: string, navId?: number): void
```

이식 가능한 Vue 애플리케이션은 `@wippy-fe/router`의 `createAppRouter()`를 사용합니다. 패키지가 이 호출, 대응 `@history` 구독, 정규화, 반향 루프 억제를 소유합니다. 애플리케이션 코드에서 수동으로 연결하지 마세요. 이 메서드는 플랫폼 adapter 작성자와 비 Vue 통합을 위해 문서화되어 있습니다.

---

### `host.confirm(options)` → `Promise<boolean>`

PrimeVue 확인 대화 상자를 표시합니다. 사용자가 수락하면 true, 거부하거나 닫으면 false로 해석됩니다.

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

PrimeVue toast 알림을 표시합니다.

```typescript
host.toast(options: ToastMessageOptions): void
```

| `severity` | 외형 |
|---|---|
| `success` | 초록색 |
| `info` | 파란색 |
| `warn` | 노란색 |
| `error` | 빨간색 |

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

현재 채팅 세션에 컨텍스트 데이터를 보냅니다. 열린 세션이 아직 없으면 컨텍스트를 큐에 넣어 다음 `startChat` 또는 `openSession` 세션에 적용합니다. 선택적으로 특정 세션 UUID에 범위를 지정하거나 소스 설명자를 표시할 수 있습니다.

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

href를 host-nav, child-nav, external 또는 ignore로 분류합니다. 자식 설정의 `mountRoutes`, `routePrefix`와 내장 시스템 라우트 세그먼트를 사용합니다. 부작용이 없는 순수 함수입니다.

```typescript
host.classifyLink(href: string): LinkClassification

interface LinkClassification {
  kind: 'host-nav' | 'child-nav' | 'external' | 'ignore'
  href: string
  normalizedPath?: string
  targetPageId?: string  // set when host-nav matched a specific mountRoute
}
```

```typescript
// Classifier-aware anchor handler
import { host } from '@wippy-fe/proxy'

document.addEventListener('click', (ev) => {
  const a = (ev.target as HTMLElement)?.closest('a')
  if (!a) return
  const cls = host.classifyLink(a.getAttribute('href') ?? '')

  if (cls.kind === 'host-nav') {
    ev.preventDefault()
    host.navigate(cls.normalizedPath ?? cls.href)
  }
  // child-nav / external / ignore: let existing handlers run
})
```

Vue 앱에서는 `vue-router`의 `RouterLink`를 `@wippy-fe/router`의 `RouterLink`로 바꿉니다. 내부에서 `classifyLink`를 사용하며 실제 `RouterLink`와 prop 호환됩니다.

---

### `host.handleError(code, error)`

중앙 처리를 위해 오류를 호스트에 보고합니다.

```typescript
host.handleError(
  code: 'auth-expired' | 'other',
  error: Record<string, unknown>
): void
```

- `'auth-expired'` — 호스트 재인증 흐름 시작
- `'other'` — 일반 오류. 기록하고 적절한 경우 사용자에게 표시

```typescript
try {
  await api.get('/protected-endpoint')
} catch (error) {
  // Same-origin 401 responses already trigger the proxy's single-flight
  // auth-expired flow. Report only application-specific non-auth failures.
  if ((error as any).response?.status !== 401) {
    host.handleError('other', error as Record<string, unknown>)
  }
}
```

프록시는 동일 출처 요청에 Wippy bearer 토큰을 추가하고 해당 요청이 401을 반환하면 호스트의 `auth-expired` 흐름을 한 번 호출합니다. 두 동작을 모두 의도적으로 우회할 요청에만 `skipDefaultAuth: true`를 설정하세요. 정규화된 교차 출처 요청은 Wippy 토큰을 다른 출처로 보내지 않도록 자동으로 두 동작을 건너뜁니다.

---

### `host.logout()`

현재 사용자를 로그아웃하고 세션을 종료합니다.

```typescript
host.logout(): void
```

---
### `host.bridge`

페이지가 `<w-iframe>` 안에 삽입되었을 때 사용하는 채널 기반 부모-자식 메시징입니다. 전체 프로토콜은 [프록시 및 격리의 부모-자식 브리지](../web-host/proxy-isolation.md#부모-자식-bridge)를 참조하세요.

```typescript
// Fire-and-forget to parent
host.bridge.post(channel: string, payload?: unknown): void

// Request/response (resolves with parent handler's return value)
host.bridge.request<T>(
  channel: string,
  payload?: unknown,
  options?: { timeoutMs?: number }
): Promise<T>

// Register a handler for incoming messages from parent
host.bridge.on(
  channel: string,
  handler: (payload: unknown) => unknown | Promise<unknown>
): () => void  // returns unsubscribe
```

`options.timeoutMs`를 생략하면 `host.bridge.request()`의 기본 기한은 10초(`10000`ms)입니다. 시간 초과 시 반환된 promise는 메시지가 `` Bridge request <id> timed out after <ms>ms ``인 `Error`로 거부됩니다. 부모가 핸들러를 등록하지 않은 채널 요청은 기한까지 기다리지 않고 즉시 `` No handler registered for channel "<channel>" ``로 거부됩니다.

---

### `host.layout`

관리형 레이아웃 API 접근입니다. `hostConfig.layout`이 설정된 경우(`fe_mode = managed`)에만 사용할 수 있습니다. 그 외 컨텍스트에서는 `host.layout.snapshot`이 `null`이고 변경 호출은 no-op입니다.

```typescript
const layout = host.layout

// Read current snapshot
if (layout.snapshot) {
  console.log(layout.snapshot.activeBreakpoint)  // 'default' | 'sm' | ...
  console.log(layout.snapshot.panels)             // panel definition map
  console.log(layout.snapshot.layouts)            // breakpoint-keyed panel trees
}

// Subscribe to changes (the fresh snapshot is passed to the handler)
import { on } from '@wippy-fe/proxy'

const stopLayoutChanges = on('@layout-change', (snapshot) => {
  console.log(snapshot.activeBreakpoint)
})

// Call stopLayoutChanges() when the owning page or component tears down.

// Mutations
layout.resizePanel('right', '40%')
layout.collapsePanel('nav')
layout.expandPanel('nav')
layout.movePanel('right', { relativeTo: 'main', position: 'after' })
layout.removePanel('right')
layout.updatePanel('right', { kind: 'page', id: 'chat-panel' })  // {kind,id} replaces content wholesale
layout.updatePanel('right', { props: { artifactId: 'abc-123' } })  // {props} shallow-merges into existing props

layout.addFloating('flap', {
  kind: 'component',
  tagName: 'w-right-flap',
  position: { x: 0, y: 200 },
  size: { width: 48, height: 80 },
  dismissable: false,
})
layout.removeFloating('flap')
layout.closeModal('confirm-discard')

// In-tab bus
layout.broadcast('open-chat', { token: 'abc' })       // 1:N (sender excluded)
layout.send('right', 'open-chat', { token: 'abc' })   // 1:1 to named panel

const off = layout.on('open-chat', ({ payload, sourcePanelId, targetPanelId }) => {
  // handle
})
off()  // unsubscribe
```

전체 관리형 레이아웃 모델은 [다중 패널 레이아웃](../web-host/multi-panel-layout.md)을 참조하세요.

---

## API

### `api`

다음이 설정된 axios 인스턴스입니다.
- 배포 환경의 기본 URL
- `skipDefaultAuth: true`가 아닌 동일 출처 요청에 자동 `Authorization: Bearer <token>` 주입. 교차 출처 요청에는 Wippy 토큰을 보내지 않습니다.

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

// Track processing status via WebSocket. Retain and call the unsubscribe on
// completion, failure, cancellation, or component teardown.
const stopUploadStatus = on(`upload:${uploadedUuid}`, (msg) => {
  // msg.data.status: 'uploaded' | 'completed' | 'error' | 'processing'
})

```

POST가 진행 중일 때 애플리케이션 취소 동작에서 `abort.abort()`를 호출합니다. await한 응답이 끝난 뒤의 abort는 완료된 업로드를 취소할 수 없습니다. 처리가 최종 상태에 도달하거나 소유 컴포넌트가 해제될 때 `stopUploadStatus()`를 호출하세요.

Host 내장 업로드 UI는 100MB보다 큰 파일을 거부합니다. 프록시 axios 인스턴스는 이 제한을 강제하지 않으므로 커스텀 endpoint 또는 자식 UI가 문서화한 자체 클라이언트 및 서버 제한을 적용해야 합니다.

### 파일 다운로드

```typescript
const response = await api.get(`/api/v1/uploads/${uuid}/download`, {
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
// Paginated list
const list = await api.get('/api/v1/uploads/list', {
  params: { limit: 10, offset: 0 },
})
// list.data.uploads: Array<{ uuid, mime_type, size, status, meta: { filename } }>

// Single upload
const upload = await api.get(`/api/v1/uploads/${uuid}`)
// upload.data: { uuid, mime_type, size, status, meta: { filename, content_sample? } }
```

### SSE 스트리밍

프록시 `api`는 fetch adapter를 통해 server-sent event 스트림을 지원합니다. 토큰 단위 LLM 완성, 오래 실행되는 진행 스트림 또는 모든 `text/event-stream` 응답에 사용합니다.

> 브라우저 네이티브 `EventSource`를 사용하지 마세요. 커스텀 헤더를 붙일 수 없어 프록시의 `Authorization: Bearer` 토큰을 전달할 수 없습니다.

```typescript
import { api } from '@wippy-fe/proxy'

const abort = new AbortController()

const response = await api.post('/api/v1/agents/stream', { prompt: 'Hello' }, {
  adapter: 'fetch',          // required — the default xhr adapter buffers the full body
  responseType: 'stream',
  headers: { Accept: 'text/event-stream' },
  signal: abort.signal,
})

const reader = (response.data as ReadableStream<Uint8Array>).getReader()
const decoder = new TextDecoder()
let buffer = ''
let endedByMarker = false

try {
  stream: while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    // SSE permits CRLF. Normalize before looking for blank-line delimiters.
    buffer = buffer.replace(/\r\n/g, '\n')

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
      if (payload === '[DONE]') {
        endedByMarker = true
        break stream
      }

      let evt: unknown
      try {
        evt = JSON.parse(payload)
      } catch {
        handleText(payload)
        continue
      }
      handleEvent(evt)
    }
  }
} finally {
  try {
    if (endedByMarker) await reader.cancel()
  } finally {
    reader.releaseLock()
  }
}
```

읽기 루프가 활성 상태일 때 소유 취소 또는 해제 경로에서 `abort.abort()`를 호출합니다. 그 경로가 시작한 경우에만 결과 abort 거부를 예상 동작으로 취급하고 다른 스트림 실패는 정상적으로 보고하세요.

모든 요청에서 fetch adapter를 기본값으로 쓰려면 다음과 같이 설정합니다.

```jsonc
// In package.json → wippy.configOverrides, or window.__WIPPY_CONFIG_OVERRIDES__
{
  "axiosDefaults": { "adapter": "fetch" }
}
```

---

## 표면

Web Host가 앱에 할당한 영역의 기하입니다. 앱이 여러 패널 중 하나일 수 있으므로 이 영역은 보통 브라우저 창이 **아닙니다**. `window.innerWidth`와 뷰포트 단위를 크기 기준으로 쓰면 잘못입니다. 전체 계약은 [표면 이식성](./surface-portability.md), 변환 레시피는 [표면 마이그레이션](./surface-migration.md)을 참조하세요.

### `host.surface.snapshot`

앱 CSS가 해석하는 동일한 계산 사용자 지정 속성에서 다시 읽은 현재 기하입니다. 따라서 `@container wippy-surface (…)` 및 `cqw`가 보는 값과 벗어날 수 없습니다.

```typescript
const { contract, revision, engine, sizing, width, widthUnit, height, heightUnit } = host.surface.snapshot
```

| 필드 | 타입 | 참고 |
|---|---|---|
| `contract` | `1` | 계약 버전 |
| `revision` | `number` | 단조 증가하며 기하가 바뀔 때 진행 |
| `engine` | `'iframe' \| 'fragment' \| 'host'` | `host`는 표면이 할당되지 않았음을 뜻함 |
| `sizing` | `'container' \| 'content'` | |
| `width`/`widthUnit` | `number` | 전체 너비와 그 1%, CSS 픽셀 단위 |
| `height`/`heightUnit` | `number \| null` | 콘텐츠 크기에서는 블록 축을 실제로 사용할 수 없어 `null` |

### `host.surface.onChange(listener)` → `() => void`

기하 변경을 구독합니다. 해제 시 **반드시** 호출해야 하는 멱등 unsubscribe를 반환합니다.

```typescript
const off = host.surface.onChange((snapshot) => {
  canvas.width = snapshot.width
})
```

### `host.surface.supports(capability)` → `boolean`

```typescript
if (host.surface.supports('block-size')) {
  // the block axis is available (container sizing)
}
```

현재 `block-size`와 `surface-scroll` 기능에는 실제 상태를 답합니다. `registered-hit-testing`, `native-document-hit-testing`, `owner-visibility`는 예약 어휘로 항상 false를 보고합니다.

`engine` 분기보다 `supports()`를 우선하세요. 중요한 것은 어느 엔진이 렌더링하는지가 아니라 기능을 사용할 수 있는지입니다.

### `host.surface.engine` 및 `host.surface.sizing`

스냅샷의 같은 값에 대한 읽기 전용 단축 경로입니다. `engine: 'host'`는 할당된 표면 없이 코드가 호스트 문서에 직접 마운트되었거나 독립 개발 프록시에서 실행됨을 뜻합니다. 설계상 스냅샷은 `width: 0`, `sizing: 'content'`를 보고합니다.

`engine`은 "표면이 할당되었는가"를 판단하는 신뢰할 수 있는 검사가 아닙니다. `<w-iframe>`/`<w-artifact>`를 통해 삽입된 페이지도 중첩 표면 지원이 배포될 때까지 표면에서 제외되지만 `width: 0`과 함께 `engine: 'iframe'`을 보고합니다. 이 구분이 중요하면 `snapshot.width`를 검사하세요.

---

## 이벤트

### `on(topic, handler)` → `() => void`

`on`은 호스트 WebSocket 계층 또는 내부 프록시 이벤트를 구독하고 unsubscribe 함수를 반환합니다.

```typescript
on(topic: string, handler: (event: unknown) => void): () => void
```

토픽은 콜론으로 구분된 세그먼트를 사용합니다. `*`는 단일 세그먼트 와일드카드이고 패턴은 일치 대상 토픽과 같은 세그먼트 수를 가져야 합니다.

```typescript
import { on } from '@wippy-fe/proxy'

// Unsubscribe when done
const unsub = on('session:abc:message:*', (msg) => {
  console.log(msg.data)
})
unsub()
```

모든 `on()` 호출은 unsubscribe 함수를 반환합니다. 컴포넌트 언마운트 시 항상 호출해 누수를 막으세요. iframe 언로드 때 남은 구독은 자동 정리되지만 오래 유지되는 iframe 안에서 마운트/언마운트되는 컴포넌트에는 명시적 정리가 여전히 필요합니다.

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
// Vanilla / Web Component
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
|---|---|---|
| `@history` | `{ path: string }` | Host URL 변경(SPA 내비게이션). 부모가 새 라우트를 push할 때 발생 |
| `@visibility` | `boolean` | Iframe/Web Fragment 가시성 변경. 직접 웹 컴포넌트는 타입이 지정된 호스트 가시성 계약 사용 |
| `@theme` | `'auto' \| 'light' \| 'dark'` | Host가 전파한 적용 테마 모드 |
| `@message` | 전체 WS 메시지 | 모든 WebSocket 메시지. 내부적으로 `*`, `*:*`, `*:*:*`, `*:*:*:*` 구독 |
| `@state-error` | `{ error: string, key?: string }` | 상태 저장 실패(할당량 초과, 직렬화 오류) |
| `@layout-change` | `LayoutSnapshot` | 관리형 레이아웃 스냅샷 업데이트. 새 스냅샷을 핸들러에 전달하며 `host.layout.snapshot` 읽기와 동등 |
| `@layout-breakpoint` | `{ name: string, width: number }` | 활성 관리형 레이아웃 breakpoint 변경. `name`은 새 breakpoint, `width`는 임계값(px) |

### 와일드카드 패턴

```typescript
// Iframe/Web Fragment pages only; direct WCs use useHostVisibility().
on('@visibility', (visible: boolean) => { /* shown or hidden */ })

// All session messages in a specific session
on('session:abc-123:message:*', (msg) => { /* ... */ })

// All messages across all sessions
on('@message', (msg) => { /* ... */ })

// Topics whose parts contain ':' must be encoded
on(`session:${encodeURIComponent('id:with:colons')}:message:*`, handler)
```

`@history`는 프로토콜 완전성을 위해 나열했습니다. 이식 가능한 Vue 애플리케이션은 `@wippy-fe/router`가 이를 구독하게 해야 하며 애플리케이션 소유 핸들러를 두 번째로 추가하면 안 됩니다.

같은 프레임에서 같은 토픽을 여러 번 구독해도 안전합니다. 프록시가 호스트 수준에서 중복을 제거하며 각 `on()` 호출은 독립 unsubscribe 핸들을 받습니다.

---

## 상태

### `state` — 호스트 중재 키-값 지속성

`state`는 페이지 실행 영역이 제거되어도 유지되는 호스트 중재 저장소를 제공합니다. 상태는 페이지 또는 아티팩트 UUID별로 범위가 지정되어 각 앱이 격리된 namespace를 가집니다.

모든 메서드는 기본 범위를 재정의하는 선택적 `{ scope?: string }` 옵션을 받습니다. 같은 컴포넌트의 여러 인스턴스에 별도 상태 버킷이 필요할 때 `scope`를 사용하세요.

> **범위 고유성:** 원시 `state` API는 scope 값을 그대로 전달하므로 애플리케이션 전체에서 고유해야 합니다. `@wippy-fe/pinia-persist` 플러그인은 시스템 범위와 충돌하지 않도록 커스텀 범위에 자동으로 `@custom:`을 붙입니다.

```typescript
import { state } from '@wippy-fe/proxy'

// Write (fire-and-forget; @state-error fires on quota exceeded)
await state.set('filters', { search: 'john', status: 'active' })

// Read (returns null if key not found)
const filters = await state.get<{ search: string, status: string }>('filters')

// Delete a key
await state.remove('filters')

// Clear all state for this page
await state.clear()

// Read all at once (useful for bulk hydration)
const all = await state.getAll()

// Custom scope
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

**권장 iframe/Web Fragment 저장 패턴:** 변경할 때마다가 아니라 페이지가 백그라운드로 갈 때 저장합니다. 직접 WC는 같은 수명 주기 결정을 위해 `useHostVisibility()`를 사용합니다.

```typescript
const stopVisibility = on('@visibility', async (visible) => {
  if (!visible) {
    await state.set('scrollY', document.documentElement.scrollTop)
    await state.set('formData', currentFormData)
  }
})

// Call stopVisibility() when the owning page or component tears down.
```

**제한:** 페이지당 2MB(JSON 직렬화 기준, 호스트의 `hostConfig.stateCache`로 설정 가능). 상태는 호스트 메모리에 있으므로 iframe 다시 로드는 견디지만 브라우저 페이지 전체 새로 고침은 견디지 못합니다.

### Pinia 통합

Pinia를 사용하는 Vue 앱에서는 `@wippy-fe/pinia-persist`가 지속성을 자동화합니다.

```typescript
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const preloaded = await preloadWippyState()
const pinia = createPinia()
pinia.use(createWippyPersist(preloaded))
app.use(pinia)
```

그런 다음 store를 표시합니다.

```typescript
const useMyStore = defineStore('my-store', () => {
  const filters = ref({ search: '' })
  return { filters }
}, {
  wippyPersist: true,
  // or: wippyPersist: { pick: ['filters'], debounce: 500 }
})
```

---

## WebSocket

### `ws`

`ws`는 호스트 WebSocket 연결을 통해 명령을 보냅니다. 응답은 `on()` 토픽 구독으로 도착합니다.

### `ws.send(command)`

응답을 기다리지 않고 전송합니다. 응답 전달 기능이 없으므로 먼저 관련 토픽을 구독하세요.

```typescript
ws.send(command: WsCommand): void
```

```typescript
import { ws, on } from '@wippy-fe/proxy'

const stopMessages = on('session:my-session:message:*', (msg) => {
  console.log('Response:', msg.data)
})

ws.send({
  type: 'session_message',
  session_id: 'my-session',
  message_id: crypto.randomUUID(),
  data: { text: 'Hello from child app' },
})
```

`stopMessages`를 보관하고 소유 컴포넌트 또는 페이지 해제 시 호출합니다. 응답이 아직 필요하다면 `send()` 직후 구독을 해제하지 마세요.

### `ws.sendWithResponse(command)` → `Promise<WsMessage>`

명령을 보내고 일치하는 서버 응답을 기다립니다. 30초 후 시간 초과됩니다.

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

세션 제어 명령용 편의 래퍼입니다.

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

자식-호스트 경계를 통과하는 구조화 로깅입니다. 로그는 자식 → 호스트 → 부모 웹사이트로 흐르고 Sentry, Graylog, console 같은 transport가 처리합니다. 각 자식 컨텍스트(`resourceId`, `resourceType`, 중첩 깊이)가 모든 로그 항목에 자동으로 붙습니다.

프로덕션 모니터링에 표시할 항목에는 `console.log/error` 대신 `logger`를 사용합니다.

```typescript
import { logger } from '@wippy-fe/proxy'

logger.debug('Component mounted', { pageId: 'abc' })
logger.info('User loaded page', { pageId: 'abc' })
logger.warn('Slow API response', { ms: 3200 })
logger.error('Failed to save', { endpoint: '/api/save' })
```

### `logger.captureException(error, context?)`

예외를 캡처하고 전달합니다. `ProxyConfig.injections.errorCapture`가 true이면 처리되지 않은 오류(`window.onerror`, `unhandledrejection`)를 자동 캡처합니다.

```typescript
try {
  await riskyOperation()
} catch (error) {
  logger.captureException(error, { operation: 'riskyOperation' })
}
```

### Breadcrumb와 컨텍스트

```typescript
// Breadcrumbs attach to the next exception for debugging context
logger.addBreadcrumb({ category: 'navigation', message: 'Navigated to /settings' })
logger.addBreadcrumb({ category: 'ui', message: 'Clicked Save button' })

// Persistent context — attached to all subsequent logs from this child
logger.setContext('user', { id: 'user-123', role: 'admin' })

// Tags — key/value pairs for filtering and search
logger.setTag('version', '1.2.0')
logger.setTag('feature', 'dashboard')
```

---

## 웹 컴포넌트

### `loadByTagName(tagName, options?)` → `Promise<void>`

HTML 태그 이름으로 peer 웹 컴포넌트를 로드하고 등록합니다. `customElements.define`이 발생한 뒤 해석되므로 직후 `document.createElement(tagName)`을 안전하게 호출할 수 있습니다. 성공하면 태그가 `sanitize` 허용 목록에 자동 추가됩니다.

```typescript
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('wc-thread-picker')
await loadByTagName('wc-slow-pkg', { timeoutMs: 60_000 })

// Safe to use immediately
document.body.appendChild(document.createElement('wc-thread-picker'))
```

`options.timeoutMs`는 스크립트를 추가한 뒤 `customElements.define`을 기다리는 기본 30초 기한을 재정의합니다. 멈추거나 깨진 컴포넌트(404, 구문 오류, 누락된 `define` 호출)를 무한 대기 대신 거부로 드러냅니다.

### `loadWebComponent(componentId, tagName?)` → `Promise<void>`

태그 이름 대신 Wippy 레지스트리 아티팩트 ID로 웹 컴포넌트를 로드합니다. 설정 값이나 백엔드 응답에서 레지스트리 ID를 얻었을 때 유용합니다.

```typescript
import { loadWebComponent } from '@wippy-fe/proxy'

await loadWebComponent('wippy.components:my-chart')
```

### DOM 스캔 loader(`<script type="wippy-components-loader">`)

여러 컴포넌트가 필요한 페이지에서 프록시는 초기화할 때 이 스크립트 태그를 스캔하고 각 항목을 `loadWebComponent`로 로드합니다.

```html
<script type="wippy-components-loader">
{ "wc-foo": "wippy.components:foo", "wc-bar": "wippy.components:bar" }
</script>
```

`loadByTagName`과 같은 중복 제거 및 허용 목록 자동 업데이트 동작을 사용합니다.

---

## 유틸리티

### `sanitize(html, options?)` → `string`

현재 프록시 컨텍스트 범위의 기본 허용 목록 HTML sanitizer입니다. 채팅 렌더링 기본값(`<p>`, `<a>`, `<code>`, `<table>` 등)과 현재 런타임에 등록된 모든 웹 컴포넌트 태그를 결합합니다.

```typescript
import { sanitize, loadByTagName } from '@wippy-fe/proxy'

const safe = sanitize('<p>hi</p><script>alert(1)</script>')
// → '<p>hi</p>'

// After loadByTagName, the tag is automatically allowed:
await loadByTagName('wc-thread-picker')
sanitize('<wc-thread-picker thread-id="42"></wc-thread-picker>')
// → '<wc-thread-picker thread-id="42"></wc-thread-picker>'

// One-off extra tags
sanitize(dialogBody, { extraTags: { 'iconify-icon': ['icon'] } })
```

`sanitize`는 호출할 때마다 태그 허용 목록을 다시 읽으므로 import 뒤에 등록된 태그도 반영됩니다.

### `html.inject(sourceHtml, options)` → `Promise<string>`

엘리먼트를 마운트하지 않고 소스 HTML을 srcdoc으로 변환합니다. 일반적인 용도에는 `<w-iframe>`을 우선하고 커스텀 호스팅 인프라를 만들 때만 사용하세요.

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

## 설정 재정의

페이지는 별도 배포 없이 선택한 자식 대상 설정 필드를 페이지별로 재정의할 수 있습니다. 재정의 형태는 호환성을 위해 계속 `customization`을 사용하고, 호스트가 페이지에 `wippy-context-2.0` 설정을 전달하기 전 해당 값을 현재 자식 `theming.global` 결과에 투영합니다.

### 재정의 설정

**레지스트리 페이지(권장):** 페이지 `_index.yaml`에 `meta.config_overrides`를 설정합니다. 호스트가 콘텐츠 API 응답에 포함하고 자동으로 주입합니다.

**독립 패키지:** 페이지 `package.json`에 `wippy.configOverrides`를 설정합니다.

**수동/테스트:** `proxy.js`보다 먼저 실행되는 `<script>` 태그에서 `window.__WIPPY_CONFIG_OVERRIDES__`를 설정합니다.

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
|---|---|
| `cssVariables` | 호스트 값을 **대체**. 페이지가 자체 테마 제공 |
| `customCSS` | 호스트 값 **대체** |
| `iconSets` | 추가 **병합** |
| `axiosDefaults` | **깊은 병합** |
| `routePrefix` | **대체** |
| `apiRoutes` | **깊은 병합** |

페이지가 삽입하는 모든 중첩 자식(`<w-iframe>`, `<w-artifact>`, `html.inject` 콘텐츠)은 이미 병합된 페이지 설정에서 만들어져 하위 트리 전체에서 자동으로 재귀 상속합니다. 따라서 페이지 재정의, 특히 테마는 페이지뿐 아니라 그 아래 모든 항목에 전파됩니다.

---

## Vue 유틸리티

### `installVueWarnSuppressor(app)`

현재 일관된 `@wippy-fe/proxy` 계열에서 사용할 수 있습니다. `app.component(...)` 대신 `customElements.define(...)`으로 등록된 태그에 대한 `[Vue warn]: Failed to resolve component: foo-bar`를 숨깁니다. Vue 템플릿 컴파일러는 인식하지 못하는 웹 컴포넌트 태그에 경고하지만 엘리먼트는 올바르게 렌더링되므로 이 경고는 실행 가능한 정보가 아닙니다.

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/proxy'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.use(router)
app.mount('#app')
```

숨기는 항목:

- 이미 `customElements.define(...)`으로 등록된 태그. 시스템 태그(`w-iframe`, `w-artifact`, `wippy-loading`, `wippy-error`)와 자동 로드 파이프라인(`loadByTagName`, scanner)이 등록한 모든 태그
- 아직 등록되지 않았지만 커스텀 엘리먼트 이름 형태(`^[a-z][a-z0-9]*-[a-z0-9-]*$`)와 일치하는 태그. Vue가 자동 로드 스크립트보다 먼저 렌더링하는 경쟁 구간을 포함합니다.

계속 경고하는 항목:

- **PascalCase 컴포넌트 오타**(`<UsreCard />`). 억제기가 kebab 패턴과 일치시키지 않고 `customElements.get`이 undefined를 반환하므로 콘솔로 전달됩니다. 실제 버그를 노이즈와 구분하는 신호를 보존합니다.

함수는 멱등입니다. 같은 `app`에서 두 번째 호출은 실제 no-op입니다. `Symbol.for('@wippy-fe/proxy/vue-warn-suppressor-installed')` 마커가 `app.config`에 설정되고, 다시 로드할 때 이를 지워야 하는 테스트 설정을 위해 `VUE_WARN_SUPPRESSOR_INSTALLED_MARKER`로 내보냅니다.

기존 `warnHandler`가 있으면 `previous`로 보존되고 억제하지 않은 경고에 호출됩니다.

### `@wippy-fe/router`의 `createAppRouter(routes, options?)`

어느 렌더링 엔진에서든 `view.page` 애플리케이션에 사용하는 메모리 라우터 팩토리입니다. 메모리 히스토리, 호스트와의 `afterEach` 라우트 동기화, `@history` 구독을 제공합니다.

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

두 웹 컴포넌트는 `proxy.js`보다 먼저 주입되는 `loading.js`를 통해 자동 등록됩니다. import나 수동 등록이 필요하지 않습니다.

### `<wippy-loading>`

테마 인식 색상을 사용하는 전체 화면 로딩 spinner입니다.

| 속성 | 설명 |
|---|---|
| `title` | 주 텍스트(예: "Loading...") |
| `subtitle` | 보조 텍스트 |
| `no-bg` | Boolean. 오버레이용 투명 배경 |

```html
<wippy-loading title="Loading..." subtitle="Please wait"></wippy-loading>
<wippy-loading no-bg title="Loading page content..."></wippy-loading>
```

### `<wippy-error>`

severity 기반 색상을 사용하는 전체 화면 오류 표시입니다.

| 속성 | 값 | 기본값 |
|---|---|---|
| `title` | 모든 문자열 | "Something went wrong" |
| `message` | 모든 문자열 | 비어 있음 |
| `icon` | `circle`, `triangle`, `sad` | `circle` |
| `severity` | `danger`, `warning` | `danger` |
| `no-bg` | Boolean | 없음 |

```html
<wippy-error title="Failed to load" message="Server returned 500" severity="danger"></wippy-error>
<wippy-error title="Connection Lost" message="Retrying..." icon="triangle" severity="warning"></wippy-error>
```

두 컴포넌트 모두 `@wippy-fe/theme`의 CSS 변수와 Shadow DOM을 사용하며 테마 적용 전 컨텍스트용 하드코딩 대체값을 포함합니다.

**일반 HTML 페이지의 권장 패턴:**

```html
<body>
  <wippy-loading id="loader" title="Loading..."></wippy-loading>
  <div id="content" style="display:none"><!-- content --></div>

  <script type="module">
    import { api, host } from '@wippy-fe/proxy'

    async function init() {
      try {
        // fetch data, set up page...
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

**Vue 3 — `app.html` 진입점:**
```html
<div id="app">
  <wippy-loading title="Loading..."></wippy-loading>
</div>
<script type="module" src="./src/app.ts"></script>
```

Vue가 `#app`에 마운트되면 `<wippy-loading>` 엘리먼트를 자동 교체합니다.
