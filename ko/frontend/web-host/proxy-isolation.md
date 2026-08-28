---
title: "Proxy 및 격리"
description: "페이지 애플리케이션과 웹 컴포넌트가 Proxy API를 통해 구성을 받고 Web Host와 통신하는 방식입니다."
---

# Proxy 및 격리

이 페이지는 API와 내부 전송 참조입니다. 스니펫은 이미 호스팅된 페이지나 컴포넌트를 전제로 하는 부분 통합이며 완전한 애플리케이션은 아닙니다.

Web Host는 **Proxy API**를 통해 페이지 애플리케이션 및 웹 컴포넌트를 호스트 서비스에 연결합니다. 패키지 페이지는 `hostConfig.renderEngine`에 따라 sandboxed `srcdoc` iframe 또는 Web Fragment realm에서 실행됩니다. 웹 컴포넌트는 호스트 페이지 DOM에서 실행됩니다. 세 컨텍스트 모두 **`@wippy-fe/proxy`**에서 API를 import합니다.

![Proxy API 주입과 중첩](../diagrams/proxy-layers.svg)

## Proxy API

Proxy API는 호스트 진입점입니다. 엔진별 런타임이 API와 현재 자식 구성을 페이지 컨텍스트에 배치하고 **`@wippy-fe/proxy`**를 통해 노출합니다.

- **iframe 엔진**을 사용하는 `view.page`에서 호스트가 페이지 `srcdoc`에 `proxy.js`를 주입합니다.
- **Web Fragment 엔진**을 사용하는 `view.page`에서 Fragment gateway가 reframed realm에 `proxy-fragment.js`를 불러옵니다.
- **웹 컴포넌트**(`view.component`)에서는 런타임이 호스트 페이지에 이미 있습니다. 컴포넌트는 별도 iframe이 아니라 호스트 DOM에 마운트됩니다.

코드는 `@wippy-fe/proxy`가 export하는 sync getter로 소비합니다.

```ts
import { host, api, on, config } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const data = await api.get('/api/v1/agents')   // api is an axios instance; the await is the HTTP call
on('@visibility', (visible) => { /* pause or resume work */ })
```

이식 가능한 Vue 라우팅은 예외입니다. `@wippy-fe/router`가 `@history`를 소비하고 로컬 탐색을 보고하므로 그 주위에 수동 라우팅 subscription을 추가하지 마십시오.

애플리케이션 코드가 실행된 뒤 이 getter들은 **동기식**입니다. `host`, `api`, `on`, `config` 등에는 애플리케이션 관리 handshake가 필요 없습니다. iframe 엔진은 미리 주입된 구성으로 시작하고 Fragment 런타임은 API를 만들기 전에 호스트와 구성을 해석합니다. Vite 빌드에서 `@wippy-fe/proxy`를 `external`로 표시하십시오. 호스트가 import map으로 제공합니다. 전체 surface는 [Proxy API](../micro-frontends/proxy-api.md)를 참고하십시오.

## 구성이 페이지 애플리케이션에 도달하는 방식

### Iframe 엔진

호스트가 `view.page`를 불러오면 `srcdoc`을 만들고 **앱 script보다 앞에 다음 순서로** 주입합니다.

```html
<!-- 1. The child AppConfig — set synchronously, before the runtime loads -->
<script>window.__WIPPY_APP_CONFIG__ = { /* auth, env, theming, context */ }</script>
<!-- 2. The CSS-injection flags for this page -->
<script>window.__WIPPY_PROXY_CONFIG__ = { injections: { css: { themeConfig: true, primevue: true /* … */ } } }</script>
<!-- 3. The runtime (preceded by loading.js) -->
<script src="/.../loading.js"></script>
<script src="/.../proxy.js"></script>
```

구성 global은 `proxy.js` 실행 **전**에 설정되므로 런타임이 동기식으로 초기화되고 `@wippy-fe/proxy` getter를 즉시 사용할 수 있습니다. handshake가 없습니다. 페이지는 이 script를 직접 참조하지 않습니다. `<script data-role="@wippy/scripts">` placeholder를 호스트가 올바른 순서의 tag로 교체합니다. 페이지별 override는 `window.__WIPPY_CONFIG_OVERRIDES__`로 도착합니다([Proxy API — 구성 override](../micro-frontends/proxy-api.md#설정-재정의) 참고).

### Web Fragment 엔진

Fragment gateway는 Web Host import map, `loading.js`, `proxy-fragment.js`가 있는 reframed realm stub을 제공합니다. 서버는 client가 가진 인증 토큰을 주입할 수 없으므로 Fragment 런타임은 same-origin host channel의 `GetConfig`/`SetConfig` handshake로 자식 구성을 얻습니다. 이후 `@wippy-fe/proxy`가 사용하는 동일한 인증 API와 구성 global을 만듭니다.

웹 컴포넌트는 별도 page realm이 아니라 호스트 페이지에서 실행되므로 해당 페이지의 기존 API와 구성 global을 봅니다.

## 앱과 웹 컴포넌트의 차이

둘 다 `@wippy-fe/proxy`에서 같은 API를 import합니다. 실행 컨텍스트와 스타일 전달 방식이 다릅니다.

| | 페이지: iframe 엔진 | 페이지: Web Fragment 엔진 | 웹 컴포넌트 |
|---|---|---|---|
| 실행 위치 | sandboxed `srcdoc` iframe | shadow root에 반영되는 reframed same-origin realm | 호스트 페이지 DOM(Shadow DOM) |
| 런타임 전달 | `srcdoc`에 `proxy.js` 주입 | Fragment gateway가 `proxy-fragment.js` 로드 | 호스트 페이지에 런타임 존재 |
| 구성 전달 | sync global 후 non-blocking handshake 업데이트 | Fragment 런타임 소유 blocking host handshake | 호스트 페이지 global |
| CSS | client 주입 pipeline — [CSS 주입](./css-injection.md) | gateway 및 Fragment realm 주입 — [CSS 주입](./css-injection.md) | Shadow DOM에 `hostCssKeys` — [테마: 웹 컴포넌트](../micro-frontends/web-component-theming.md) |

## 구성과 중첩

자식은 서로 구성될 수 있습니다. 마이크로 프런트엔드 앱이나 웹 컴포넌트가 다시 앱 또는 컴포넌트를 호스팅할 수 있고 깊이에 제한이 없습니다. 모든 수준이 같은 `@wippy-fe/proxy` API를 사용합니다.

node가 자식을 호스팅하는 방식은 자식 kind에 따라 다릅니다.

- **페이지 또는 HTML 자식**은 `<w-iframe>`, `<w-artifact>`, `html.inject`를 사용합니다. iframe 모드에서는 base URL, import map, 런타임, 구성을 가진 `srcdoc`을 만듭니다. Fragment 모드에서는 중첩된 등록 `view.page`가 Web Fragment로 렌더링되고 inline HTML 및 다른 비-page 콘텐츠는 계속 `srcdoc`을 사용합니다. 어느 쪽이든 proxy가 부모를 통해 호스트에 bridge합니다.
- **웹 컴포넌트 자식**에는 이 과정이 필요 없습니다. tag를 렌더링하거나 `loadWebComponent`/`loadByTagName`으로 불러오면 같은 DOM에서 실행되며 Proxy API를 직접 import합니다.

자식 코드는 최상위든 여러 단계 중첩이든 동일합니다. `@wippy-fe/proxy`에서 import해 사용하며 특별한 중첩 규칙은 없습니다.

작동 방식은 아래 [`<w-iframe>`](#w-iframe-custom-element), [`<w-artifact>`](#w-artifact-custom-element), [고급 HTML 주입](#고급-html-주입)을 참고하십시오.

## 내부 전용 — 읽거나 재정의하지 않기

`proxy.js` 또는 `proxy-fragment.js`는 내부 사용을 위해 다음 global을 설치합니다. **애플리케이션과 컴포넌트 코드는 이를 읽거나 할당하지 말고** `@wippy-fe/proxy`를 사용해야 합니다. 충돌을 막기 위해 이름을 나열합니다.

| 전역 객체 | 내용 |
|---|---|
| `window.$W` | async accessor 객체(`$W.host()`, `$W.api()` 등). 내부 전용이며 지원 surface는 `@wippy-fe/proxy` |
| `window.getWippyApi` / `window.initWippyApi` | async "인스턴스 해석" 함수. 내부 전용(`initWippyApi` deprecated) |
| `window.__WIPPY_APP_API__` | 해석된 proxy 인스턴스 |
| `window.__WIPPY_APP_CONFIG__` | 자식 `AppConfig` snapshot |
| `window.__WIPPY_PROXY_CONFIG__` / `window.__WIPPY_CONFIG_OVERRIDES__` | CSS 주입 flag와 페이지별 override |
| `window.__WIPPY_WEB_COMPONENT_CACHE__` | 로드된 컴포넌트 cache |

공개 JavaScript API는 두 엔트리 포인트로 구성됩니다. `initWippyApp(config, rootContainer?)`는 전체 Web Host를 마운트하는 facade 사용 모듈 삽입 엔트리이며([Facade 엔트리 포인트](./entry-point.md) 참고), **`@wippy-fe/proxy`**는 자식 앱과 컴포넌트의 sync API입니다. 위 표의 모든 것은 내부 전용입니다.

## PostMessage 프로토콜(`IFrameMessageType`) — 내부 전송

런타임이 내부에서 사용하는 wire protocol입니다. **애플리케이션 코드는 이 메시지를 보내거나 받지 않습니다.** `@wippy-fe/proxy`가 처리합니다.

호스트가 주입한 `srcdoc` 페이지에서는 `proxy.js` 실행 전에 구성이 `window.__WIPPY_APP_CONFIG__`에 동기식으로 존재합니다. iframe 런타임은 여전히 `get-config`를 보내지만 이 교환은 초기 인스턴스 생성 후 non-blocking 재동기화 및 live-update 채널입니다.

Web Fragment 페이지에서는 handshake가 초기 구성 소스입니다. realm 런타임은 proxy 인스턴스를 만들기 전 same-origin host channel로 client 인증을 포함한 `AppConfig`를 요청합니다. handshake는 수동 전체 호스트 iframe(`iframe.html?waitForCustomConfig`)에서도 blocking이며 삽입 부모가 첫 `get-config` 요청에 응답해야 합니다([Facade 엔트리 포인트 § 수동 iframe 삽입](./entry-point.md#수동facade-없는-iframe-삽입) 참고).

모든 메시지는 `{ type: '@gen2-chat', action: IFrameMessageType.*, ...payload }` 형태의 JSON envelope입니다. `type` 필드는 `APP_CONFIG_IFRAME_EVENT_TYPE`으로 구성할 수 있으며 기본값은 `'@gen2-chat'`입니다.

표에는 이 페이지의 공개 동작을 설명하는 데 필요한 전송 member만 나열합니다. 내부 enum을 완전히 복제하지 않습니다. 내부 enum에는 host lifecycle, chat, download, logging, bridge response, nav owner, layout mutation, breakpoint, drawer/modal, theme mode 메시지도 있으며 애플리케이션 API가 되지 않은 채 변경될 수 있습니다.

| 열거형 멤버 | 와이어 값 | 방향 | 설명 |
|-------------|------------|-----------|-------------|
| `GetConfig` | `get-config` | 자식 → 호스트 | 초기 handshake: 자식이 `AppConfig` 요청 |
| `SetConfig` | `set-config` | 호스트 → 자식 | `GetConfig` 응답으로 `AppConfig` 전달 |
| `UrlWasUpdatedInParent` | `url-was-updated-in-parent` | 호스트 → 자식 | 호스트 URL 변경. 자식 `@history` event 발생 |
| `VisibilityWasUpdatedInParent` | `visibility-was-updated-in-parent` | 호스트 → 자식 | iframe visibility 변경. 자식 `@visibility` event 발생 |
| `TopicWasReceivedInParent` | `topic-was-received-in-parent` | 호스트 → 자식 | 구독 자식에 WebSocket topic event 전달 |
| `CmdRouteChanged` | `cmd-route-changed` | 자식 → 호스트 | 자식 내부 경로 변경. 호스트가 브라우저 URL 업데이트 |
| `CmdTitleChanged` | `cmd-title-changed` | 자식 → 호스트 | 자식 `document.title` 변경. 호스트가 page title 업데이트 |
| `CmdStartChat` | `cmd-start-chat` | 자식 → 호스트 | 새 채팅 session 열기 |
| `CmdOpenSession` | `cmd-open-session` | 자식 → 호스트 | 기존 채팅 session으로 이동 |
| `CmdOpenArtifact` | `cmd-open-artifact` | 자식 → 호스트 | sidebar 또는 modal에서 artifact 열기 |
| `CmdNavigate` | `cmd-navigate` | 자식 → 호스트 | SPA 탐색 요청 |
| `CmdShowToast` | `cmd-show-toast` | 자식 → 호스트 | toast notification 표시 |
| `CmdShowConfirm` | `cmd-show-confirm` | 자식 → 호스트 | confirmation dialog 표시 |
| `OnConfirmResult` | `on-confirm-result` | 호스트 → 자식 | confirm dialog 결과 전달 |
| `CmdSetContext` | `cmd-set-context` | 자식 → 호스트 | 채팅 session에 context 전달 |
| `CmdHandleError` | `cmd-handle-error` | 자식 → 호스트 | 호스트에 오류 보고 |
| `CmdLogout` | `cmd-logout` | 자식 → 호스트 | logout 실행 |
| `CmdSubscribe` | `cmd-subscribe` | 자식 → 호스트 | WebSocket topic 구독 |
| `CmdUnSubscribe` | `cmd-unsubscribe` | 자식 → 호스트 | topic 구독 취소 |
| `OnSubscription` | `on-subscription` | 호스트 → 자식 | subscription event 데이터 전달 |
| `CmdStateGet` | `cmd-state-get` | 자식 → 호스트 | 지속 상태 키 읽기 |
| `CmdStateSet` | `cmd-state-set` | 자식 → 호스트 | 지속 상태 키 쓰기 |
| `CmdStateRemove` | `cmd-state-remove` | 자식 → 호스트 | 지속 상태 키 삭제 |
| `CmdStateClear` | `cmd-state-clear` | 자식 → 호스트 | 이 페이지의 모든 상태 지우기 |
| `CmdStateGetAll` | `cmd-state-get-all` | 자식 → 호스트 | 모든 지속 상태 읽기 |
| `OnStateResult` | `on-state-result` | 호스트 → 자식 | 상태 읽기 결과 전달 |
| `OnStateError` | `on-state-error` | 호스트 → 자식 | 상태 작업 실패 보고 |
| `CmdWsSend` | `cmd-ws-send` | 자식 → 호스트 | 호스트 연결을 통해 WebSocket 명령 전달 |
| `CmdBodySize` | `cmd-body-size` | 자식 → 호스트 | `auto-height`용 body 크기 보고 |
| `CmdBridgePost` | `cmd-bridge-post` | 자식 ↔ 부모 | `host.bridge`를 통한 fire-and-forget channel 메시지 |
| `CmdBridgeRequest` | `cmd-bridge-request` | 자식 ↔ 부모 | `host.bridge`를 통한 request/response channel 메시지 |
| `CmdClaimNavOwner` | `cmd-claim-nav-owner` | 자식 → 호스트 | 탐색 소유권 선언(nav-owner 모드) |
| `CmdReleaseNavOwner` | `cmd-release-nav-owner` | 자식 → 호스트 | 탐색 소유권 해제 |
| `CmdLayoutSubscribe` | `cmd-layout-subscribe` | 자식 → 호스트 | managed-layout update 구독 |
| `CmdLayoutUpdatePanel` | `cmd-layout-update-panel` | 자식 → 호스트 | 패널 정의 patch |
| `CmdLayoutBroadcast` | `cmd-layout-broadcast` | 자식 ↔ 호스트 | 탭 내부 layout bus 메시지 |
| `OnLayoutChange` | `on-layout-change` | 호스트 → 자식 | 전체 layout snapshot update |
| `OnLayoutPanelChanged` | `on-layout-panel-changed` | 호스트 → 자식 | 패널별 live 상태 delta |
| `OnLayoutBroadcast` | `on-layout-broadcast` | 호스트 → 자식 | layout bus broadcast 전달 |

## `<w-iframe>` 사용자 정의 요소 :id=w-iframe-custom-element

`<w-iframe>`은 proxy 런타임에 내장된 저수준 자식 페이지 primitive입니다. raw source HTML을 받고 일반 iframe 경로에서는 전체 Wippy 런타임(base URL, import map, `loading.js`, `proxy.js`, 자식 구성)을 sandboxed `srcdoc` iframe에 주입합니다. Fragment로 렌더링된 페이지 안에서는 중첩된 등록 `view.page`가 Web Fragment를 사용하며 inline HTML과 다른 콘텐츠는 계속 `srcdoc`을 사용합니다.

source HTML이 있고 Wippy 마이크로 프런트엔드 앱과 같은 런타임 동작, 즉 인증 API, 상태 relay, WebSocket relay, nav-owner 라우팅, 부모-자식 bridge 메시지가 필요할 때 `<w-iframe>`을 사용합니다.

### Attribute와 property

| 속성 / 프로퍼티 | 필수 | 기본값 | 설명 |
|----------------------|----------|---------|-------------|
| `src` | 아니요 | — | proxy `api`를 통해 raw source HTML로 가져올 URL |
| `srcdoc` | 아니요 | — | raw source HTML. 큰 문자열에는 `element.srcdoc = html`로도 설정 가능 |
| `base-url` | 아니요 | `src` 또는 `document.baseURI`에서 유도 | 상대 자산 해석을 위해 주입하는 `<base href>` |
| `resource-id` | 아니요 | 요소 `id`, 그다음 `src` | 자식 context 식별자. 기본 상태 및 log 범위 설정 |
| `resource-type` | 아니요 | `page` | 자식 context 유형: `page` 또는 `artifact` |
| `sub-path` | 아니요 | 부모 경로 | 초기 자식 경로. `GetConfig` handshake의 `config.context.route`로 전달 |
| `auto-height` | 아니요 | `false` | 자식 `CmdBodySize` 보고에 맞춰 iframe 높이 조정 |
| `nav-owner` | 아니요 | `false` | 자식 `CmdRouteChanged`를 가로채 호스트 URL 대신 `nav-owner-route` DOM event 발생 |

요소에서 받는 JS property:

```typescript
const frame = document.querySelector('w-iframe')
frame.proxyConfig = { injections: { css: { markdown: false } } }
frame.configOverrides = { customization: { customCSS: ':root { --brand: red }' } }
frame.srcdoc = sourceHtml
```

### Event와 메서드

| 이벤트 | 세부 정보 | 설명 |
|-------|--------|-------------|
| `loading` | — | fetch/process/render 시작 전 발생 |
| `load` | — | sandbox iframe load 후 발생 |
| `error` | 원래 오류 | fetch, 주입, load 실패 시 발생 |
| `nav-owner-route` | `{ path: string, navId?: number }` | `nav-owner` 설정 시 자식 경로 변경. event는 bubble되고 `composed` |
| `wippy-message` | `{ channel, payload, requestId?, respond?, reject? }` | 자식의 bridge 메시지 |

| 메서드 | 설명 |
|--------|-------------|
| `post(channel, payload?)` | 자식에 fire-and-forget bridge 메시지 |
| `request<T>(channel, payload?, { timeoutMs }?)` | request/response bridge 메시지. handler 반환값으로 resolve |

Shadow part: `loader`, `error`, `frame`.

`nav-owner`가 설정되면 기본 경로 동기화 왕복이 완전히 억제됩니다. 호스트는 자체 URL 표시줄을 갱신하지 않고 `UrlWasUpdatedInParent`도 자식에 보내지 않습니다. 탐색 소유권은 `nav-owner-route`를 수신하는 부모 코드에 완전히 위임됩니다. event detail의 `path`는 자식이 `host.onRouteChanged(internalRoute, navId?)`에 전달한 **raw 내부 경로**이며 마운트 접두사가 붙지 않습니다. 기본 `CmdRouteChanged` 경로에서는 호스트가 페이지 마운트 접두사를 추가합니다. 삽입 부모가 접두사나 router mapping을 책임집니다.

```typescript
const frame = document.querySelector('w-iframe')
frame.addEventListener('nav-owner-route', (event) => {
  const { path, navId } = event.detail
  myRouter.push(path)
})
```

### 부모-자식 bridge

bridge는 이름 있는 channel을 사용하므로 어느 쪽도 raw `postMessage` envelope가 필요 없습니다.

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

// Later, dispose this listener when the owning component or page scope is torn down:
// off()
```

`host.bridge.on()`은 unsubscribe 함수(`() => void`)를 반환합니다. **한 channel에는 하나의 활성 handler만 있습니다.** 같은 channel에 여러 handler를 등록하면 가장 최근 handler가 이 channel의 모든 incoming 메시지, 즉 fire-and-forget `post()`와 `request()`를 모두 처리합니다. `on()`은 additive가 아닙니다. 이전 handler는 제거되지는 않지만 새 handler가 있는 동안 가려지며 proxy가 중복 등록에 `console.warn`을 기록합니다. 최신 handler가 unsubscribe하면 이전 handler가 다시 활성화됩니다. 독립 listener가 여럿 필요하면 서로 다른 channel 이름을 사용합니다.

`options.timeoutMs`를 생략하면 `host.bridge.request()`와 부모 측 `frame.request()`의 기본 deadline은 10초(`10000` ms)입니다. timeout 시 반환 Promise는 `Bridge request <id> timed out after <ms>ms` 메시지의 `Error`로 reject됩니다. 상대편에 handler가 없는 channel 요청은 deadline을 기다리지 않고 즉시 `No handler registered for channel "<channel>"`로 reject됩니다.

## `<w-artifact>` 사용자 정의 요소 :id=w-artifact-custom-element

`<w-artifact>`는 artifact 또는 page 메타데이터와 콘텐츠를 해석한 뒤 iframe 기반 유형을 내부 `<w-iframe>`에 위임합니다. 콘텐츠 유형(HTML, Markdown, web page package, ESM package, direct-tag 컴포넌트)을 탐지하며 raw `<w-iframe>`보다 높은 수준의 API를 제공합니다.

### Attribute

| 속성 | 필수 | 값 | 기본값 | 설명 |
|-----------|----------|--------|---------|-------------|
| `id` | 예 | Artifact/Page UUID | — | 콘텐츠 식별자 |
| `type` | 아니요 | `artifact` \| `page` | `artifact` | 호출 REST endpoint 결정: `/api/v1/artifact/<id>/content` 또는 `/api/public/pages/content/<id>` |
| `auto-height` | 아니요 | boolean flag | `false` | `CmdBodySize` 높이 동기화를 위해 내부 `<w-iframe>`에 전달 |
| `url` | 아니요 | 모든 URL | — | 이 URL에서 콘텐츠를 직접 가져오며 `id`/`type` 무시 |
| `sub-path` | 아니요 | 경로 문자열 | — | 초기 자식 경로로 내부 `<w-iframe>`에 전달 |
| `nav-owner` | 아니요 | boolean flag | `false` | 내부 `<w-iframe>`에 전달. 자식 경로 변경이 `nav-owner-route` 발생 |

### Event

| 이벤트 | 시점 | 세부 정보 |
|-------|------|--------|
| `loading` | fetch 시작 전 | — |
| `load` | iframe load 후 | — |
| `error` | fetch 또는 렌더 실패 | 원래 오류 |
| `nav-owner-route` | nav-owner 자식 경로 변경 | `{ path: string, navId?: number }` |
| `wippy-message` | 중첩 iframe의 bridge 메시지 | `{ channel, payload, requestId?, respond?, reject? }` |

### CSS 상태와 part

요소는 `status` attribute(`loading`, `ready`, `error`)를 설정하고 shadow part를 노출합니다.

```css
w-artifact[status="loading"] { opacity: 0.5; }
w-artifact[status="error"]   { border: 1px solid var(--p-danger-color); }

w-artifact::part(loader) { font-size: 1rem; }
w-artifact::part(frame)  { border: 0; }
```

## `<w-iframe>`과 `<w-artifact>`와 raw `<iframe>`

| 기능 | `<w-iframe>` | `<w-artifact>` | 원시 `<iframe>` |
|---------|-------------|----------------|----------------|
| Wippy 런타임 주입 | 예 | 예(`<w-iframe>` 경유) | 아니요 |
| artifact/page 메타데이터 해석 | 아니요 | 예 | 아니요 |
| 인증 콘텐츠 fetch | 예(raw HTML) | 예(전체 resolver) | 아니요 |
| 상태 relay | 예 | 예 | 아니요 |
| WebSocket relay | 예 | 예 | 아니요 |
| 부모-자식 bridge | 예 | 예(전달) | 아니요 |
| Nav-owner 지원 | 예 | 예 | 아니요 |
| 콘텐츠 유형 탐지 | 아니요 | 예 | 아니요 |
| CSS shadow part | `loader`, `error`, `frame` | `loader`, `error`, `frame` | — |
| `status` attribute | 예 | 예 | 아니요 |

Wippy artifact UUID나 page ID가 있고 플랫폼이 모든 해석을 처리하게 하려면 `<w-artifact>`를 사용합니다. source HTML이 이미 있고 직접 런타임 주입을 원하면 `<w-iframe>`을 사용합니다. Wippy API가 필요 없는 완전한 외부 콘텐츠에만 raw `<iframe>`을 사용합니다.

## 고급 HTML 주입

요소를 마운트하지 않고 source-HTML-to-srcdoc 변환이 필요하면 proxy의 `html.inject(...)`를 사용합니다.

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

같은 함수는 `instance.html.inject`, `$W.html`, `import { html } from '@wippy-fe/proxy'`로 접근할 수 있습니다. 일반적인 마운트에는 `<w-iframe>`을 우선하고 사용자 정의 호스팅 기반을 만들 때만 `html.inject(...)`를 사용합니다.
