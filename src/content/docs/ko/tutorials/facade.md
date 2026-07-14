---
title: "프론트엔드 파사드"
---

# 프론트엔드 파사드

`wippy/facade`로 백엔드 전용 앱에서 Wippy 웹 UI를 서빙합니다. 파사드는 얇은 정적 셸입니다: CDN에서 Wippy Web Host 프론트엔드 번들을 로드하고, 앱이 서빙하는 JSON 엔드포인트에서 구성합니다 — 프로젝트에 프론트엔드 빌드 단계가 없습니다. 브랜딩, 테마, 기능 플래그는 모두 의존성 매개변수로 구동됩니다.

## 무엇을 구축할 것인가

Wippy UI를 서빙하는 백엔드 앱:

1. HTTP 서버와 공개 라우터.
2. 해당 서버 및 라우터에 연결되고 사용자 정의 브랜딩을 갖춘 `wippy/facade` 의존성.
3. `/`에서 실행되는 셸과 `/api/public/facade/config`의 구성.

## 전제 조건

- Wippy 프로젝트 ([app-template](https://github.com/wippyai/app-template) 클론, 또는 `wippy init`).
- 설치된 파사드:

  ```bash
  wippy add wippy/facade
  wippy install
  ```

## 작동 방식

1. `index.html`이 HTTP 서버에서 정적 파일로 서빙됩니다.
2. 로드 시 `GET /api/public/facade/config`를 가져옵니다.
3. `localStorage`에서 인증 토큰을 확인하고, 없으면 `login_path`로 리디렉션합니다.
4. CDN (`facade_url + '/module.js'`) 에서 Web Host 번들을 임포트하고 구성과 함께 `initWippyApp(...)`을 호출합니다.

앱은 셸과 구성만 제공합니다; UI 자체는 CDN에서 옵니다.

## 의존성

파사드는 앱에서 두 가지를 필요로 합니다: 파일을 서빙할 `http.service`와 구성 엔드포인트가 마운트되는 `http.router`. 그 외 모든 것은 합리적인 기본값을 갖춘 선택적 브랜딩입니다.

```yaml
version: "1.0"
namespace: app

entries:
  - name: gateway
    kind: http.service
    addr: :8087
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

제공되는 `index.html`은 `/api/public/facade/config`를 가져오므로, 기본 셸이 구성을 찾으려면 공개 라우터의 접두사가 `/api/public`이어야 합니다.

## 실행하기

```bash
wippy run
```

셸은 서버 루트에서 서빙되고, 구성 엔드포인트는 런타임 구성을 반환합니다:

```bash
curl http://localhost:8087/api/public/facade/config
```

```json
{
  "mode": "compat",
  "facade_url": "https://web-host.wippy.ai/webcomponents-1.0.32",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/webcomponents-1.0.32/iframe.html?waitForCustomConfig",
  "module_file": "/module.js",
  "login_path": "/login.html",
  "env": { "APP_API_URL": "", "APP_AUTH_API_URL": "", "APP_WEBSOCKET_URL": "" },
  "theming": {
    "host": { "i18n": { "app": { "title": "Verify App", "icon": "wippy:logo", "appName": "Wippy AI" } } }
  },
  "hostConfig": {
    "showAdmin": true, "allowSelectModel": false, "hideNavBar": false,
    "session": { "type": "non-persistent" }, "history": "hash"
  }
}
```

`app_title` 매개변수가 `theming.host.i18n.app.title`로 어떻게 나타나는지 주목하세요.

## 구성

매개변수는 의존성 `parameters`로 전달됩니다 (값은 문자열이며; JSON 값은 JSON으로 인코딩된 문자열입니다). 일반적인 항목:

| 매개변수 | 용도 |
|---|---|
| `server` / `router` | _(필수)_ HTTP 서버와 공개 라우터 |
| `app_title` / `app_name` / `app_icon` | 브랜딩 (아이콘은 Iconify 참조) |
| `show_admin` / `hide_nav_bar` | 기능 플래그 (`"true"` / `"false"`) |
| `login_path` | 인증 토큰이 없을 때 셸이 리디렉션하는 위치 |
| `session_type` | `non-persistent` 또는 `cookie` |
| `history_mode` | `hash` 또는 `browser` |
| `css_variables` | CSS 사용자 정의 속성의 JSON 문자열, 예: `'{"--p-primary":"#6366f1"}'` |
| `fe_facade_url` | CDN 번들 URL (파사드 릴리스마다 고정됨; 재정의하지 않는 한 기본값 유지) |

두 값은 매개변수가 아니라 `PUBLIC_API_URL` 환경 변수에서 런타임에 파생됩니다: API 기본 URL과 WebSocket URL (`http`→`ws`, `https`→`wss`). 설정되지 않으면 브라우저는 `window.location.origin`으로 폴백합니다.

## 참고 사항

- 파사드는 인증을 제공하지 않습니다. `localStorage`에 토큰을 쓰는 인증 흐름을 기대합니다; 그것이 없으면 `login_path`로 리디렉션합니다. `userspace/users` 또는 자체 인증과 함께 사용하세요.
- UI 번들은 CDN (`fe_facade_url`) 에서 로드되므로, 실행 중인 앱이 렌더링하려면 아웃바운드 네트워크 액세스가 필요합니다.

## 다음 단계

- [Hello World](tutorials/hello-world.md) — 최소한의 프로젝트 레이아웃
- [인증](tutorials/auth.md) — 셸이 기대하는 로그인 흐름 연결
- [HTTP 엔드포인트](http/endpoint.md) — 라우터, 정적 파일, 핸들러
