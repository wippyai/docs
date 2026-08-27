---
title: "프론트엔드 파사드"
description: "wippy/facade를 사용해 백엔드 애플리케이션에서 Wippy Web Host를 제공하고 구성합니다."
---

# 프론트엔드 파사드

`wippy/facade`를 사용해 백엔드 애플리케이션에서 Wippy Web Host를 제공합니다. 파사드는 프론트엔드 빌드 단계 없이 CDN에서 프론트엔드 번들을 로드하고 애플리케이션이 제공하는 JSON 엔드포인트로 구성합니다. 의존성 매개변수로 브랜딩, 테마, 기능 플래그를 제어합니다.

**분류:** 부분 통합 레시피. 파사드 셸과 구성 엔드포인트를 완전히 설정하고 검증하지만 인증 시스템이나 Web Host가 사용하는 애플리케이션 API를 새로 정의하지는 않습니다.

## 만들 항목

Wippy UI를 제공하는 백엔드 앱을 만듭니다:

1. HTTP 서버와 공개 라우터.
2. 서버 및 라우터에 연결되고 사용자 지정 브랜딩이 적용된 `wippy/facade` 의존성.
3. `/`의 파사드 셸과 `/api/public/facade/config`의 구성.

## 사전 요구 사항

- Wippy 런타임 `v0.3.32a`와 `wippy init` 또는 [Wippy 애플리케이션 템플릿](https://github.com/wippyai/app)으로 만든 프로젝트.
- 브라우저 렌더링을 위해 실제 백엔드 토큰을 얻고 `@wippy_token_info` localStorage 키에 `{"token":"..."}`을 저장하는 동일 출처 로그인 흐름. 파사드는 이 토큰을 발급하거나 검증하지 않습니다.
- 설치된 파사드:

  ```bash
  wippy add wippy/facade@0.6.37
  wippy install
  ```

## 작동 방식

1. 파사드 셸은 HTTP 서버가 `/`에서 렌더링합니다.
2. 로드 시 `GET /api/public/facade/config`를 가져옵니다.
3. `localStorage`에서 `@wippy_token_info`를 읽고, 항목이 없거나 JSON으로 파싱할 수 없을 때만 `login_path`로 리디렉션합니다.
4. CDN(`facade_url + '/module.js'`)에서 Web Host 번들을 임포트하고 구성으로 `initWippyApp(...)`을 호출합니다.

애플리케이션은 셸과 구성을 제공하고 UI 번들은 CDN에서 가져옵니다.

## 의존성

파사드에는 셸을 위한 `http.service`와 구성 엔드포인트를 위한 `http.router`가 필요합니다. 다른 매개변수는 브랜딩과 동작을 사용자 지정합니다.

```yaml
version: "1.0"
namespace: app

entries:
  - name: gateway
    kind: http.service
    addr: ":8087"
    lifecycle:
      auto_start: true

  - name: api.public
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: facade
    kind: ns.dependency
    component: wippy/facade
    parameters:
      - name: server
        value: app:gateway
      - name: router
        value: app:api.public
      - name: app_title
        value: Verify App
```

제공되는 파사드 셸은 `/api/public/facade/config`를 가져오므로 기본 셸이 구성을 찾으려면 공개 라우터의 접두사가 `/api/public`이어야 합니다.

## 실행

```bash
wippy run
```

셸은 서버 루트에서 제공되고 구성 엔드포인트는 런타임 구성을 반환합니다:

```bash
curl http://localhost:8087/api/public/facade/config
```

응답에서 선택한 필드는 다음과 같습니다:

```json
{
  "facade_url": "https://web-host.wippy.ai/webcomponents-1.0.56",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/webcomponents-1.0.56/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "mode": "compat",
  "module_file": "/module.js",
  "env": { "APP_API_URL": "", "APP_AUTH_API_URL": "", "APP_WEBSOCKET_URL": "" },
  "themeMode": "auto",
  "themePersist": "none",
  "themeStorageKey": "@wippy-theme-mode",
  "theming": {
    "host": { "i18n": { "app": { "title": "Verify App", "icon": "wippy:logo", "appName": "Wippy AI" } } }
  },
  "hostConfig": {
    "showAdmin": true, "allowSelectModel": false, "hideNavBar": false,
    "startNavOpen": false, "disableRightPanel": false, "hideSessionSelector": false,
    "renderEngine": "iframe",
    "session": { "type": "non-persistent" }, "history": "hash"
  }
}
```

응답에서 `app_title` 매개변수는 `theming.host.i18n.app.title`로 나타납니다.

루트 문서도 가져옵니다:

```bash
curl http://localhost:8087/
```

구성 엔드포인트를 가져오고 `@wippy_token_info`를 확인하는 HTML 셸이 반환되어야 합니다. 이 두 HTTP 검사는 인증을 우회하지 않고 레시피를 검증합니다.

## 브라우저 인증 및 렌더링

파사드의 localStorage 계약은 출처별로 격리됩니다. 다른 포트나 호스트 이름의 로그인 페이지는 `http://localhost:8087`의 토큰을 채울 수 없습니다. 동일 출처 토큰 교환이 성공하면 로그인 페이지가 실제 토큰을 기록하고 셸로 돌아갑니다:

```js
localStorage.setItem('@wippy_token_info', JSON.stringify({token: result.token}));
window.location.assign('/');
```

셸은 토큰을 읽고 `https://web-host.wippy.ai/webcomponents-1.0.56/module.js`를 임포트한 뒤 Host에 토큰을 전달합니다. 브라우저가 리디렉션 없이 Host를 표시하고 API 요청이 성공적으로 인증될 때 렌더링이 완료된 것입니다. 리디렉션만 막기 위해 자리표시자 토큰을 사용하지 마세요. 셸은 토큰을 검증하지 않으므로 실패 시점이 첫 번째 보호 API 요청으로 이동할 뿐입니다.

## 구성

매개변수는 의존성 `parameters`로 전달합니다. 값은 문자열이며 JSON 값은 JSON으로 인코딩한 문자열입니다. 일반적인 항목은 다음과 같습니다:

| 매개변수 | 용도 |
|---|---|
| `server` / `router` | _(필수)_ HTTP 서버와 공개 라우터 |
| `app_title` / `app_name` / `app_icon` | 브랜딩(아이콘은 Iconify 참조) |
| `show_admin` / `hide_nav_bar` | 기능 플래그(`"true"` / `"false"`) |
| `login_path` | 인증 토큰이 없을 때 셸이 리디렉션할 위치 |
| `session_type` | `non-persistent` 또는 `cookie` |
| `history_mode` | `hash` 또는 `browser` |
| `css_variables` | CSS 사용자 지정 속성의 JSON 문자열. 예: `'{"--p-primary":"#6366f1"}'` |
| `fe_facade_url` | CDN 번들 URL(파사드 릴리스별 고정. 재정의하지 않는 한 기본값 유지) |

두 값은 매개변수가 아니라 `PUBLIC_API_URL` 환경 변수에서 런타임에 파생됩니다. API 기본 URL과 WebSocket URL(`http`→`ws`, `https`→`wss`)입니다. 설정하지 않으면 브라우저는 `window.location.origin`으로 폴백합니다.

## 제한 사항

- 파사드는 인증을 제공하지 않습니다. `localStorage`에 토큰을 기록하는 인증 흐름을 기대하며, 없으면 `login_path`로 리디렉션합니다. `userspace/users` 또는 자체 인증과 함께 사용하세요.
- UI 번들은 CDN(`fe_facade_url`)에서 로드되므로 사용자의 브라우저가 해당 URL에 접근할 수 있어야 합니다.

## 문제 해결

- `/login.html`로 반복 리디렉션되면 현재 출처에 파싱 가능한 `@wippy_token_info` 항목이 없는 것입니다. 동일 출처에서 실제 로그인 흐름을 완료하세요. `token`이 없거나 빈 파싱 가능한 객체는 리디렉션을 막지만 Host가 보호 API에 접근할 때 여전히 실패합니다.
- `/api/public/facade/config`의 HTTP 404는 라우터 접두사가 `/api/public`이 아니거나 `router` 의존성 매개변수가 다른 엔트리를 가리킨다는 뜻입니다.
- 구성 응답 값은 맞지만 셸이 비어 있으면 브라우저가 `facade_url + module_file`을 로드하지 못했을 가능성이 큽니다. 브라우저 네트워크 패널과 CDN 정책을 확인하세요.
- Host 렌더링 후의 인증 API 오류는 파사드 셸이 아니라 애플리케이션 API와 토큰 검증 계층에 속합니다.

## 다음 단계

- [Hello World](hello-world.md) — 최소 프로젝트 레이아웃
- [인증](auth.md) — 셸이 기대하는 로그인 흐름 추가
- [HTTP 엔드포인트](../http/endpoint.md) — 라우터, 정적 파일, 핸들러
