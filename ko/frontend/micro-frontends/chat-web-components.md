---
title: "Chat Web Components"
description: "Wippy 채팅 UI는 조합 가능한 커스텀 엘리먼트 집합으로 제공되므로, 모든 마이크로 프론트엔드(또는 자식 컨텍스트에서 실행되는 모든 페이지)가…"
---

# Chat Web Components

Wippy 채팅 UI는 **조합 가능한 커스텀 엘리먼트** 집합으로 제공되므로, 모든 마이크로 프론트엔드(또는 자식 컨텍스트에서 실행되는 모든 페이지)가 태그만으로 살아 있는 Wippy 채팅을 넣을 수 있습니다 — Vue도, import도, 등록도 필요 없습니다. 이 엘리먼트들은 호스트 자체 채팅이 사용하는 것과 동일한 컴포넌트를 감싸며(단일 소스 오브 트루스), 동일한 `ChatTransport` → `SessionManager` 데이터 레이어를 사용합니다.

이들은 여러분이 *소비하는* 기성 엘리먼트입니다 — 직접 만드는 [Web Component](./web-component.md)와 달리, 작성하거나 등록하지 않습니다. 호스트가 모든 자식에서 태그로 사용할 수 있게 만듭니다([로드 방식](#how-they-load) 참고).

> 자신의 페이지나 패널 *안에* 채팅 서피스를 두고 싶을 때 이들을 사용하세요. 대신 호스트 자체 채팅 패널을 명령형으로 열려면 `@wippy-fe/proxy`의 `host.startChat(token)` / `host.openSession(sessionUUID)`를 사용하세요([Proxy API](./proxy-api.md) 참고).

## 엘리먼트

| 태그 | 렌더링 대상 | 주요 속성 | 이벤트 |
|-----|---------|----------------|--------|
| `<wippy-chat>` | 전체 채팅 — 헤더 + 메시지 + 입력 | `session-id`, `start-token`, `agent`, `show-selector`, `hide-header` | `session-started`, `error` |
| `<wippy-chat-messages>` | 메시지 목록만 | `session-id` | — |
| `<wippy-chat-input>` | 작성기만 | `session-id` | — |
| `<wippy-session-selector>` | 세션 선택기 | `active-session-id` | `select` |

모든 엘리먼트는 인스턴스별 테마 속성 두 개 — **`custom-css`**와 **`css-variables`** — 도 받으며, 이는 [테마](#theming)에서 다룹니다.

## 로드 방식

채팅 엘리먼트는 [`<wippy-loading>`](../web-host/packages.md#wippy-feloading)과 정확히 같은 방식으로 제공됩니다: 작은 셸인 `@wippy-fe/chat.js`(~21 KB)가 네 개의 태그를 모두 자동 등록하고, 호스트의 `scripts` 배열을 통해 (`loading.js`, `proxy.js`와 함께) 모든 자식 컨텍스트에 주입됩니다. 따라서 태그는 어떤 자식 마이크로 프론트엔드에서든 **앱별 등록 없이** 이름으로 사용할 수 있습니다 — 패키지를 설치하거나 `customElements.define()`을 호출하지 않습니다.

무거운 내부 구현 — Vue 트리와 PrimeVue, Shiki, markdown 렌더러(~2 MB) — 는 별도의 `chat-internals.[hash].js` 청크로 코드 분할되어 **첫 마운트 시 지연 로드**됩니다. 청크를 다운로드하는 동안 엘리먼트는 `<wippy-loading>` 플레이스홀더를 표시하며, 로드에 실패하면 `<wippy-error>`를 표시합니다. 채팅 태그를 전혀 사용하지 않는 페이지는 내부 구현 비용을 전혀 지불하지 않습니다.

## `<wippy-chat>`

반응형 세션 제어에는 Web Host `1.0.51` 이상이 필요합니다. 대응하는
`@wippy-fe/*` `0.0.51+` 패키지 패밀리를 고정하세요. 더 오래된 주입 채팅 엘리먼트는
최초 마운트만 안정적으로 지원합니다.

전체 채팅 서피스: 헤더, 스크롤 가능한 메시지 목록, 작성기입니다.

| 속성 | 타입 | 기본값 | 설명 |
|-----------|------|---------|-------------|
| `session-id` | string | — | 이 기존 세션(세션 UUID)을 렌더링합니다. |
| `start-token` | string | — | 에이전트 시작 토큰. `session-id`가 설정되지 않은 경우 마운트 시 **새** 세션을 시작합니다. |
| `agent` | string | — | 세션이 열려 있지 않을 때 표시되는 빈 상태에서 미리 선택할 에이전트 이름(또는 제목)입니다. |
| `show-selector` | boolean | `false` | 헤더에 내장 세션 선택기를 렌더링합니다. |
| `hide-header` | boolean | `false` | 에이전트/모델 헤더 바를 숨깁니다(컴팩트 임베드용). |

**이벤트** (엘리먼트에서 `CustomEvent`로 디스패치됩니다. `event.detail`을 읽으세요):

| 이벤트 | `detail` | 발생 시점 |
|-------|----------|------|
| `session-started` | `{ sessionId: string }` | 세션이 시작될 때 — 마운트 시 `start-token`에 의해, 또는 사용자 동작으로. |
| `error` | `{ message: string }` | 세션 초기화가 실패할 때(예: 유효하지 않은 `start-token`). |

```html
<!-- 에이전트 시작 토큰으로 새 세션 시작 -->
<wippy-chat start-token="agent-start-token" agent="researcher"></wippy-chat>

<!-- 기존 세션 고정 -->
<wippy-chat session-id="019eb2ae-1234-5678-abcd-ef1234567890"></wippy-chat>

<!-- 내장 선택기, 헤더 바 없음 -->
<wippy-chat show-selector hide-header></wippy-chat>
```

```javascript
document.querySelector('wippy-chat')
  .addEventListener('session-started', (e) => {
    console.log('session:', e.detail.sessionId)
  })
```

### 리마운트 없는 반응형 제어

`<wippy-chat>` 엘리먼트 하나를 마운트한 채로 두고 그 속성을 업데이트하세요. `session-id`가
바뀌면 그 자리에서 해당 세션이 열립니다. `session-id=""`로 설정하거나 이전에 제어하던
속성을 제거하는 것은 명시적인 **New Chat** 전환입니다: 고정된 세션과
공유 활성 세션을 모두 해제합니다. `session-id`를 한 번도 가진 적이 없는
엘리먼트는 대신 선택기 기반으로 남습니다. 최초 마운트 시의 부재는 해제
명령이 아닙니다.

`start-token`이 존재할 때 `session-id`를 해제하면 그 토큰으로 다시 시작합니다.
토큰을 변경해도 그 자리에서 시작합니다. 엘리먼트는 커스텀 엘리먼트 호스트당
토큰을 한 번만 소비하므로, 같은 엘리먼트를 재연결하거나 이동해도 살아 있는
시작이 재생되지 않습니다. 더 새로운 토큰, 제어되는 세션, 수동 선택, 또는 연결
해제가 진행 중인 시작을 대체하면, 뒤늦은 결과는 현재 세션을 교체할 수 없으며
늦게 생성된 세션은 닫힙니다.

```javascript
const chat = document.querySelector('wippy-chat')

chat.setAttribute('session-id', existingSessionId)

// 에이전트와 함께 New Chat. 엘리먼트 교체는 필요하지 않습니다.
chat.setAttribute('start-token', agentStartToken)
chat.removeAttribute('session-id')
```

관리형 레이아웃 컴포넌트 리졸버는 기존 커스텀 엘리먼트의 props를 업데이트하고
제거합니다. `tagName`이 바뀔 때만 리마운트하므로, 패널 업데이트 전반에서 채팅
입력, 스크롤 위치, 엘리먼트가 소유한 라이프사이클 상태가 보존됩니다.

## `<wippy-chat-messages>`와 `<wippy-chat-input>`

메시지 목록과 작성기를 별도 엘리먼트로 제공하므로 직접 배치할 수 있습니다. 각각 하나의 `session-id`를 받으며, 명시적인 `session-id`가 없으면 `<wippy-session-selector>`가 설정한 [공유 활성 세션](#composition--shared-session)을 따릅니다. 둘 다 이벤트를 발생시키지 않습니다.

```html
<!-- 커스텀 레이아웃: 위에 메시지, 아래에 작성기 -->
<div style="display:flex; flex-direction:column; height:100%;">
  <wippy-chat-messages session-id="019eb2ae-…"></wippy-chat-messages>
  <wippy-chat-input    session-id="019eb2ae-…"></wippy-chat-input>
</div>
```

## `<wippy-session-selector>`

세션 선택기입니다. 다른 엘리먼트들이 따르는 공유 활성 세션을 구동합니다.

| 속성 | 타입 | 기본값 | 설명 |
|-----------|------|---------|-------------|
| `active-session-id` | string | — | 이 세션을 활성으로 강조합니다. |

**이벤트:**

| 이벤트 | `detail` | 발생 시점 |
|-------|----------|------|
| `select` | `{ sessionId: string }` | 사용자가 세션을 선택할 때. 선택된 세션이 공유 활성 세션이 됩니다. |

```html
<wippy-session-selector></wippy-session-selector>
```

```javascript
document.querySelector('wippy-session-selector')
  .addEventListener('select', (e) => {
    console.log('picked:', e.detail.sessionId)
  })
```

## 조합과 공유 세션

**명시적 `session-id`가 없는** 엘리먼트는 매니저의 공유 `activeSessionId`를 통해 `<wippy-session-selector>`의 선택을 따릅니다. 따라서 한 페이지의 선택기와 채팅(또는 선택기와 분리된 메시지 + 입력)은 동기화 상태를 유지합니다 — 선택기에서 세션을 고르면 나머지가 업데이트됩니다. 명시적 `session-id`(또는 `start-token`)를 **가진** 엘리먼트는 고정되어 선택기를 무시합니다.

```html
<!-- 선택기 + 채팅: 채팅이 선택된 세션을 따릅니다 -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>

<!-- 선택기 + 분리된 메시지 목록 / 작성기, 모두 선택기를 따릅니다 -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat-messages></wippy-chat-messages>
<wippy-chat-input></wippy-chat-input>

<!-- 선택기 기반 채팅 옆의 고정된 채팅 -->
<wippy-chat session-id="019eb2ae-…"></wippy-chat>  <!-- 선택기를 무시합니다 -->
<wippy-chat></wippy-chat>                            <!-- 선택기를 따릅니다 -->
```

## 테마

각 엘리먼트는 shadow root 안에 렌더링되므로 호스트 페이지 스타일이 안팎으로 새지 않습니다. 두 가지 메커니즘으로 테마가 적용됩니다:

- **상속되는 CSS 변수.** 테마 커스텀 프로퍼티(`--p-primary-*`, `--p-text-color`, …)는 호스트 테마에서 shadow 경계를 넘어 상속되므로, 채팅이 활성 팔레트와 다크/라이트 모드를 그대로 물려받습니다. 셀렉터 기반 스타일(PrimeVue, markdown, Tailwind)은 `chat-elements.css` 시트로 번들되어 shadow root에 주입됩니다. `PrimeVuePlugin`은 기본 body/null Portal 타깃을 소유 shadow root 내부의 고정된 오버레이 레이어로 리디렉션합니다. `appendTo: 'self'`를 일상적으로 설정하지 마세요. 그것은 명시적인 인라인 배치 옵트인이며 스크롤되는 Dialog나 Drawer 콘텐츠 안에서 잘릴 수 있습니다. 토스트는 shadow 내부에 렌더링되지 않고 proxy를 통해 **호스트의 네이티브 토스트**로 위임됩니다.
- **인스턴스별 오버라이드.** 모든 엘리먼트는 두 개의 속성을 받습니다:

| 속성 | 타입 | 효과 |
|-----------|------|--------|
| `custom-css` | string | 엘리먼트의 shadow root에 **마지막으로** 추가되는 원시 CSS이므로 순서상 우선합니다. |
| `css-variables` | object (JSON) | `:host`에 적용되는 인스턴스별 CSS 변수 오버라이드입니다. 키는 앞의 `--`를 생략할 수 있습니다. |

```html
<wippy-chat
  session-id="019eb2ae-…"
  custom-css=".message-item { max-width: 80%; }"
></wippy-chat>
```

`css-variables`를 생략하는 것이 facade를 존중하는 일반적인 경로입니다. 인스턴스별 색상 오버라이드는 일상적인 재스타일링이 아니라 의도적인 임베딩 격리를 위한 것입니다.

전체 테마 모델 — 시맨틱 변수, 다크/라이트 전환, 호스트가 shadow DOM CSS를 주입하는 방식 — 은 [Theming: Web Components](./web-component-theming.md)를 참고하세요.

## 런타임 배선

Web Host 자식 내부에서 이 엘리먼트들은 설정이 필요 없습니다. 인증과 설정은 호스트가 이미 주입한 proxy 전역(`window.__WIPPY_APP_CONFIG__` / `window.__WIPPY_APP_API__`)에서 옵니다. REST와 WebSocket은 설정의 env URL을 사용합니다. 페이지에 채팅 태그를 넣는 것만으로 충분합니다 — 셸이 이를 등록하고, 내부 구현이 지연 로드되며, 채팅이 자식의 기존 세션으로 연결됩니다.

## 참고

- [Web Component (`view.component`)](./web-component.md) — 자신만의 커스텀 엘리먼트 만들기
- [@wippy-fe Packages](../web-host/packages.md) — 호스트 import map과 주입되는 엘리먼트 셸(`@wippy-fe/chat`, `@wippy-fe/loading`)
- [Theming: Web Components](./web-component-theming.md) — shadow DOM CSS와 시맨틱 변수
- [Proxy API](./proxy-api.md) — `host.startChat` / `host.openSession`과 `@wippy-fe/proxy`의 나머지
- [Proxy & Isolation](../web-host/proxy-isolation.md) — 호스트가 자식에 스크립트와 설정을 주입하는 방식
