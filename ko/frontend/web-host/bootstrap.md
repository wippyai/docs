---
title: "Bootstrap 순서"
description: "Web Host가 AppConfig를 받고 store, 라우팅, 테마, 렌더링, 실시간 서비스를 초기화하는 방식입니다."
---

# Bootstrap 순서

이 페이지는 lifecycle 및 구성 참조입니다. 순서 다이어그램은 Host 초기화를 설명하며 복사할 애플리케이션 bootstrap 코드가 아닙니다.

Web Host는 구성을 받은 뒤 전체 인터페이스를 렌더링하기 전에 고정된 초기화 순서를 실행합니다. 구성은 페이지를 장악하는 JS 모듈 또는 수동으로 삽입한 iframe을 통해 도착합니다. 구성을 사용할 수 있게 된 뒤 내부 단계는 동일합니다.

## 경로 A — JS 모듈(표준 facade 경로)

현재 `wippy/facade`가 이 경로를 사용합니다. **compat** 모드에서는 `module.js`, **managed** 모드에서는 `managed-layout.js`라는 Web Host JS 모듈 엔트리를 불러오는 페이지를 제공합니다. 모듈은 페이지와 브라우저 history를 장악합니다.

1. **페이지가 모듈을 불러옵니다.** script가 페이지 `window`에 `window.initWippyApp`을 등록합니다.

2. **페이지가 `AppConfig`를 조립하고 `initWippyApp(appConfig, rootContainer?)`를 호출합니다.** shell이 `/facade/config`를 가져오고 `@wippy_token_info` localStorage 엔트리에서 bearer 토큰을 읽으며 `$schema`, `auth`, `context`를 추가하고 지원되는 응답 필드를 전달합니다. PostMessage handshake는 없습니다.
   ```javascript
   const events = window.initWippyApp(appConfig, '#app')
   events.on('ready', () => console.log('App ready'))
   ```

3. **초기화가 진행됩니다.** 아래 [내부 Init 순서](#내부-init-순서)를 참고하십시오.

## 경로 B — Iframe(수동, facade 없음)

더 강한 격리와 부분 페이지 렌더링을 위해 전체 호스트를 iframe 안에 삽입할 때 이 경로를 사용합니다. `iframe.html?waitForCustomConfig`를 불러오고 `SetConfig` PostMessage를 통해 구성을 받습니다. 현재 facade는 이 삽입 방식을 만들지 않습니다.

1. **Iframe이 로드됩니다.** Web Host가 브라우저에서 로드됩니다. URL에 `?waitForCustomConfig`가 있으므로 앱은 최소 skeleton을 마운트하고 일시 중지됩니다. 아직 인증 토큰을 읽거나 API endpoint를 호출하지 않습니다.

2. **부모가 `SetConfig`를 보냅니다.** 부모는 완전한 `AppConfig`를 제공합니다. `/facade/config` 응답에서 배포 설정을 얻을 수 있지만 응답하기 전에 부모가 `$schema`, `auth`, `context`를 추가해야 합니다.
   ```javascript
   iframe.contentWindow.postMessage(
     JSON.stringify({ type: '@gen2-chat', action: 'set-config', ...appConfig }),
     cfg.iframe_origin
   )
   ```

3. **Web Host가 `AppConfig`를 받습니다.** 메시지 handler가 envelope type과 action을 검증한 뒤 구성 객체를 추출합니다. Web Host 1.0.56에서 inbound handler는 `event.origin`이나 `event.source`를 인증하지 않으며 이후 일치하는 `SetConfig`가 구성을 교체할 수 있습니다. 부모는 iframe에 메시지를 보낼 수 있는 주체를 제한하고 전체 메시지 환경을 신뢰 영역으로 취급해야 합니다. iframe DOM 및 스타일 격리가 구성 권한 격리를 의미하지는 않습니다.

4. **초기화가 진행됩니다.** 이 시점부터 내부 경로는 경로 A와 동일합니다.

## 내부 Init 순서

어느 경로로든 `AppConfig`를 사용할 수 있게 되면 Web Host가 다음 시작 순서를 실행합니다.

**1. 구성을 해석하고 정규화합니다.** `resolveConfig()`가 제공된 구성을 초기화하고 병합하며 schema migration을 적용하고 session 정책을 정규화한 뒤 나머지 Host가 사용하는 구성·인증·환경 상태를 채웁니다.

**2. 백엔드 페이지 경로를 가져옵니다.** Vue 애플리케이션을 만들거나 마운트하기 전에 Host는 `GET /api/public/pages/routes`를 기다립니다. 백엔드 구문 오류 또는 중복 경로 오류는 시작을 중단하고 Host 오류 경로로 전달됩니다. 마운트 후 경로를 설치하는 단계가 아닙니다.

**3. 애플리케이션과 router를 만듭니다.** Vue 애플리케이션을 생성합니다. router는 `AppConfig.hostConfig.history`의 history 모드를 사용하며 애플리케이션을 마운트하기 전에 정적 시스템 경로와 백엔드 마운트 경로를 모두 등록합니다.

**4. 애플리케이션 provider를 설치합니다.** `setupApp()`이 Pinia를 설치하고 Axios와 인증을 구성하며 PrimeVue 및 테마 provider와 나머지 애플리케이션 서비스를 연결합니다. 자식 애플리케이션은 proxy 계층을 통해 구성된 API surface를 받습니다.

**5. 마운트하고 현재 URL을 해석합니다.** 구성, 경로 로드, router 생성, provider 설정이 완료된 뒤에만 모듈 엔트리가 `App.vue`를 마운트합니다. 이후 router가 완전한 경로 table에서 현재 브라우저 또는 hash URL을 해석합니다.

**6. 요청될 때 WebSocket client를 만듭니다.** WebSocket 설정은 고정된 마지막 bootstrap 단계가 아니라 소비자 주도입니다. 소비 컴포넌트 또는 composable이 요청하면 `useWsClientRaw()`가 client를 만듭니다. `hostConfig.lazyWS`가 true가 아니면 연결은 즉시 시작되고, lazy 모드에서는 subscription이 요구할 때 시작됩니다.

## AppConfig TypeScript 인터페이스

다음 축약 선언은 `initWippyApp`과 `SetConfig`가 받는 주요 구성 필드를 보여 줍니다. 보조 유형과 덜 쓰이는 필드는 고정된 Web Host의 `app-config/types.ts`가 계속 권위 있습니다. 이 발췌를 제공 schema의 대체물로 취급하지 마십시오. `AppConfig`에는 `feature` 또는 `fe_mode` 필드가 없습니다. `fe_mode`는 모듈 엔트리를 선택하는 facade 요구 parameter이고 managed 모드는 `hostConfig.layout`을 통해 전달됩니다.

```typescript
interface AppConfig {
  $schema: string             // current facade: <facade_url>/schemas/wippy-context-2.0.xsd
  auth: AppAuthConfig
  env: AppEnv
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: ApiRoutesOverride
  tanstack?: TanstackConfig    // TanStack Query defaults (global + per role-based category)
  themeMode?: 'auto' | 'light' | 'dark'
  theming: AppTheming
  hostConfig: HostConfig
  context: AppContext
}

interface AppAuthConfig {
  token: string            // Bearer token
  expiresAt: string        // ISO 8601 expiry timestamp
}

interface AppEnv {
  APP_API_URL: string
  APP_AUTH_API_URL: string
  APP_WEBSOCKET_URL: string
}

interface AppTheming {
  global?: ThemingScope
  host?: HostThemingScope
  children?: ChildrenThemingScope
}

interface CssVariablesMap {
  [key: string]: string | Record<string, string> | undefined
  '@dark'?: Record<string, string>
  '@light'?: Record<string, string>
}

interface ThemingScope {
  customCSS?: string
  cssVariables?: CssVariablesMap
  fonts?: FontConfig[]
  icons?: Record<string, unknown>
  iconSets?: Record<string, Record<string, unknown>>
}

interface HostThemingScope extends ThemingScope {
  i18n?: Partial<I18NTextTypes>
}

interface ChildrenThemingScope {
  customCSS?: string
  cssVariables?: CssVariablesMap
  fonts?: FontConfig[]
}

interface HostConfig {
  session?: { type: 'non-persistent' | 'cookie' }
  history?: 'browser' | 'hash'
  showAdmin?: boolean
  allowSelectModel?: boolean
  startNavOpen?: boolean
  hideNavBar?: boolean
  disableRightPanel?: boolean
  hideSessionSelector?: boolean
  renderEngine?: 'iframe' | 'fragment'
  lazyWS?: boolean
  additionalNavItems?: PageApi.Page[]
  stateCache?: { maxPages?: number; maxSizePerPage?: number }
  allowAdditionalTags?: Record<string, string[]>   // tag → allowed attributes
  chat?: {
    convertPasteToFile?: {
      enabled: boolean
      minFileSize: number
      allowHtml: boolean
    }
  }
  layout?: HostLayoutDeclaration
}

// TanStack Query defaults. A top-level field (shared by host + children, like
// apiRoutes). Default behavior (no config) is refetchOnWindowFocus: false so
// alt-tabbing back doesn't reload in-flight content.
interface TanstackConfig {
  default?: TanstackQueryOptions   // overrides the global query defaults
  content?: TanstackQueryOptions   // single-resource renders (page/artifact/session/entry/model/upload)
  lists?: TanstackQueryOptions     // navigation / index / list queries
}

// JSON-safe subset of TanStack query options (no functions — config is JSON).
interface TanstackQueryOptions {
  refetchOnWindowFocus?: boolean
  refetchOnReconnect?: boolean
  refetchOnMount?: boolean
  staleTime?: number
  gcTime?: number
  retry?: boolean | number
  refetchInterval?: number | false
}

interface AppContext {
  resourceId: string
  resourceType: 'page' | 'artifact'
  route?: string
  parentResourceId?: string
  nestingDepth?: number
  isNavOwner?: boolean
  layoutPanelId?: string
  layoutId?: string
  layout?: unknown
  extensions?: Record<string, unknown>
}
```

> **현재 facade 제한.** Web Host는 `AppConfig.tanstack`을 받고 facade 구성 endpoint도 설정된 `tanstack` 객체를 반환합니다. 표준 facade shell은 현재 `initWippyApp`에 전달하는 `AppConfig`에 이 필드를 복사하지 않습니다. 전달이 구현되기 전에는 표준 shell 경로에서 facade `tanstack` parameter에 의존하지 마십시오. 수동 embedder는 조립한 `AppConfig`에 이를 포함할 수 있습니다.

## 구성 소스와 우선순위

Web Host는 낮은 우선순위부터 높은 순서로 여러 소스에서 구성을 해석합니다.

1. **내장 기본값** — Web Host 번들 자체에 정의됩니다.
2. **URL query parameter** — cookie session용 `?token=<token>`, `?expiresAt=<timestamp>`, `?persist`. 부모 페이지 없이 직접 개발 접근할 때 유용합니다.
3. **`initWippyApp()` 인자** — 표준 facade shell이 조립한 `AppConfig`. URL parameter보다 우선합니다.
4. **PostMessage `SetConfig`** — `?waitForCustomConfig`가 있을 때 사용하는 수동 facade 없는 iframe 경로.

실제 production 배포는 항상 `initWippyApp()`(facade 경로) 또는 PostMessage(수동 iframe 삽입)를 사용합니다. URL parameter는 토큰으로 브라우저에서 호스트를 직접 불러오기 위한 개발 편의 기능입니다.

## Bootstrap 다이어그램

표준 facade(JS 모듈) 경로:

```
module.js / managed-layout.js loaded on the page
  │
  ├─ shell assembles AppConfig from /facade/config + local auth
  ├─ window.initWippyApp(appConfig, '#app')
  │     appConfig = { $schema, auth, env, theming, hostConfig, context, ... }
  │
  ├─ resolveConfig() → migrate, normalize, and populate config/auth/env state
  ├─ await GET /api/public/pages/routes
  ├─ create Vue app + router
  │     static system routes + validated backend mount routes
  ├─ setupApp() → Pinia, Axios, PrimeVue, theming, and other providers
  ├─ mount App.vue → resolve the current URL
  └─ consuming components request WebSocket clients
        eager connection unless hostConfig.lazyWS is true
```

## 함께 보기

- [Facade 엔트리 포인트](./entry-point.md) — `wippy/facade`가 `AppConfig`를 구성하고 전달하는 방식
- [멀티 패널 레이아웃](./multi-panel-layout.md) — `managed-layout.js`가 제공하는 managed-layout boot 경로
- [렌더 엔진](./render-engines.md) — 불러온 페이지가 srcdoc iframe 또는 Web Fragment로 렌더링되는 방식
