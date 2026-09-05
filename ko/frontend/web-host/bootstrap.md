---
title: "부트스트랩 시퀀스"
description: "웹 호스트는 설정을 받은 뒤 어떤 UI도 렌더링하기 전에 고정된 초기화 시퀀스를 실행합니다. 이 시퀀스는 다음에 따라 약간 달라집니다…"
---

# 부트스트랩 시퀀스

웹 호스트는 설정을 받은 뒤 어떤 UI도 렌더링하기 전에 고정된 초기화 시퀀스를 실행합니다. 이 시퀀스는 웹 호스트가 페이지를 인수하는 JS 모듈로 로드되었는지(표준 파사드 경로) iframe 안에서 실행되는지(수동, 파사드 없는 경로)에 따라 약간 달라지지만, 설정을 사용할 수 있게 된 이후의 내부 단계는 동일합니다.

## 경로 A — JS 모듈 (표준, 파사드 경로)

현재 `wippy/facade`가 사용하는 경로입니다. 파사드는 웹 호스트 JS 모듈 엔트리 — **compat** 모드는 `module.js`, **managed** 모드는 `managed-layout.js` — 를 로드하는 페이지를 서빙하고, 그 모듈이 페이지 전체와 브라우저 히스토리를 인수합니다.

1. **페이지가 모듈을 로드합니다.** 스크립트가 페이지의 `window`에 `window.initWippyApp`을 등록합니다.

2. **페이지가 `initWippyApp(config, rootContainer?)`를 호출합니다.** 페이지는 `/facade/config`를 이미 가져왔고 그 페이로드를 함수 인자로 직접 전달합니다. PostMessage 핸드셰이크는 없습니다.
   ```javascript
   const events = window.initWippyApp(config, '#app')
   events.on('ready', () => console.log('App ready'))
   ```

3. **초기화가 진행됩니다** — 아래 [내부 초기화 시퀀스](#internal-init-sequence)를 참고하세요.

## 경로 B — Iframe (수동, 파사드 없음)

전체 호스트를 직접 iframe 안에 임베드할 때 — 더 강한 격리가 필요한 부분 페이지 임베딩을 위해 — 취하는 경로입니다. `iframe.html?waitForCustomConfig`를 로드하고 `SetConfig` PostMessage로 설정을 받습니다. 현재 파사드는 이를 만들지 않으며, 수동 삽입을 위해 존재합니다.

1. **iframe이 로드됩니다.** 웹 호스트가 브라우저에 로드됩니다. URL에 `?waitForCustomConfig`가 있으므로 앱은 최소한의 스켈레톤을 마운트하고 대기합니다 — 아직 인증 토큰을 읽거나 API 엔드포인트를 호출하지 않습니다.

2. **부모가 `SetConfig`를 보냅니다.** 부모는 `/facade/config`를 가져왔거나(또는 동등한 페이로드를 제공하고) PostMessage로 전달합니다:
   ```javascript
   iframe.contentWindow.postMessage(
     { type: '@gen2-chat', action: 'set-config', ...configPayload },
     config.iframe_origin
   )
   ```

3. **웹 호스트가 `AppConfig`를 받습니다.** 메시지 핸들러가 엔벨로프 타입과 액션을 검증한 뒤 전체 설정 객체를 추출합니다.

4. **초기화가 진행됩니다** — 이 시점 이후 내부 경로는 경로 A와 동일합니다.

## 내부 초기화 시퀀스

`AppConfig`를 사용할 수 있게 되면(어느 경로든), 웹 호스트는 다음 단계를 순서대로 실행합니다:

**1. Pinia 스토어 초기화.**
루트 Pinia 인스턴스가 생성되고 모든 스토어 모듈이 등록됩니다. 인증 상태는 `AppConfig.auth`에서 로드되며, 토큰은 메모리에 저장됩니다(또는 `hostConfig.session.type = 'cookie'`이면 쿠키에). `AppConfig.env`의 환경 URL은 Axios와 WebSocket 클라이언트가 사용하도록 스토어에 기록됩니다.

**2. Axios 설정.**
Axios 인스턴스는 `APP_API_URL`을 `baseURL`로 하고 인증 토큰을 기본 헤더로 주입하여 구성됩니다. 설정의 `axiosDefaults`가 있으면 병합됩니다. 이 인스턴스가 자식 iframe이 프록시 API를 통해 받는 그 인스턴스입니다.

**3. Vue Router 초기화.**
라우터는 `AppConfig.hostConfig.history`(`"hash"` 또는 `"browser"`)에 지정된 히스토리 모드로 생성됩니다. 시스템 라우트(`/c/:id`, `/chat/:id`, `/keeper/:id` 등)가 등록됩니다. 이는 정적 집합이며, 동적 마운트 라우트는 이후 단계에서 추가됩니다.

**4. PrimeVue 및 테마 주입.**
PrimeVue가 Vue 앱에 설치됩니다. `AppConfig.theming.global`과 `AppConfig.theming.host`의 CSS 커스텀 프로퍼티가 해당 스코프에 대한 `:root { --key: value; }` 오버라이드로 주입됩니다. `theming.global`과 `theming.host`의 `customCSS` 문자열은 `<style>` 태그로 주입되고, `theming.global` / `theming.host`의 아이콘은 Iconify에 등록됩니다. 이 단계는 앱이 마운트되기 전에 적용되므로 첫 렌더링부터 올바른 테마가 적용됩니다.

**5. Vue 앱 마운트.**
루트 `App.vue` 컴포넌트가 DOM에 마운트됩니다. 이 시점에 사용자는 크롬 — 사이드바, 채팅 패널, 레이아웃 스켈레톤 — 을 보게 되며, 페이지 콘텐츠는 아직 로딩 중일 수 있습니다.

**6. 동적 라우트 등록.**
앱이 `GET /api/public/pages/routes`를 호출해 등록된 뷰 페이지 목록을 가져옵니다. 레지스트리 엔트리가 `mountRoute`를 선언한 각 페이지에 대해 `router.addRoute('app', ...)`를 호출하여 살아 있는 라우터에 라우트를 추가합니다. 이름 있는 `app` 라우트는 모든 콘텐츠를 감싸는 부모 레이아웃 라우트입니다.

이 단계에서 마운트 라우트 충돌(중복 경로, 예약 세그먼트, 잘못된 구문)이 있으면 pages 스토어에 치명적 오류가 설정됩니다. `App.vue`가 이를 감지하여 정상 UI 대신 설명이 담긴 전체 화면 `<wippy-error>`를 렌더링합니다.

**7. URL 해석.**
라우터가 현재 URL을 해석합니다(브라우저 히스토리 모드에서는 `window.location`에서, 해시 모드에서는 해시에서). URL이 시스템 라우트나 등록된 마운트 라우트와 일치하면 해당 페이지가 렌더링됩니다. 어떤 라우트와도 일치하지 않으면 라우터는 채팅 홈 뷰로 폴백합니다.

**8. WebSocket 연결.**
WebSocket 클라이언트가 인증 토큰을 사용해 `APP_WEBSOCKET_URL`에 연결합니다. 실시간 이벤트(수신 메시지, 세션 업데이트, 아티팩트 상태 변경)가 흐르기 시작합니다. 연결은 페이지의 수명 동안 유지됩니다.

## AppConfig TypeScript 인터페이스

`initWippyApp`과 `SetConfig`가 모두 받는 전체 설정 타입입니다. `AppConfig`에는 `feature` 필드도 `fe_mode` 필드도 없다는 점에 유의하세요 — `fe_mode`는 모듈 엔트리를 선택하는 파사드 요구 사항 파라미터이며, managed 모드는 `hostConfig.layout`을 통해 호스트에 전달됩니다:

```typescript
interface AppConfig {
  $schema: 'wippy-context-2.0'
  auth: AppAuthConfig
  env: AppEnv
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: ApiRoutesOverride
  tanstack?: TanstackConfig    // TanStack Query 기본값 (전역 + 역할 기반 카테고리별)
  theming: AppTheming
  hostConfig: HostConfig
  context: AppContext
}

interface AppAuthConfig {
  token: string            // Bearer 토큰
  expiresAt: string        // ISO 8601 만료 타임스탬프
}

interface AppEnv {
  APP_API_URL: string
  APP_AUTH_API_URL: string
  APP_WEBSOCKET_URL: string
  [key: string]: string | undefined
}

interface AppTheming {
  global?: ThemingScope
  host?: ThemingScope
  children?: ThemingScope
}

interface ThemingScope {
  customCSS?: string
  cssVariables?: Record<string, string>
  icons?: Record<string, unknown>
  iconSets?: Record<string, Record<string, unknown>>
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
  additionalNavItems?: PageApi.Page[]
  stateCache?: { maxPages?: number; maxSizePerPage?: number }
  allowAdditionalTags?: Record<string, string[]>   // 태그 → 허용 어트리뷰트
  chat?: {
    convertPasteToFile?: {
      enabled: boolean
      minFileSize: number
      allowHtml: boolean
    }
  }
  layout?: HostLayoutDeclaration
}

// TanStack Query 기본값. 최상위 필드이며 호스트와 자식이 공유합니다
// (apiRoutes와 동일). 설정이 없을 때의 기본 동작은 refetchOnWindowFocus: false로,
// 다른 탭에 갔다 돌아와도 진행 중인 콘텐츠가 다시 로드되지 않습니다.
interface TanstackConfig {
  default?: TanstackQueryOptions   // 전역 쿼리 기본값을 오버라이드
  content?: TanstackQueryOptions   // 단일 리소스 렌더링 (page/artifact/session/entry/model/upload)
  lists?: TanstackQueryOptions     // 내비게이션 / 인덱스 / 목록 쿼리
}

// TanStack 쿼리 옵션의 JSON 안전 부분집합 (함수 없음 — 설정은 JSON입니다).
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
  [key: string]: unknown
}
```

## 설정 소스와 우선순위

웹 호스트는 여러 소스에서 설정을 해석하며, 우선순위는 낮은 것부터 높은 것 순으로 다음과 같습니다:

1. **내장 기본값** — 웹 호스트 번들 자체에 정의되어 있습니다.
2. **URL 쿼리 파라미터** — `?token=<token>`, `?expiresAt=<timestamp>`, 쿠키 세션용 `?persist`. 부모 페이지 없이 개발용으로 직접 접근할 때 유용합니다.
3. **`initWippyApp()` 인자** — 표준 파사드(JS 모듈) 경로이며 URL 파라미터보다 우선합니다.
4. **PostMessage `SetConfig`** — 수동, 파사드 없는 iframe 경로로 `?waitForCustomConfig`가 있을 때 사용됩니다.

실무에서 프로덕션 배포는 항상 `initWippyApp()`(파사드 경로) 또는 PostMessage(수동 iframe 임베딩)를 사용합니다. URL 파라미터는 토큰과 함께 호스트를 브라우저에서 직접 로드하기 위한 개발 편의 수단입니다.

## 부트스트랩 다이어그램

표준 파사드(JS 모듈) 경로:

```
페이지에 module.js / managed-layout.js 로드
  │
  ├─ window.initWippyApp(config, '#app')
  │     config.AppConfig = { $schema, auth, env, theming, hostConfig, context }
  │
  ├─ Pinia 초기화 (auth 스토어, config 스토어)
  ├─ Axios 설정 (baseURL, 인증 헤더)
  ├─ Vue Router 생성 (히스토리 모드, 시스템 라우트)
  ├─ PrimeVue 설치, 테마 CSS 주입
  ├─ App.vue 마운트
  │
  ├─ GET /api/public/pages/routes
  │     각 백엔드 mountRoute마다 router.addRoute('app', ...)
  │
  ├─ 현재 URL 해석 → 일치하는 뷰 렌더링
  └─ WebSocket 연결
```

## 함께 보기

- [파사드 엔트리 포인트](./entry-point.md) — `wippy/facade`가 `AppConfig`를 구성하고 전달하는 방식
- [다중 패널 레이아웃](./multi-panel-layout.md) — `managed-layout.js`가 서빙하는 managed 레이아웃 부트 경로
- [렌더 엔진](./render-engines.md) — 로드된 페이지가 렌더링되는 방식(srcdoc iframe vs Web Fragment)
