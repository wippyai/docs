---
title: "부트스트랩 시퀀스"
description: "웹 호스트는 설정을 받은 뒤 어떤 UI도 렌더링하기 전에 고정된 초기화 시퀀스를 실행합니다. 이 시퀀스는 다음에 따라 약간 달라집니다…"
---

# 부트스트랩 시퀀스

웹 호스트는 설정을 받은 뒤 어떤 UI도 렌더링하기 전에 고정된 초기화 시퀀스를 실행합니다. 이 시퀀스는 웹 호스트가 페이지를 인수하는 JS 모듈로 로드되었는지(표준 파사드 경로) iframe 안에서 실행되는지(수동, 파사드 없는 경로)에 따라 약간 달라지지만, 설정을 사용할 수 있게 된 이후의 내부 단계는 동일합니다.

## 경로 A — JS 모듈 (표준, 파사드 경로)

현재 `wippy/facade`가 사용하는 경로입니다. 파사드는 웹 호스트 JS 모듈 엔트리 — **compat** 모드는 `module.js`, **managed** 모드는 `managed-layout.js` — 를 로드하는 페이지를 서빙하고, 그 모듈이 페이지 전체와 브라우저 히스토리를 인수합니다.

1. **설정을 가져오고 map을 등록합니다.** facade requirement 이름은 `import_map`이고 `/facade/config`는 이를 `cfg.importMap`으로 반환합니다. shell은 공유 import-map bootstrap을 로드하고 Host module을 import하기 전에 조합된 map을 등록합니다.

2. **Host module을 import하고 앱을 초기화합니다.** shell은 `module.js` 또는 `managed-layout.js`를 import하며, module은 `window.initWippyApp`을 제공합니다. 그다음 `importMap: cfg.importMap`이 포함된 초기 `AppConfig`로 `initWippyApp(appConfig, rootContainer?)`을 호출합니다. PostMessage handshake는 없습니다.

3. **초기화가 진행됩니다** — 아래 [내부 초기화 시퀀스](#internal-init-sequence)를 참고하세요.

## 경로 B — Iframe (수동, 파사드 없음)

전체 호스트를 직접 iframe 안에 임베드할 때 — 더 강한 격리가 필요한 부분 페이지 임베딩을 위해 — 취하는 경로입니다. `iframe.html?waitForCustomConfig`를 로드하고 `SetConfig` PostMessage로 설정을 받습니다. 현재 파사드는 이를 만들지 않으며, 수동 삽입을 위해 존재합니다.

1. **부모가 iframe을 준비합니다.** 버전이 지정된 `iframe.html` URL에 `?waitForCustomConfig`를 추가합니다. `iframe.src`를 설정하기 전에 `message` listener를 등록합니다. standalone bootstrap은 import map을 등록하거나 Host 앱 module을 import하기 전에 부모의 `SetConfig`를 기다립니다. 이 과정은 Host 앱이 mount되기 전에 일어납니다.

2. **부모가 `GetConfig`에 응답합니다.** iframe의 `get-config` 메시지를 기다립니다.
   `event.origin`이 신뢰하는 iframe origin과 일치하고 `event.source`가 정확히
   `iframe.contentWindow`일 때만 수락합니다. 그런 다음 전체 `AppConfig`를
   `set-config` 메시지로 보내고 신뢰하는 origin을 `targetOrigin`으로 지정합니다.
   `/facade/config`는 배포 설정을 제공하지만 부모는 `$schema`, `auth`, `context`를
   추가해야 합니다. 자세한 내용은 [전체 iframe 예제](./entry-point.md#manual-facade-less-iframe-embedding)를
   참조하세요.

3. **Web Host가 `AppConfig`를 받습니다.** message envelope을 검증하고 iframe message는 물리적 부모 window에서 온 것만 받습니다. 부모 origin에 접근할 수 있으면 `event.origin`도 비교합니다. Web Fragment에서는 해당 occurrence의 자체 ID와 `fragmentId`가 일치해야 합니다. 이후의 유효한 `SetConfig` message는 해당 document의 config를 업데이트할 수 있습니다.

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
  $schema: 'wippy-context-2.2'
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
facade shell이 /facade/config를 가져옴 (requirement import_map → cfg.importMap)
  │
  ├─ Host map을 가져오고 공유 import-map bootstrap을 로드함
  ├─ 조합된 import map을 등록함
  ├─ module.js / managed-layout.js를 import함
  ├─ module이 window.initWippyApp을 제공함
  ├─ shell이 initWippyApp({ ..., importMap: cfg.importMap }, '#app')을 호출함
  ├─ resolveConfig() → config/auth/env state를 migrate 및 normalize함
  ├─ GET /api/public/pages/routes를 기다림
  ├─ Vue app과 router를 생성함
  │     static system routes + validated backend mount routes
  ├─ setupApp() → Pinia, Axios, PrimeVue, theme 등을 구성함
  ├─ App.vue를 mount하고 현재 URL을 확인함
  └─ component가 필요할 때 WebSocket client를 요청함
```

## 함께 보기

- [파사드 엔트리 포인트](./entry-point.md) — `wippy/facade`가 `AppConfig`를 구성하고 전달하는 방식
- [다중 패널 레이아웃](./multi-panel-layout.md) — `managed-layout.js`가 서빙하는 managed 레이아웃 부트 경로
- [렌더 엔진](./render-engines.md) — 로드된 페이지가 렌더링되는 방식(srcdoc iframe vs Web Fragment)


## Iconify 소스

`AppConfig.iconify.providers`에서 Iconify 소스를 구성합니다. 생략하면 온라인 기본값을 사용합니다. 명시적으로 구성한 값은 AppConfig를 통해 하위 앱에 전달됩니다. [Iconify 공급자](./iconify.md)를 참조하세요.

## PrimeVue와 브라우저 realm

앱은 고정된 Host import map의 정확한 스펙파이어로 PrimeVue를 가져옵니다. 다시
빌드한 소비자는 자신의 JavaScript realm에서 공유 PrimeVue vendor graph를 사용합니다.
각 iframe과 Web Fragment는 별도의 realm과 모듈 graph를 가집니다. import map은
스타일을 삽입하지 않습니다. 필요한 PrimeVue CSS는 문서화된 Host CSS key로 요청하세요.
이미 포함된 소비자 bundle은 새 맵에 맞춰 다시 빌드해야 합니다.

## AppConfig import map

`AppConfig.importMap`은 표준 `imports`와 `scopes` 필드를 가진 선택적 최상위 브라우저 import map입니다.

```typescript
interface AppConfig {
  importMap?: {
    imports?: Record<string, string>
    scopes?: Record<string, Record<string, string>>
  } | null
}
```

srcdoc 페이지 문서에서 Host는 페이지 맵, 생성된 Host 기본값, `AppConfig.importMap` 순서로 합성합니다. standalone 및 facade 문서와 각 Web Fragment occurrence에는 srcdoc 페이지 맵이 없으므로 Host 기본값과 `AppConfig.importMap`을 합성합니다. 각 Web Fragment occurrence는 별도의 물리 realm iframe에서 실행됩니다. `imports`와 각 scope에서 일치하는 키의 마지막 값이 우선하며 다른 항목은 유지됩니다. 설정은 Vue, PrimeVue, Wippy를 포함한 페이지 또는 Host 매핑을 바꿀 수 있습니다. 정확한 키는 하나의 specifier와 일치합니다. `/`로 끝나는 키는 해당 specifier prefix와 일치하며 대상 URL도 `/`로 끝나야 합니다. `scopes`는 import하는 모듈 URL에 따라 매핑을 선택합니다. 상대 대상 URL은 문서 base URL을 기준으로 해석됩니다.

모듈을 불러오기 전에 map을 구성하고 native import map을 등록해야 합니다. 나중에 다른 map을 추가해도 이미 등록한 키를 바꿀 수 없습니다. 업데이트에서 `importMap`을 생략하면 현재 확장 설정을 유지합니다. `null` 또는 `{}`를 지정하면 확장 설정을 지웁니다.

import map 업데이트는 document를 만들 때 적용됩니다. 이미 열린 document의 module 해석은 바뀌지 않습니다. 업데이트를 적용하려면 그 document를 다시 불러오세요. 이후 만든 document는 최신 config를 사용합니다. 각 Web Fragment occurrence는 자체 물리 realm iframe을 가지며 해당 realm에서 module 실행 전에 map을 등록합니다.

공유 Vue, PrimeVue 또는 Wippy 항목을 바꾸면 Host와 자식 코드의 모듈 또는 서비스 identity가 달라질 수 있습니다. override를 배포하기 전에 공개된 정확한 map으로 통합 동작을 확인하세요.

이 필드는 지원이 문서화된 Host 릴리스에서만 사용하세요.
