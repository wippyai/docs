---
title: "파사드 엔트리 포인트"
description: "wippy/facade 백엔드 모듈은 Web Host를 사용자에게 전달하는 엔트리 포인트입니다. Web Host JS 모듈을 로드하는 HTML 페이지를 서빙하고,…"
---

# 파사드 엔트리 포인트

`wippy/facade` 백엔드 모듈은 Web Host를 사용자에게 전달하는 엔트리 포인트입니다. 이 모듈은 Web Host JS 모듈을 로드하는 HTML 페이지를 서빙하고, 인증 리다이렉트를 처리하며, `/facade/config` 엔드포인트를 노출하고, 배포별 설정을 CDN에 호스팅된 프런트엔드 번들로 연결합니다. 번들 자체에는 어떤 설정도 내장되지 않습니다. 모든 배포는 이 메커니즘을 통해 자신만의 설정을 제공합니다.

![파사드 엔트리 포인트](../diagrams/facade-entry-point.svg)

## HTML 페이지

사용자가 Wippy 애플리케이션으로 이동하면 `wippy/facade`가 HTML 페이지를 서빙합니다. 이 페이지는 얇습니다. CDN에서 Web Host JS 모듈을 로드하고 `/facade/config`가 반환한 설정으로 호스트를 초기화합니다. 모듈은 브라우저 히스토리를 포함해 페이지 전체를 넘겨받으므로, 호스트는 iframe 내부가 아니라 애플리케이션 전체로서 실행됩니다.

파사드는 설정된 `fe_mode`에 따라 두 가지 JS 모듈 엔트리 중 하나를 로드합니다:

- **`module.js`** — **compat** 셸(기본값): 표준 내비게이션 사이드바 + 페이지 영역 + 우측 채팅 패널 레이아웃입니다.
- **`managed-layout.js`** — **managed** 셸(옵트인, 얼리 액세스): 선언적 다중 패널 레이아웃입니다.

페이지를 단순화하면 다음과 같습니다:

```javascript
const configResponse = await fetch('/api/public/facade/config')
if (!configResponse.ok)
  throw new Error('Facade config request failed: ' + configResponse.status)
const cfg = await configResponse.json()

const storedAuth = localStorage.getItem('@wippy_token_info')
if (!storedAuth)
  throw new Error('Authentication is required before bootstrapping the host')
const { token } = JSON.parse(storedAuth)
if (typeof token !== 'string' || token.length === 0)
  throw new Error('Stored authentication does not contain a token')

const mapResponse = await fetch(cfg.facade_url + '/import-map.json')
if (!mapResponse.ok)
  throw new Error('Host import map request failed: ' + mapResponse.status)
const hostMap = await mapResponse.json()
await new Promise((resolve, reject) => {
  const script = document.createElement('script')
  script.src = cfg.facade_url + '/@wippy-fe/import-map-bootstrap.js'
  script.onload = resolve
  script.onerror = reject
  document.head.appendChild(script)
})
window.WippyImportMapBootstrap.register(undefined, hostMap, cfg.importMap, document.baseURI)

await import(cfg.facade_url + cfg.module_file)
window.initWippyApp({
  $schema: cfg.facade_url + '/schemas/wippy-context-2.2.json',
  auth: { token, expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
  env: cfg.env,
  routePrefix: cfg.routePrefix,
  themeMode: window.wippyThemePersist?.read() || cfg.themeMode,
  apiRoutes: cfg.apiRoutes,
  attention: cfg.attention,
  allowSelectModel: cfg.allowSelectModel,
  hideSessionSelector: cfg.hideSessionSelector,
  allowAdditionalTags: cfg.allowAdditionalTags,
  axiosDefaults: cfg.axiosDefaults,
  iconify: cfg.iconify,
  importMap: cfg.importMap,
  theming: cfg.theming,
  hostConfig: cfg.hostConfig,
  context: { resourceId: '', resourceType: 'page' },
}, '#app')
```

페이지는 자신의 설정을 가져와 모듈의 init 함수에 넘깁니다. 호스트는 페이지에 마운트되어 라우팅과 브라우저 히스토리를 넘겨받고 전체 초기화를 진행합니다.

> **fetch 경로에 대한 참고.** `/facade/config`는 파사드가 공개 라우터에 등록하는 경로이며, 페이지가 실제로 요청하는 URL에는 그 라우터의 접두사가 포함됩니다. 예시 접두사 `/api/public`을 쓰면 `/api/public/facade/config`가 되며, 이는 배포되는 파사드 페이지가 실제로 요청하는 경로입니다. 여기 인라인으로 쓰인 `fetch('/facade/config')` 코드는 가독성을 위해 줄인 것입니다.

## 설정 흐름

설정 흐름은 두 단계입니다:

1. 페이지는 동일 출처의 공개 라우터에서 `/facade/config`를 가져옵니다.

2. 셸은 Host import map을 가져오고 공유 bootstrap을 로드한 뒤 Host map과 `cfg.importMap`을 합성해 등록합니다. 그 후에만 `cfg.module_file`을 동적으로 import합니다. 셸은 반환된 필드로 `AppConfig`를 만들고 `wippy-context-2.2` 스키마, `auth`, `context`를 추가한 다음 `initWippyApp`을 호출합니다.

Web Host는 설정 객체에서 `AppConfig` 페이로드를 추출하고 전체 초기화를 진행합니다. 이 시점 이후 페이지 스크립트는 수동적입니다. 모든 사용자 상호작용은 마운트된 호스트 내부에서 일어납니다.

이 패턴 덕분에 CDN에 호스팅된 번들에는 배포별 URL, 토큰, 브랜딩이 전혀 포함되지 않습니다. 번들은 모든 배포에서 동일하며, 설정 페이로드만 다릅니다.

이 엔드포인트는 셸 설정과 일부 Web Host 필드를 반환합니다. 완전한 `AppConfig`를 반환하지는 않습니다. 셸이 `$schema`, `auth`, `context`를 추가한 뒤 `initWippyApp`을 호출합니다. 현재 계약은 `wippy-context-2.2`입니다.

## `/facade/config` 응답

이 엔드포인트는 셸 설정과 일부 Web Host 필드를 반환합니다. 완전한 `AppConfig`를 반환하지는 않습니다. 셸이 `$schema`, `auth`, `context`를 추가한 뒤 `initWippyApp`을 호출합니다. 현재 계약은 `wippy-context-2.2`입니다.

```json
{
  "facade_url": "https://web-host.wippy.ai/<release-tag>",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "login_redirect_param": "return_to",
  "mode": "compat",
  "module_file": "/module.js",
  "env": {
    "APP_API_URL": "https://api.example.com",
    "APP_AUTH_API_URL": "https://api.example.com",
    "APP_WEBSOCKET_URL": "wss://api.example.com"
  },
  "routePrefix": "https://api.example.com",
  "themeMode": "auto",
  "themePersist": "localStorage",
  "themeStorageKey": "@wippy-theme-mode",
  "axiosDefaults": { "timeout": 30000 },
  "apiRoutes": { "agents": { "list": "/custom/agents" } },
  "tanstack": { "lists": { "refetchOnWindowFocus": true } },
  "iconify": {},
  "importMap": {
    "imports": { "example-package": "https://cdn.example.com/example-package.js" }
  },
  "extraScripts": ["/monitoring.js"],
  "theming": {},
  "hostConfig": {}
}
```

### 필드 레퍼런스

**셸 수준 필드** — 임베딩 페이지가 자신을 구성하는 데 사용하며, 자식 `AppConfig`의 일부가 아닙니다:

| 필드 | 설명 |
|-------|-------------|
| `facade_url` | Web Host 번들의 기본 CDN URL. 모듈 엔트리와 벤더 스크립트를 해석하는 데 사용됩니다. |
| `iframe_origin` | CDN의 `Origin` 헤더 값. 수동 iframe 임베딩에서 PostMessage의 `targetOrigin`으로 사용됩니다(아래 참고). |
| `iframe_url` | `?waitForCustomConfig`를 포함한 전체 iframe `src`. 파사드를 쓰지 않는 수동 iframe 임베딩에서만 사용됩니다(아래 참고). |
| `login_path` | 인증되지 않은 사용자를 리다이렉트할 페이지 출처 상의 경로. |

**자식 `AppConfig` 필드** — 호스트의 init 함수에 전달되어 실행 중인 호스트가 사용합니다:

| 필드 | 설명 |
|-------|-------------|
| `$schema` | 설정 계약 버전(`"wippy-context-2.2"`). |
| `auth` | `AppConfig.auth`로 주입되는 런타임 bearer 토큰과 만료 시각. |
| `env` | 최상위 `AppConfig.env`로 주입되는 런타임 URL. |
| `routePrefix` | 자식 앱으로 전달되는 API URL 접두사. |
| `axiosDefaults` | 자식 앱으로 전달되는 Axios 인스턴스 기본값. |
| `apiRoutes` | 개별 API 엔드포인트 경로 오버라이드(최상위 `AppConfig` 필드). |
| `tanstack` | TanStack Query 기본값 — 전역 + 역할 기반 카테고리별(`content`/`lists`). 최상위 `AppConfig` 필드입니다. 호스트 기본값은 `refetchOnWindowFocus:false`입니다. |
| `iconify` | `cfg.iconify`에서 전달되는 명시적 Iconify 공급자 소스입니다. |
| `importMap` | `cfg.importMap`에서 전달되는 선택적 브라우저 import map 확장입니다. 셸은 Host 모듈을 import하기 전에 등록합니다. |
| `theming` | 세 가지 스코프로 나뉜 CSS 커스터마이제이션. |
| `hostConfig` | Web Host 기능 플래그와 UI 설정. |
| `context` | 호스트의 초기 페이지 또는 아티팩트 컨텍스트. |

**`env` 필드:**

| 필드 | 출처 | 설명 |
|-------|--------|-------------|
| `APP_API_URL` | `PUBLIC_API_URL` 환경 변수 | 모든 백엔드 HTTP 호출의 기본 URL |
| `APP_AUTH_API_URL` | `APP_API_URL`과 동일 | 인증 엔드포인트 URL (커스텀 구성에서는 다를 수 있음) |
| `APP_WEBSOCKET_URL` | `APP_API_URL`에서 파생 | `http://` → `ws://`, `https://` → `wss://` |

**`theming` 스코프:**

| 스코프 | 적용 대상 |
|-------|-----------|
| `global` | 호스트 크롬과 모든 자식 iframe |
| `host` | 호스트 크롬만. 사이드바에 표시되는 앱 타이틀, 아이콘, 이름을 위한 `i18n.app`도 함께 담습니다. |
| `children` | 자식 iframe만 (프록시 스크립트가 주입) |

**`hostConfig` 필드:**

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `session.type` | `"non-persistent"` \| `"cookie"` | `"non-persistent"` | 토큰 저장 모드 |
| `history` | `"hash"` \| `"browser"` | `"hash"` | Vue Router 히스토리 모드 |
| `showAdmin` | boolean | `true` | UI에 관리자 기능 표시 |
| `allowSelectModel` | boolean | `false` | LLM 모델 선택기 표시 |
| `startNavOpen` | boolean | `false` | 로드 시 내비게이션 사이드바 펼침 |
| `hideNavBar` | boolean | `false` | 왼쪽 내비게이션 사이드바를 완전히 숨김 |
| `disableRightPanel` | boolean | `false` | 오른쪽 아티팩트 패널 비활성화 |
| `hideSessionSelector` | boolean | `false` | 채팅 세션 선택기 숨김 |
| `additionalNavItems` | array | `[]` | 사이드바에 주입되는 추가 항목 |
| `stateCache` | object | `{}` | 자식 iframe 상태를 위한 LRU 캐시 설정 |
| `allowAdditionalTags` | object | `{}` | HTML 새니타이저 태그 화이트리스트 (`Record<string, string[]>`, 태그 → 허용 속성) |
| `chat` | object | `{}` | 채팅 UI 오버라이드 (붙여넣기-파일 변환 동작 등) |

## 인증 흐름

사용자가 페이지를 로드할 때 인증되어 있지 않으면, `wippy/facade`는 HTML 페이지를 서빙하기 전에 `login_path`로 리다이렉트합니다. 로그인이 성공하면 사용자는 원래 URL로 돌아옵니다. 인증 상태는 Web Host 설정 자체를 통해 전달되지 않습니다. Web Host는 인증된 페이지 응답이 `auth`/`env`에 담아 준 인증 토큰을 신뢰합니다.

설정 엔드포인트는 HTML 페이지를 서빙한 것과 동일한 인증 세션에서 서빙되므로, `APP_API_URL`과 여기서 파생된 WebSocket URL은 그 사용자에게 맞는 백엔드를 자동으로 반영합니다.

## 모듈 init 함수

JS 모듈 엔트리는 페이지에 `window.initWippyApp`을 등록합니다. 파사드 페이지는 `/facade/config`에서 가져온 설정 객체로 이를 호출합니다. `fe_mode`가 파사드가 로드할 모듈을 선택하며(**compat**은 `module.js`, **managed**는 `managed-layout.js`), 둘 다 동일한 `initWippyApp` 엔트리 함수를 노출합니다. 모듈 선택은 어떤 셸이 렌더링되는지에 관한 것이며, 임베딩 방식(JS 모듈 페이지 대 수동 iframe)과는 무관합니다.

`initWippyApp(config, rootContainer?)`는 단순한 이벤트 이미터를 반환합니다:

```javascript
const events = window.initWippyApp(config, '#app')
events.on('ready', () => console.log('Wippy loaded'))
events.on('error', err => console.error('Failed to load:', err))
```

루트 컨테이너 없이 호출하면 호스트는 기본 엘리먼트에 마운트됩니다. 이 시점 이후 호스트가 페이지와 브라우저 히스토리를 넘겨받습니다.

## 수동(파사드 없는) iframe 임베딩

위의 JS 모듈 페이지가 표준이자 권장 경로이며 현재 파사드가 사용하는 방식입니다. 전체 호스트를 **iframe 내부에서** 실행하고 싶은 경우, 예를 들어 주변 애플리케이션으로부터 더 강한 격리를 유지하면서 페이지의 일부만 차지하게 하고 싶은 경우를 위한 두 번째 임베딩 메커니즘도 있습니다. 이 모드에서는 호스트를 직접 임베드하며, 파사드는 이 페이지를 생성하지 않습니다.

![수동 iframe 임베딩](../diagrams/manual-iframe-embedding.svg)

URL과 설정을 얻기 위해 파사드의 `/facade/config` 엔드포인트를 그대로 재사용할 수 있습니다. `iframe_url`(`?waitForCustomConfig`가 이미 붙은 호스트의 `iframe.html` 엔트리)과 `iframe_origin`(PostMessage의 `targetOrigin`)은 정확히 이 경로를 위해 존재합니다. 그다음에는 iframe을 직접 만들고 설정 핸드셰이크를 마무리합니다.

JS 모듈 경로와 달리, iframe 내부의 호스트는 자신의 설정을 **요청합니다**. 부팅한 뒤 부모에게 `get-config` 메시지를 보내고, 부모가 `set-config`로 응답합니다. 따라서 부모는 `load` 시점에 무작정 설정을 밀어 넣는 것이 아니라 요청을 **수신 대기**합니다:

```javascript
async function mountWippyIframe(auth) {
  const response = await fetch('/api/public/facade/config')
  if (!response.ok)
    throw new Error(`Facade config request failed: ${response.status}`)
  const cfg = await response.json()
  const iframe = document.getElementById('wippy')
  if (!(iframe instanceof HTMLIFrameElement))
    throw new Error('Expected <iframe id="wippy">')

  const iframeUrl = new URL(cfg.iframe_url)
  if (iframeUrl.origin !== cfg.iframe_origin)
    throw new Error('iframe_url and iframe_origin must identify the same origin')

  const appConfig = {
    $schema: `${cfg.facade_url}/schemas/wippy-context-2.2.json`,
    auth,
    env: cfg.env,
    routePrefix: cfg.routePrefix,
    themeMode: cfg.themeMode,
    apiRoutes: cfg.apiRoutes,
    axiosDefaults: cfg.axiosDefaults,
    iconify: cfg.iconify,
    importMap: cfg.importMap,
    tanstack: cfg.tanstack,
    theming: cfg.theming,
    hostConfig: cfg.hostConfig,
    context: { resourceId: '', resourceType: 'page' },
  }

  function onMessage(event) {
    if (event.origin !== cfg.iframe_origin || event.source !== iframe.contentWindow)
      return

    let message
    try {
      message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
    }
    catch {
      return
    }
    if (message?.type === '@gen2-chat' && message.action === 'get-config') {
      event.source.postMessage(
        JSON.stringify({ type: '@gen2-chat', action: 'set-config', ...appConfig }),
        cfg.iframe_origin,
      )
    }
  }

  window.addEventListener('message', onMessage)

  // iframe_url already includes ?waitForCustomConfig
  iframe.src = iframeUrl.href

  return function unmount() {
    window.removeEventListener('message', onMessage)
    iframe.remove()
  }
}
```

`?waitForCustomConfig`가 있으면 standalone bootstrap은 부모의 `set-config` message를 기다린 뒤 import map을 등록하고 Host 앱 module을 import합니다. 이때 앱은 아직 mount되지 않았습니다. 이 query가 없으면 일반 standalone config 경로를 사용합니다.

핸드셰이크는 `@gen2-chat` PostMessage 프로토콜을 사용합니다:

1. 부모가 `GET /facade/config`를 가져오거나(또는 동등한 `AppConfig` 페이로드를 직접 제공하고) `iframe_url`을 가리키는 iframe을 만듭니다.
2. 부팅 중인 iframe이 부모에게 `{ type: '@gen2-chat', action: 'get-config' }`를 보냅니다.
3. 부모의 `message` 리스너가 `iframe_origin`을 대상으로 `{ type: '@gen2-chat', action: 'set-config', ...config }`로 응답합니다.

나중에 설정을 바꿀 때는 같은 iframe에 전체 `set-config` 메시지를 다시 보내고
`iframe_origin`을 대상으로 지정하세요. Host는 remount 없이 변경을 적용합니다. 이
iframe의 API 요청은 iframe 문서의 origin에서 발생합니다. backend API를 같은 origin에서
제공하거나 backend CORS 정책에서 iframe 문서 origin을 허용하세요. CORS는 backend 정책이며
AppConfig 설정이 아닙니다.

Web Host는 `AppConfig` 페이로드를 추출하고 전체 초기화를 진행합니다. 전체 메시지 프로토콜(`@gen2-chat` 봉투와 `IFrameMessageType` enum)은 [프록시와 격리](./proxy-isolation.md)를 참고하십시오. 이 `SetConfig` 핸드셰이크는 파사드를 쓰지 않는 수동 임베딩에만 해당하며, `wippy/facade` 모듈은 대신 Web Host를 JS 모듈로 로드합니다.

## 파사드 모듈 설정

위의 설정 응답을 만들어 내는 `wippy/facade` 파라미터는 `_index.yaml`에서 설정합니다. `app-template`의 실제 예시입니다:

```yaml
- name: facade
  kind: ns.dependency
  component: wippy/facade
  version: '>=v0.5.37'
  parameters:
    - name: server
      value: app:gateway
    - name: router
      value: app:api.public
    - name: app_title
      value: Wippy App
    - name: app_name
      value: Wippy App
    - name: app_icon
      value: "wippy:logo"
    - name: show_admin
      value: "false"
    - name: hide_nav_bar
      value: "true"
    - name: login_path
      value: /app/login.html
    - name: session_type
      value: non-persistent
    - name: history_mode
      value: browser
    - name: custom_css
      value: "@import url('https://fonts.googleapis.com/css2?family=Poppins...');
             body { font-family: 'Poppins', sans-serif; }"
    - name: css_variables
      value: '{"--p-primary":"#6366f1"}'
    - name: host_custom_css
      value: ".wippy-host-app .chat-container { background: var(--p-content-background); }"
    - name: tanstack
      value: '{"lists":{"refetchOnWindowFocus":true}}'
```

사용 가능한 전체 파라미터 목록과 기본값은 [파사드 모듈 레퍼런스](../../framework/facade.md)를 참고하십시오.

## Host에 import map 전달

receiver는 iframe `SetConfig` message를 물리적 부모 window에서 온 경우에만 받습니다. 부모 origin에 접근할 수 있으면 `event.origin`도 비교합니다. Web Fragment에서는 해당 occurrence의 자체 `fragmentId`를 대상으로 지정해야 합니다.

facade requirement 이름은 `import_map`이고 `/facade/config`는 이를 `cfg.importMap`으로 반환합니다. shell은 Host module을 import하기 전에 공유 import-map bootstrap에 이 값을 전달합니다. 이후 초기 `initWippyApp` config에 `importMap: cfg.importMap`을 전달합니다. [부트스트랩 순서](./bootstrap.md#appconfig-import-map)를 참조하세요. import map 변경은 기존 문서에 적용되지 않습니다. 새 맵을 사용하려면 문서를 다시 로드하거나 새로 만드세요.

이 필드는 지원이 문서화된 Host 릴리스에서만 사용하세요.
