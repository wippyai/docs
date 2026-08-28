---
title: "Facade 엔트리 포인트"
description: "wippy/facade가 Web Host를 제공하고 AppConfig를 구성하며 인증을 처리하고 수동 iframe 삽입을 지원하는 방식입니다."
---

# Facade 엔트리 포인트

이 페이지는 통합 참조입니다. shell bootstrap과 수동 iframe 블록은 개별 계약을 분리해 보여 주며 완전한 로그인 흐름이나 애플리케이션 프로젝트를 대체하지 않습니다.

`wippy/facade` 백엔드 모듈은 사용자에게 Web Host를 전달합니다. HTML shell과 `/facade/config`를 제공합니다. shell은 Web Host 모듈을 불러오고 브라우저에 저장된 인증 토큰을 검사해 인증되지 않은 사용자를 redirect하며, CDN 호스팅 프런트엔드 번들을 위한 배포별 구성을 조립합니다. 번들 자체에는 배포별 구성이 없습니다.

![Facade 엔트리 포인트](../diagrams/facade-entry-point.svg)

## HTML 페이지

사용자가 Wippy 애플리케이션으로 이동하면 Web Host 모듈이 페이지와 브라우저 history를 장악하므로 호스트는 iframe 안이 아니라 애플리케이션 자체로 실행됩니다.

facade는 구성된 `fe_mode`에 따라 두 JS 모듈 엔트리 중 하나를 불러옵니다.

- **`module.js`** — **compat** shell(기본값): 표준 탐색 사이드바 + 페이지 영역 + 오른쪽 채팅 패널 레이아웃.
- **`managed-layout.js`** — **managed** shell(선택적 조기 접근): 선언적 멀티 패널 레이아웃.

간소화된 bootstrap 호출은 다음과 같습니다. 실제 shell은 이 호출 전에 구성된 추가 script를 불러오고 Web Host import map을 설치하며 오류를 처리하고 저장된 테마를 적용합니다.

```javascript
const response = await fetch('/api/public/facade/config')
if (!response.ok)
  throw new Error(`Facade config request failed: ${response.status}`)
const cfg = await response.json()

const storedAuth = localStorage.getItem('@wippy_token_info')
if (!storedAuth)
  throw new Error('Authentication is required before bootstrapping the host')
const { token } = JSON.parse(storedAuth)
if (typeof token !== 'string' || token.length === 0)
  throw new Error('Stored authentication does not contain a token')

await import(cfg.facade_url + cfg.module_file)

const appConfig = {
  $schema: `${cfg.facade_url}/schemas/wippy-context-2.0.xsd`,
  auth: {
    token,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  },
  env: cfg.env,
  routePrefix: cfg.routePrefix,
  themeMode: window.wippyThemePersist?.read() || cfg.themeMode,
  apiRoutes: cfg.apiRoutes,
  axiosDefaults: cfg.axiosDefaults,
  theming: cfg.theming,
  hostConfig: cfg.hostConfig,
  context: { resourceId: '', resourceType: 'page' },
}

window.initWippyApp(appConfig, '#app')
```

> **Fetch 경로.** `/facade/config`는 facade가 public router에 등록하는 경로입니다. 요청 URL에는 해당 router의 접두사도 포함됩니다. 예제 접두사 `/api/public`에서는 실제 facade 페이지와 bootstrap 예제처럼 `/api/public/facade/config`를 요청합니다. 아래 계약 설명에서는 레지스트리 로컬 경로를 사용합니다.

## 구성 흐름

구성 흐름은 네 단계입니다.

1. 페이지의 inline JavaScript가 페이지와 같은 origin의 `GET /facade/config`를 호출합니다. 이 endpoint는 `wippy/facade`가 public router에 등록합니다.
2. shell이 localStorage에서 `@wippy_token_info`를 읽습니다. 값이 없거나 decode할 수 없으면 브라우저가 `login_path`로 redirect됩니다.
3. shell이 `extraScripts`를 불러오고 Web Host import map을 설치하며 `module_file`이 선택한 모듈을 import합니다.
4. shell이 지원되는 배포 필드에 `$schema`, `auth`, `context`를 추가한 뒤 `window.initWippyApp(appConfig, rootContainer?)`를 호출합니다.

Web Host는 조립된 `AppConfig`를 받아 전체 초기화를 진행합니다. 이후 페이지 script는 수동 상태이며 모든 사용자 상호작용은 마운트된 호스트 내부에서 일어납니다.

CDN 호스팅 번들은 배포마다 동일합니다. 배포별 URL과 브랜딩은 구성 응답에서 오고 bearer 토큰은 브라우저 저장소에서 옵니다.

> **구성 응답과 `AppConfig`.** `/facade/config`는 완전한 `AppConfig`를 반환하지 않습니다. `$schema`, `auth`, `context`가 없습니다. `facade_url`, `iframe_origin`, `iframe_url`, `login_path` 같은 필드는 shell 설정이며 `env`, `theming`, `hostConfig`는 조립된 `AppConfig`의 입력입니다.

## `/facade/config` 응답

구성 endpoint는 `wippy/facade`가 모듈 parameter와 실행 환경에서 조립한 shell 설정 및 Web Host 구성을 반환합니다. 다음은 구성된 응답 예제이며 비어 있는 선택적 JSON 블록은 생략합니다.

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
  "extraScripts": ["/monitoring.js"],
  "theming": {
    "global": {
      "customCSS": "@import url('https://fonts.googleapis.com/...');",
      "cssVariables": { "--p-primary": "#6366f1" },
      "iconSets": {}
    },
    "host": {
      "customCSS": ".wippy-host-app .chat-container { background: var(--p-content-background); }",
      "cssVariables": {},
      "iconSets": {},
      "i18n": {
        "app": {
          "title": "My App",
          "icon": "wippy:logo",
          "appName": "My Application"
        }
      }
    },
    "children": {
      "customCSS": "",
      "cssVariables": {}
    }
  },
  "hostConfig": {
    "session": { "type": "non-persistent" },
    "history": "hash",
    "renderEngine": "iframe",
    "showAdmin": true,
    "allowSelectModel": false,
    "startNavOpen": false,
    "hideNavBar": false,
    "disableRightPanel": false,
    "hideSessionSelector": false,
    "additionalNavItems": [
      { "id": "reports", "name": "Reports", "title": "Reports", "icon": "tabler:report", "order": 10 }
    ],
    "stateCache": { "maxPages": 50, "maxSizePerPage": 1048576 },
    "allowAdditionalTags": { "w-chart": ["data", "type"] },
    "chat": { "convertPasteToFile": { "enabled": true, "minFileSize": 1024, "allowHtml": false } }
  }
}
```

### 필드 참조

**Shell 및 통합 필드** — 표준 shell 또는 사용자 정의 embedder가 사용합니다.

| 필드 | 설명 |
|-------|-------------|
| `facade_url` | Web Host 번들의 기본 CDN URL. 모듈 엔트리와 vendor script 해석에 사용합니다. |
| `iframe_origin` | CDN의 `Origin` header 값. 수동 iframe 삽입 시 PostMessage의 `targetOrigin`으로 사용합니다(아래 참고). |
| `iframe_url` | `?waitForCustomConfig`를 포함한 전체 iframe `src`. 수동 facade 없는 iframe 삽입에서만 사용합니다. |
| `login_path` | 인증되지 않은 사용자를 redirect할 페이지 origin의 경로. |
| `login_redirect_param` | client 측 로그인 redirect 중 요청한 상대 URL을 받는 선택적 query parameter. |
| `mode` | 정규화된 프런트엔드 모드: `compat` 또는 `managed`. |
| `module_file` | `mode`가 선택한 모듈: `/module.js` 또는 `/managed-layout.js`. |
| `themePersist` | 구성된 테마 지속성 모드. 외부 페이지에서도 사용 가능합니다. |
| `themeStorageKey` | 구성된 cookie 또는 localStorage 키. 외부 페이지에서도 사용 가능합니다. |
| `extraScripts` | Web Host 모듈 전에 shell이 불러오는 선택적 script. |

**Endpoint가 반환하는 Web Host 필드** — 페이지가 조립하는 `AppConfig`에 선택적으로 복사됩니다.

| 필드 | 설명 |
|-------|-------------|
| `env` | 최상위 `AppConfig.env`로 주입되는 런타임 URL. |
| `routePrefix` | 자식 앱에 전달되는 API URL 접두사. |
| `themeMode` | 초기 테마 모드: `auto`, `light`, `dark`. 표준 shell에서는 저장된 선택이 우선합니다. |
| `axiosDefaults` | 자식 앱에 전달되는 Axios 인스턴스 기본값. |
| `apiRoutes` | 개별 API endpoint 경로 재정의(최상위 `AppConfig` 필드). |
| `tanstack` | endpoint가 반환하는 TanStack Query 기본값. 아래 전달 제한을 참고하십시오. |
| `theming` | 세 범위로 나뉜 CSS 사용자 정의. |
| `hostConfig` | Web Host 기능 flag 및 UI 구성. |

표준 shell은 다음 필수 `AppConfig` 필드를 직접 추가합니다.

| 필드 | 소스 |
|-------|--------|
| `$schema` | `<facade_url>/schemas/wippy-context-2.0.xsd` |
| `auth` | `@wippy_token_info`에서 읽은 토큰. 현재 shell은 초기화 시점부터 하루 뒤 만료를 생성합니다. |
| `context` | `{ resourceId: '', resourceType: 'page' }` |

> **현재 `tanstack` 전달 제한.** 구성 handler는 설정된 `tanstack` 객체를 반환하고 Web Host는 `AppConfig.tanstack`을 받습니다. 표준 facade shell은 현재 `initWippyApp` 인자에 `cfg.tanstack`을 복사하지 않으므로 facade parameter는 이 경로에서 효과가 없습니다. 수동 embedder는 조립한 `AppConfig`에 `tanstack: cfg.tanstack`을 포함할 수 있습니다.

**`env` 필드:**

| 필드 | 소스 | 설명 |
|-------|--------|-------------|
| `APP_API_URL` | `PUBLIC_API_URL` 환경 변수 | 모든 백엔드 HTTP 호출의 기본 URL |
| `APP_AUTH_API_URL` | `APP_API_URL`과 동일 | 인증 endpoint URL(사용자 정의 설정에서는 다를 수 있음) |
| `APP_WEBSOCKET_URL` | `APP_API_URL`에서 유도 | `http://` → `ws://`, `https://` → `wss://` |

**`theming` 범위:**

| 범위 | 적용 대상 |
|-------|-----------|
| `global` | 호스트 chrome과 모든 자식 페이지 렌더 컨텍스트 |
| `host` | 호스트 chrome만. 사이드바에 표시되는 앱 title, icon, name을 위한 `i18n.app`도 포함 |
| `children` | 자식 페이지 렌더 컨텍스트(srcdoc iframe 또는 Web Fragment) |

**`hostConfig` 필드:**

| 필드 | 유형 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `session.type` | `"non-persistent"` \| `"cookie"` | `"non-persistent"` | 토큰 저장 모드 |
| `history` | `"hash"` \| `"browser"` | `"hash"` | Vue Router history 모드 |
| `renderEngine` | `"iframe"` \| `"fragment"` | `"iframe"` | 패키지 `view.page` 애플리케이션의 렌더 엔진 |
| `showAdmin` | boolean | `true` | UI에 관리자 기능 표시 |
| `allowSelectModel` | boolean | `false` | LLM 모델 선택기 표시 |
| `startNavOpen` | boolean | `false` | 로드 시 탐색 사이드바 확장 |
| `hideNavBar` | boolean | `false` | 왼쪽 탐색 사이드바를 완전히 숨김 |
| `disableRightPanel` | boolean | `false` | 오른쪽 아티팩트 패널 비활성화 |
| `hideSessionSelector` | boolean | `false` | 채팅 세션 선택기 숨김 |
| `additionalNavItems` | array | `[]` | 사이드바에 주입되는 추가 항목 |
| `stateCache` | object | `{}` | 자식 페이지 상태의 LRU cache 구성 |
| `allowAdditionalTags` | object | `{}` | HTML sanitizer tag whitelist(`Record<string, string[]>`, tag → 허용 attribute) |
| `chat` | object | `{}` | 채팅 UI override(paste-to-file 동작 등) |

## 인증 흐름

facade는 client가 보유한 bearer 토큰을 알기 전에 HTML shell과 공개 구성 응답을 제공합니다. 브라우저에서 shell은 localStorage의 `@wippy_token_info`를 읽습니다. 값이 없거나 JSON이 유효하지 않으면 `login_path`로 redirect합니다. `login_redirect_param`이 구성되어 있으면 현재 path, query, hash를 추가해 로그인 흐름이 요청 URL로 사용자를 돌려보낼 수 있게 합니다.

유효한 저장 값에서는 shell이 `token`을 `AppConfig.auth`로 복사하고 초기화 하루 뒤를 `expiresAt`으로 생성합니다. 구성 endpoint 자체에는 토큰이나 사용자별 인증 상태가 없습니다. `APP_API_URL`, `APP_WEBSOCKET_URL`은 배포 설정이며 사용자별 값이 아닙니다.

## 모듈 Init 함수

두 JS 모듈 엔트리는 같은 `window.initWippyApp` 함수를 등록합니다. 모듈 선택은 어떤 shell이 렌더링되는지 결정하며 삽입 방식(JS 모듈 페이지 또는 수동 iframe)과는 독립적입니다.

`initWippyApp(appConfig, rootContainer?)`는 단순 event emitter를 반환합니다.

```javascript
const events = window.initWippyApp(appConfig, '#app')
events.on('ready', () => console.log('Wippy loaded'))
events.on('error', err => console.error('Failed to load:', err))
```

root container 없이 호출하면 호스트는 기본 요소에 마운트합니다.

## 수동(facade 없는) iframe 삽입

위 JS 모듈 페이지는 표준 권장 경로이며 현재 facade가 사용하는 방식입니다. 전체 호스트를 **iframe 안에서** 실행하려는 경우를 위한 두 번째 삽입 방식도 있습니다. 예를 들어 주변 애플리케이션에서 더 강하게 격리하면서 페이지 일부만 차지하게 할 수 있습니다. 이 모드에서는 직접 호스트를 삽입하며 facade가 이 페이지를 만들지 않습니다.

![수동 iframe 삽입](../diagrams/manual-iframe-embedding.svg)

facade의 `/facade/config` endpoint를 계속 사용해 배포 설정을 얻을 수 있습니다. `iframe_url`(`?waitForCustomConfig`가 추가된 호스트의 `iframe.html` 엔트리)과 `iframe_origin`(PostMessage `targetOrigin`)이 이 경로를 지원합니다. 부모는 자체 client 흐름으로 인증을 얻고 handshake에 응답하기 전에 완전한 `AppConfig`를 조립해야 합니다.

JS 모듈 경로와 달리 iframe 내부 호스트가 구성을 **요청**합니다. 부팅 후 부모에 `get-config` 메시지를 보내고 부모가 `set-config`로 응답합니다. 부모 문서에 `<iframe id="wippy"></iframe>`이 있다면 `load`에서 구성을 무작정 push하지 말고 요청을 수신하십시오.

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
    $schema: `${cfg.facade_url}/schemas/wippy-context-2.0.xsd`,
    auth,
    env: cfg.env,
    routePrefix: cfg.routePrefix,
    themeMode: cfg.themeMode,
    apiRoutes: cfg.apiRoutes,
    axiosDefaults: cfg.axiosDefaults,
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

현재 bearer `token`과 ISO 8601 `expiresAt`을 포함하는 `auth` 객체로 `mountWippyIframe`을 호출합니다. `/facade/config`에서 토큰을 얻지 마십시오. endpoint는 토큰을 반환하지 않습니다. 반환된 `unmount` 함수를 보관했다가 삽입 surface를 제거할 때 호출하여 window listener와 iframe이 소유자보다 오래 남지 않게 합니다.

위 부모 측 검사는 부모가 다른 frame의 메시지를 받지 않도록 보호합니다. Web Host 1.0.56에서 iframe의 inbound `SetConfig` handler는 envelope `type`과 `action`만 확인하며 `event.origin`이나 `event.source`를 인증하지 않습니다. 이후 일치하는 메시지가 구성을 교체할 수 있습니다. iframe에 메시지를 보낼 수 있는 모든 script와 window를 신뢰 구성 경계의 일부로 취급하십시오. iframe DOM 및 스타일 격리가 구성 권한 격리를 의미하지는 않습니다.

`?waitForCustomConfig` query parameter(`iframe_url`에 이미 포함)가 핵심 신호입니다. Web Host에 초기화를 일시 중지하라고 지시합니다. 앱은 마운트되지만 `set-config` 메시지를 받을 때까지 의도적으로 인증 해석이나 경로 로드를 시도하지 않습니다. 이 parameter가 없으면 Web Host가 URL parameter나 기본값에서 인증 토큰을 읽으려 하며 삽입 배포에는 적합하지 않습니다.

handshake는 `@gen2-chat` PostMessage 프로토콜을 사용합니다.

1. 부모가 `GET /facade/config`를 가져오거나 동등한 배포 설정을 제공하고, 완전한 `AppConfig`를 조립한 뒤 `iframe_url`을 가리키는 iframe을 만듭니다.
2. 부팅 중인 iframe이 부모에 `{ type: '@gen2-chat', action: 'get-config' }`를 보냅니다.
3. 부모의 `message` listener가 `iframe_origin`을 대상으로 `{ type: '@gen2-chat', action: 'set-config', ...appConfig }`로 응답합니다.

Web Host는 `AppConfig` payload를 추출하고 전체 초기화를 진행합니다. 전체 메시지 프로토콜(`@gen2-chat` envelope와 `IFrameMessageType` enum)은 [Proxy 및 격리](./proxy-isolation.md)를 참고하십시오. 이 `SetConfig` handshake는 수동 facade 없는 삽입 전용입니다. `wippy/facade` 모듈은 Web Host를 JS 모듈로 불러옵니다.

## Facade 모듈 구성

`_index.yaml`에서 구성 응답을 만드는 `wippy/facade` parameter를 설정합니다. 다음 예제는 `app-template`에서 가져왔습니다.

```yaml
- name: facade
  kind: ns.dependency
  component: wippy/facade
  version: '0.6.37'
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
```

사용 가능한 모든 parameter와 기본값은 [Facade 모듈 참조](../../framework/facade.md)를 참고하십시오.
