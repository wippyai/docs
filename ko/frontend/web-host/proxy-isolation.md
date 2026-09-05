---
title: "프록시와 격리"
description: "Web Host는 각 자식 마이크로 프런트엔드를 샌드박스 컨텍스트에서 실행하고 Proxy API를 통해 호스트와 연결합니다. 마이크로 프런트엔드 앱과 웹…"
---

# 프록시와 격리

Web Host는 각 자식 마이크로 프런트엔드를 샌드박스 컨텍스트에서 실행하고 **Proxy API**를 통해 호스트와 연결합니다. 마이크로 프런트엔드 앱과 웹 컴포넌트 모두 **`@wippy-fe/proxy`**에서 임포트하여 호스트에 접근합니다.

![Proxy API 주입과 중첩](../diagrams/proxy-layers.svg)

## Proxy API

Proxy API는 호스트로 들어가는 진입점입니다. 런타임인 `proxy.js`가 이를 제공합니다. 이 런타임은 API와 현재 `AppConfig`를 페이지에 올려놓고 **`@wippy-fe/proxy`** 모듈을 통해 노출합니다.

- **마이크로 프런트엔드 앱**(`view.page`)의 경우, 호스트가 페이지의 `srcdoc`에 `proxy.js`를 주입합니다.
- **웹 컴포넌트**(`view.component`)의 경우, 런타임이 이미 호스트 페이지에 존재합니다. 컴포넌트는 별도 iframe이 아니라 호스트 DOM에 마운트됩니다.

코드는 `@wippy-fe/proxy`가 export하는 동기 게터를 통해 이를 사용합니다:

```ts
import { host, api, on, config } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const data = await api.get('/api/v1/agents')   // api는 axios 인스턴스이며, await는 HTTP 호출을 기다립니다
on('@visibility', (visible) => { /* 작업을 일시 중지하거나 재개합니다 */ })
```

이식 가능한 Vue 라우팅이 예외입니다. `@wippy-fe/router`가 `@history`를 소비하고 로컬 내비게이션을 대신 보고합니다. 그 주위에 수동 라우팅 구독을 추가하지 마십시오.

이 게터들은 **동기적**입니다. `host`, `api`, `on`, `config` 등은 코드가 실행되는 순간 이미 준비되어 있습니다. 런타임이 초기화되기 전에 설정이 자리를 잡으므로(아래 참고) 기다려야 할 핸드셰이크가 없습니다. Vite 빌드에서 `@wippy-fe/proxy`를 `external`로 표시하십시오. 호스트가 import map을 통해 이를 제공합니다. 전체 API 표면은 [Proxy API](../micro-frontends/proxy-api.md)를 참고하십시오.

## 설정이 앱 iframe에 도달하는 방식

호스트가 `view.page`를 로드할 때 `srcdoc`을 구성하고 **앱 스크립트보다 앞에, 다음 순서로** 주입합니다:

```html
<!-- 1. 자식 AppConfig — 런타임이 로드되기 전에 동기적으로 설정됨 -->
<script>window.__WIPPY_APP_CONFIG__ = { /* auth, env, theming, hostConfig, context */ }</script>
<!-- 2. 이 페이지의 CSS 주입 플래그 -->
<script>window.__WIPPY_PROXY_CONFIG__ = { injections: { css: { themeConfig: true, primevue: true /* … */ } } }</script>
<!-- 3. 런타임 (앞에 loading.js가 옴) -->
<script src="/.../loading.js"></script>
<script src="/.../proxy.js"></script>
```

설정 전역 변수가 `proxy.js` 실행 **전에** 설정되므로, 런타임은 동기적으로 초기화되고 `@wippy-fe/proxy` 게터가 즉시 동작합니다. 핸드셰이크가 없습니다. 페이지가 이 스크립트들을 직접 참조하지는 않습니다. `<script data-role="@wippy/scripts">` 자리 표시자가 호스트에 의해 올바른 순서의 태그로 교체됩니다. 페이지 단위 오버라이드는 `window.__WIPPY_CONFIG_OVERRIDES__`로 전달됩니다([Proxy API — 설정 오버라이드](../micro-frontends/proxy-api.md#config-overrides) 참고).

웹 컴포넌트도 동일한 전역 변수를 봅니다. 호스트 페이지에서 실행되며, 그곳에서 런타임이 컴포넌트의 `connectedCallback`이 호출되기 전에 이미 이들을 설정했기 때문입니다.

## 앱과 웹 컴포넌트의 차이

둘 다 `@wippy-fe/proxy`에서 같은 API를 임포트합니다. 차이는 실행 컨텍스트와 스타일 전달 방식에 있습니다:

| | 마이크로 프런트엔드 앱 (`view.page`) | 웹 컴포넌트 (`view.component`) |
|---|---|---|
| 실행 위치 | 자체 `srcdoc` iframe | 호스트 페이지 DOM (Shadow DOM) |
| 런타임 전달 | iframe에 `proxy.js` 주입 | 런타임이 이미 호스트 페이지에 존재 |
| CSS | 전체 주입 파이프라인(`themeConfig`, `primevue`, …) — [CSS 주입](./css-injection.md) 참고 | Shadow DOM으로 전달되는 `hostCssKeys` — [테마: 웹 컴포넌트](../micro-frontends/web-component-theming.md) 참고 |

## 합성과 중첩

자식은 합성됩니다. 마이크로 프런트엔드 앱이나 웹 컴포넌트는 자신도 자식(다시 마이크로 프런트엔드 앱이나 웹 컴포넌트)을 호스팅할 수 있고, 그 자식도 자신의 자식을 임의의 깊이까지 호스팅할 수 있습니다. 모든 계층이 동일한 `@wippy-fe/proxy` API를 사용합니다.

노드가 자식을 호스팅하는 방식은 자식의 종류에 달려 있습니다:

- **iframe 자식**(마이크로 프런트엔드 앱, 아티팩트, 임의의 Wippy HTML)은 `<w-iframe>`, `<w-artifact>`, `html.inject`를 거칩니다. 이들은 자식의 `srcdoc`에 런타임(base URL, import map, `loading.js`, `proxy.js`, 설정)을 주입하므로, 자식은 최상위 앱과 똑같이 Proxy API를 얻습니다. 자식의 프록시는 부모를 거쳐 호스트로 연결됩니다.
- **웹 컴포넌트 자식**에는 그런 것이 필요 없습니다. 태그를 렌더링하거나 `loadWebComponent` / `loadByTagName`으로 로드하면, 같은 DOM에서 실행되며 Proxy API를 직접 임포트합니다.

자식 자신의 코드는 최상위에서 실행되든 여러 단계 중첩되어 실행되든 동일합니다. `@wippy-fe/proxy`에서 임포트해서 사용하면 됩니다. 특별한 중첩 규칙은 없습니다.

동작 방식은 아래의 [`<w-iframe>`](#w-iframe-custom-element), [`<w-artifact>`](#w-artifact-custom-element), [고급 HTML 주입](#advanced-html-injection)을 참고하십시오.

## 내부 구현 — 읽거나 오버라이드하지 말 것

`proxy.js`는 자체 용도로 다음 전역 변수를 설치합니다. **애플리케이션과 컴포넌트 코드는 이들을 절대 읽거나 대입해서는 안 됩니다.** 대신 `@wippy-fe/proxy`를 사용하십시오. 실수로 덮어쓰지 않도록 문서화할 뿐입니다:

| 전역 변수 | 설명 |
|---|---|
| `window.$W` | 비동기 접근자 객체(`$W.host()`, `$W.api()`, …). 내부용이며 지원되는 표면은 `@wippy-fe/proxy`입니다. |
| `window.getWippyApi` / `window.initWippyApi` | 비동기 "인스턴스 해석" 함수. 내부용입니다(`initWippyApi`는 사용이 권장되지 않습니다). |
| `window.__WIPPY_APP_API__` | 해석된 프록시 인스턴스. |
| `window.__WIPPY_APP_CONFIG__` | 자식 `AppConfig` 스냅샷. |
| `window.__WIPPY_PROXY_CONFIG__` / `window.__WIPPY_CONFIG_OVERRIDES__` | CSS 주입 플래그와 페이지 단위 오버라이드. |
| `window.__WIPPY_WEB_COMPONENT_CACHE__` | 로드된 컴포넌트 캐시. |

공개 JavaScript API는 두 개의 엔트리 포인트로 구성됩니다. `initWippyApp(config, rootContainer?)`는 Web Host 전체를 마운트하며(파사드가 사용하는 모듈 임베드 엔트리. [파사드 엔트리 포인트](./entry-point.md) 참고), **`@wippy-fe/proxy`**는 자식 앱과 컴포넌트를 위한 동기 API입니다. 위 표의 모든 항목은 내부용입니다.

## PostMessage 프로토콜 (`IFrameMessageType`) — 내부 전송

이는 런타임이 내부적으로 사용하는 와이어 프로토콜입니다. **애플리케이션 코드는 이 메시지를 절대 보내거나 받지 않습니다.** `@wippy-fe/proxy`가 대신 처리합니다.

호스트가 주입하는 표준 경로에서는 시작을 위한 핸드셰이크가 필요 없습니다. `proxy.js`가 실행되기 전에 설정이 이미 `window.__WIPPY_APP_CONFIG__`로 동기적으로 존재하므로, 런타임이 즉시 인스턴스를 구성합니다. 이 경로에서도 `get-config`/`set-config` 교환은 일어나지만, 오직 **논블로킹 재동기화 및 라이브 업데이트 채널**로서만 일어납니다. 동기 인스턴스가 구성된 뒤 iframe 런타임은 항상 `get-config`를 보내고, 호스트는 `set-config`로 응답하며, 이후 설정이 갱신될 때마다 `set-config`를 다시 보냅니다. 중첩된 `<w-iframe>` 자식도 동일하게 동작합니다. 코드는 이 중 어떤 것도 기다리지 않습니다. 동기 게터는 이미 활성 상태입니다.

핸드셰이크가 **유일한 블로킹 설정 소스**인 경우는 정확히 하나뿐입니다. 파사드를 쓰지 않는 수동 iframe 임베딩(`iframe.html?waitForCustomConfig`)에서는 미리 주입된 `window.__WIPPY_APP_CONFIG__`가 없으므로 초기화가 첫 `set-config`에서 블로킹되고, 부모가 `get-config` 요청에 응답해야 합니다([파사드 엔트리 포인트 § 수동 iframe 임베딩](./entry-point.md#manual-facade-less-iframe-embedding) 참고).

모든 메시지는 `{ type: '@gen2-chat', action: IFrameMessageType.*, ...payload }` 형태의 JSON 봉투입니다. `type` 필드는 `APP_CONFIG_IFRAME_EVENT_TYPE`으로 설정할 수 있으며 기본값은 `'@gen2-chat'`입니다.

모든 메시지 타입은 `IFrameMessageType` enum에 정의되어 있습니다:

| Enum 멤버 | 와이어 값 | 방향 | 설명 |
|-------------|------------|-----------|-------------|
| `GetConfig` | `get-config` | 자식 → 호스트 | 초기 핸드셰이크: 자식이 자신의 `AppConfig`를 요청 |
| `SetConfig` | `set-config` | 호스트 → 자식 | 호스트가 `GetConfig`에 대한 응답으로 `AppConfig`를 전달 |
| `UrlWasUpdatedInParent` | `url-was-updated-in-parent` | 호스트 → 자식 | 호스트 URL 변경. 자식의 `@history` 이벤트를 발생시킴 |
| `VisibilityWasUpdatedInParent` | `visibility-was-updated-in-parent` | 호스트 → 자식 | iframe 가시성 변경. 자식의 `@visibility` 이벤트를 발생시킴 |
| `TopicWasReceivedInParent` | `topic-was-received-in-parent` | 호스트 → 자식 | 구독 중인 자식에게 WebSocket 토픽 이벤트를 전달 |
| `CmdRouteChanged` | `cmd-route-changed` | 자식 → 호스트 | 자식의 내부 라우트 변경. 호스트가 브라우저 URL을 갱신 |
| `CmdTitleChanged` | `cmd-title-changed` | 자식 → 호스트 | 자식의 `document.title` 변경. 호스트가 페이지 타이틀을 갱신 |
| `CmdStartChat` | `cmd-start-chat` | 자식 → 호스트 | 새 채팅 세션 열기 |
| `CmdOpenSession` | `cmd-open-session` | 자식 → 호스트 | 기존 채팅 세션으로 이동 |
| `CmdOpenArtifact` | `cmd-open-artifact` | 자식 → 호스트 | 사이드바나 모달에서 아티팩트 열기 |
| `CmdNavigate` | `cmd-navigate` | 자식 → 호스트 | SPA 내비게이션 요청 |
| `CmdShowToast` | `cmd-show-toast` | 자식 → 호스트 | 토스트 알림 표시 |
| `CmdShowConfirm` | `cmd-show-confirm` | 자식 → 호스트 | 확인 다이얼로그 표시 |
| `OnConfirmResult` | `on-confirm-result` | 호스트 → 자식 | 확인 다이얼로그 결과 전달 |
| `CmdSetContext` | `cmd-set-context` | 자식 → 호스트 | 채팅 세션으로 컨텍스트 전송 |
| `CmdHandleError` | `cmd-handle-error` | 자식 → 호스트 | 호스트에 오류 보고 |
| `CmdLogout` | `cmd-logout` | 자식 → 호스트 | 로그아웃 트리거 |
| `CmdSubscribe` | `cmd-subscribe` | 자식 → 호스트 | WebSocket 토픽 구독 |
| `CmdUnSubscribe` | `cmd-unsubscribe` | 자식 → 호스트 | 토픽 구독 해제 |
| `OnSubscription` | `on-subscription` | 호스트 → 자식 | 구독 이벤트 데이터 전달 |
| `CmdStateGet` | `cmd-state-get` | 자식 → 호스트 | 영속 상태 키 읽기 |
| `CmdStateSet` | `cmd-state-set` | 자식 → 호스트 | 영속 상태 키 쓰기 |
| `CmdStateRemove` | `cmd-state-remove` | 자식 → 호스트 | 영속 상태 키 삭제 |
| `CmdStateClear` | `cmd-state-clear` | 자식 → 호스트 | 이 페이지의 모든 상태 삭제 |
| `CmdStateGetAll` | `cmd-state-get-all` | 자식 → 호스트 | 모든 영속 상태 읽기 |
| `OnStateResult` | `on-state-result` | 호스트 → 자식 | 상태 읽기 결과 전달 |
| `OnStateError` | `on-state-error` | 호스트 → 자식 | 상태 연산 실패 보고 |
| `CmdWsSend` | `cmd-ws-send` | 자식 → 호스트 | 호스트 연결을 통해 WebSocket 명령 전달 |
| `CmdBodySize` | `cmd-body-size` | 자식 → 호스트 | `auto-height`를 위한 body 크기 보고 |
| `CmdBridgePost` | `cmd-bridge-post` | 자식 ↔ 부모 | `host.bridge`를 통한 단방향 채널 메시지 |
| `CmdBridgeRequest` | `cmd-bridge-request` | 자식 ↔ 부모 | `host.bridge`를 통한 요청/응답 채널 메시지 |
| `CmdClaimNavOwner` | `cmd-claim-nav-owner` | 자식 → 호스트 | 내비게이션 소유권 획득 (nav-owner 모드) |
| `CmdReleaseNavOwner` | `cmd-release-nav-owner` | 자식 → 호스트 | 내비게이션 소유권 해제 |
| `CmdLayoutSubscribe` | `cmd-layout-subscribe` | 자식 → 호스트 | managed 레이아웃 업데이트 구독 |
| `CmdLayoutUpdatePanel` | `cmd-layout-update-panel` | 자식 → 호스트 | 패널 정의 패치 |
| `CmdLayoutBroadcast` | `cmd-layout-broadcast` | 자식 ↔ 호스트 | 탭 내부 레이아웃 버스 메시지 |
| `OnLayoutChange` | `on-layout-change` | 호스트 → 자식 | 전체 레이아웃 스냅샷 업데이트 |
| `OnLayoutPanelChanged` | `on-layout-panel-changed` | 호스트 → 자식 | 패널 단위 실시간 상태 델타 |
| `OnLayoutBroadcast` | `on-layout-broadcast` | 호스트 → 자식 | 레이아웃 버스 브로드캐스트 전달 |

애플리케이션 코드는 이 메시지들을 직접 보내거나 받지 않습니다. 프록시가 프로토콜을 투명하게 처리하고 `@wippy-fe/proxy` API 표면만 노출합니다.

## `<w-iframe>` 커스텀 엘리먼트

`<w-iframe>`은 `proxy.js`에 내장된 저수준 iframe 프리미티브입니다. 원시 소스 HTML을 받아 전체 Wippy 런타임(base URL, import map, `loading.js`, `proxy.js`, 자식 설정)을 주입하고, 결과를 샌드박스된 `srcdoc` iframe으로 렌더링합니다.

소스 HTML이 있고 Wippy 마이크로 프런트엔드 앱이 자동으로 얻는 것과 동일한 런타임 동작(인증된 API, 상태 릴레이, WebSocket 릴레이, nav-owner 라우팅, 부모-자식 브리지 메시징)을 원할 때 `<w-iframe>`을 사용하십시오.

### 속성과 프로퍼티

| 속성 / 프로퍼티 | 필수 | 기본값 | 설명 |
|----------------------|----------|---------|-------------|
| `src` | 아니오 | — | 프록시 `api`를 통해 원시 소스 HTML로 가져올 URL. |
| `srcdoc` | 아니오 | — | 원시 소스 HTML. 큰 문자열의 경우 `element.srcdoc = html`로도 설정할 수 있습니다. |
| `base-url` | 아니오 | `src` 또는 `document.baseURI`에서 파생 | 상대 에셋 해석을 위해 주입되는 `<base href>`. |
| `resource-id` | 아니오 | 엘리먼트 `id`, 그다음 `src` | 자식 컨텍스트 식별자. 기본 상태와 로그 스코프를 설정합니다. |
| `resource-type` | 아니오 | `page` | 자식 컨텍스트 타입: `page` 또는 `artifact`. |
| `sub-path` | 아니오 | 부모 라우트 | 자식의 초기 라우트. `GetConfig` 핸드셰이크에서 `config.context.route`로 전달됩니다. |
| `auto-height` | 아니오 | `false` | 자식의 `CmdBodySize` 보고에 맞춰 iframe 높이를 조정합니다. |
| `nav-owner` | 아니오 | `false` | 자식의 `CmdRouteChanged`를 가로채 호스트 URL을 바꾸는 대신 `nav-owner-route` DOM 이벤트를 발생시킵니다. |

엘리먼트에서 받는 JS 프로퍼티:

```typescript
const frame = document.querySelector('w-iframe')
frame.proxyConfig = { injections: { css: { markdown: false } } }
frame.configOverrides = { customization: { customCSS: ':root { --brand: red }' } }
frame.srcdoc = sourceHtml
```

### 이벤트와 메서드

| 이벤트 | detail | 설명 |
|-------|--------|-------------|
| `loading` | — | fetch/처리/렌더링이 시작되기 전에 발생합니다. |
| `load` | — | 샌드박스 iframe이 로드된 후 발생합니다. |
| `error` | 원본 오류 | fetch, 주입, 로드가 실패하면 발생합니다. |
| `nav-owner-route` | `{ path: string, navId?: number }` | `nav-owner`가 설정된 경우의 자식 라우트 변경. 이벤트는 버블링되며 `composed`입니다. |
| `wippy-message` | `{ channel, payload, requestId?, respond?, reject? }` | 자식이 보낸 브리지 메시지. |

| 메서드 | 설명 |
|--------|-------------|
| `post(channel, payload?)` | 자식에게 보내는 단방향 브리지 메시지. |
| `request<T>(channel, payload?, { timeoutMs }?)` | 요청/응답 브리지 메시지. 핸들러의 반환값으로 resolve됩니다. |

Shadow part: `loader`, `error`, `frame`.

`nav-owner`가 설정되면 기본 라우트 동기화 왕복이 완전히 억제됩니다. 호스트는 자신의 URL 표시줄을 갱신하지 **않으며** `UrlWasUpdatedInParent`를 자식에게 되돌려 보내지도 **않습니다**. 내비게이션 소유권은 `nav-owner-route`를 수신하는 부모 코드에 전적으로 위임됩니다. 이벤트 detail의 `path`는 자식이 `host.onRouteChanged(internalRoute, navId?)`에 전달한 그대로의 **원시 내부 라우트**이며, 마운트 접두사가 붙어 있지 **않습니다**(호스트가 페이지의 마운트 접두사를 앞에 붙이는 기본 `CmdRouteChanged` 경로와 다릅니다). 접두사 처리나 라우터 매핑은 임베딩하는 부모의 책임입니다:

```typescript
const frame = document.querySelector('w-iframe')
frame.addEventListener('nav-owner-route', (event) => {
  const { path, navId } = event.detail
  myRouter.push(path)
})
```

### 부모-자식 브리지

브리지는 이름 있는 채널을 사용하므로 어느 쪽도 원시 `postMessage` 봉투를 다룰 필요가 없습니다.

부모 측:
```typescript
const frame = document.querySelector('w-iframe')

frame.addEventListener('wippy-message', async (event) => {
  const { channel, payload, respond, reject } = event.detail

  if (channel === 'pick-file') {
    try {
      respond({ id: 'file-1', name: 'data.csv' })
    } catch (error) {
      reject(error)
    }
  }
})

frame.post('refresh', { reason: 'parent-click' })
const result = await frame.request('get-selection', undefined, { timeoutMs: 5000 })
```

자식 측:
```typescript
import { host } from '@wippy-fe/proxy'

host.bridge.post('ready', { value: 1 })
const file = await host.bridge.request('pick-file', { accept: '.csv' })

const off = host.bridge.on('refresh', async (payload) => {
  console.log('refresh requested', payload)
  return { ok: true }
})
```

`host.bridge.on()`은 구독 해제 함수(`() => void`)를 반환합니다. **채널 하나당 활성 핸들러 하나입니다.** 같은 채널에 여러 핸들러가 등록되면 가장 최근에 등록된 핸들러가 우선하여 그 채널의 **모든** 수신 메시지를 처리합니다. 단방향 `post()`와 `request()` 둘 다 해당됩니다. `on()`은 누적되지 않습니다. 이전 핸들러는 가려질 뿐(제거되지 않음) 더 새로운 핸들러가 있는 동안에는 실행되지 않으며, 프록시는 중복 등록 시 `console.warn`을 기록합니다. 가장 최근 핸들러가 구독을 해제하면 그 채널의 이전 핸들러가 다시 활성화됩니다. 독립적인 리스너가 여러 개 필요하다면 서로 다른 채널 이름을 사용하십시오.

`options.timeoutMs`를 생략하면 `host.bridge.request()`(및 부모 측 `frame.request()`)는 기본적으로 10초(`10000` ms) 마감을 사용합니다. 타임아웃 시 반환된 Promise는 `Bridge request <id> timed out after <ms>ms` 메시지를 갖는 `Error`로 reject됩니다. 상대 측에 핸들러가 없는 채널로 보낸 요청은 마감을 기다리지 않고 즉시 `No handler registered for channel "<channel>"`로 reject됩니다.

## `<w-artifact>` 커스텀 엘리먼트

`<w-artifact>`는 아티팩트나 페이지의 메타데이터와 콘텐츠를 해석한 다음, iframe 기반 타입을 내부적으로 `<w-iframe>`에 위임합니다. 콘텐츠 타입 검출(HTML, Markdown, 웹 페이지 패키지, ESM 패키지, 직접 태그 컴포넌트)을 처리하며 원시 `<w-iframe>`보다 상위 수준의 API를 제공합니다.

### 속성

| 속성 | 필수 | 값 | 기본값 | 설명 |
|-----------|----------|--------|---------|-------------|
| `id` | 예 | 아티팩트 / 페이지 UUID | — | 콘텐츠 식별자. |
| `type` | 아니오 | `artifact` \| `page` | `artifact` | 호출할 REST 엔드포인트를 결정합니다: `/api/v1/artifact/<id>/content` 또는 `/api/public/pages/content/<id>`. |
| `auto-height` | 아니오 | boolean 플래그 | `false` | `CmdBodySize` 높이 동기화를 위해 내부 `<w-iframe>`으로 전달됩니다. |
| `url` | 아니오 | 임의의 URL | — | 이 URL에서 콘텐츠를 직접 가져옵니다. `id`/`type`은 무시됩니다. |
| `sub-path` | 아니오 | 경로 문자열 | — | 자식의 초기 라우트로 내부 `<w-iframe>`에 전달됩니다. |
| `nav-owner` | 아니오 | boolean 플래그 | `false` | 내부 `<w-iframe>`으로 전달됩니다. 자식 라우트 변경 시 `nav-owner-route`를 발생시킵니다. |

### 이벤트

| 이벤트 | 시점 | detail |
|-------|------|--------|
| `loading` | fetch 시작 전 | — |
| `load` | iframe 로드 후 | — |
| `error` | fetch 또는 렌더링 실패 | 원본 오류 |
| `nav-owner-route` | nav-owner 자식의 라우트 변경 시 | `{ path: string, navId?: number }` |
| `wippy-message` | 중첩 iframe이 보낸 브리지 메시지 | `{ channel, payload, requestId?, respond?, reject? }` |

### CSS status와 part

엘리먼트는 `status` 속성(`loading`, `ready`, `error`)을 설정하고 shadow part를 노출합니다:

```css
w-artifact[status="loading"] { opacity: 0.5; }
w-artifact[status="error"]   { border: 1px solid var(--p-danger-color); }

w-artifact::part(loader) { font-size: 1rem; }
w-artifact::part(frame)  { border: 0; }
```

## `<w-iframe>`, `<w-artifact>`, 원시 `<iframe>` 비교

| 기능 | `<w-iframe>` | `<w-artifact>` | 원시 `<iframe>` |
|---------|-------------|----------------|----------------|
| Wippy 런타임 주입 | 예 | 예 (`<w-iframe>`을 통해) | 아니오 |
| 아티팩트/페이지 메타데이터 해석 | 아니오 | 예 | 아니오 |
| 인증된 콘텐츠 fetch | 예 (원시 HTML) | 예 (전체 리졸버) | 아니오 |
| 상태 릴레이 | 예 | 예 | 아니오 |
| WebSocket 릴레이 | 예 | 예 | 아니오 |
| 부모-자식 브리지 | 예 | 예 (전달됨) | 아니오 |
| nav-owner 지원 | 예 | 예 | 아니오 |
| 콘텐츠 타입 검출 | 아니오 | 예 | 아니오 |
| CSS shadow part | `loader`, `error`, `frame` | `loader`, `error`, `frame` | — |
| `status` 속성 | 예 | 예 | 아니오 |

Wippy 아티팩트 UUID나 페이지 ID가 있고 플랫폼이 모든 해석을 처리하기를 원한다면 `<w-artifact>`를 사용하십시오. 이미 소스 HTML이 있고 런타임을 직접 주입하고 싶다면 `<w-iframe>`을 사용하십시오. 원시 `<iframe>`은 Wippy API가 필요 없는 완전한 외부 콘텐츠에만 사용하십시오.

## 고급 HTML 주입

엘리먼트를 마운트하지 않고 소스 HTML을 srcdoc으로 변환하는 처리만 필요한 경우, 프록시는 `html.inject(...)`를 노출합니다:

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

같은 함수를 `instance.html.inject`, `$W.html`, `import { html } from '@wippy-fe/proxy'`로도 사용할 수 있습니다. 일반적인 마운트에는 `<w-iframe>`을 사용하고, 커스텀 호스팅 인프라를 구축할 때만 `html.inject(...)`를 사용하십시오.
