---
title: "채팅 웹 컴포넌트"
description: "호스트가 제공하는 채팅, 메시지 목록, 작성기, 세션 선택기 커스텀 엘리먼트를 삽입하는 레퍼런스입니다."
---

# 채팅 웹 컴포넌트

**분류: 부분 임베딩 예제를 포함한 API 레퍼런스.** HTML과 JavaScript 블록은 채팅 엘리먼트 셸을 사용할 수 있는 호스팅된 자식, 유효한 세션 UUID 또는 에이전트 시작 토큰, 애플리케이션이 소유한 마운트 및 해제 코드가 있다고 가정합니다.

Host가 채팅 셸을 주입하는 컨텍스트에서는 Wippy 채팅 UI를 **조합 가능한 커스텀 엘리먼트**로 사용할 수 있습니다. srcdoc iframe 자식은 Vue import나 등록 없이 태그만으로 실시간 채팅을 삽입할 수 있습니다. 이 엘리먼트는 호스트와 동일한 채팅 컴포넌트 및 `ChatTransport` → `SessionManager` 데이터 계층을 사용합니다.

이들은 직접 작성하는 [웹 컴포넌트](./web-component.md)와 달리 소비하기 위한 호스트 제공 엘리먼트입니다. 사용자가 작성하거나 등록하지 않습니다. srcdoc iframe 주입기가 태그를 사용할 수 있게 합니다. 고정된 Framework 릴리스의 Web Fragment gateway는 의도적으로 `chat.js`를 생략하므로 Fragment 페이지는 이 태그가 있다고 가정할 수 없습니다. 그곳에서는 호스트 채팅 컨트롤을 사용하세요([로드 방식](#로드-방식) 참조).

> 자체 페이지나 패널 **안에** 채팅 표면이 필요할 때 사용합니다. 대신 호스트 자체 채팅 패널을 명령형으로 열려면 `@wippy-fe/proxy`의 `host.startChat(token)`/`host.openSession(sessionUUID)`을 사용합니다([프록시 API](./proxy-api.md) 참조).

## 엘리먼트

| 태그 | 렌더링 내용 | 주요 속성 | 이벤트 |
|---|---|---|---|
| `<wippy-chat>` | 헤더, 메시지, 입력을 포함한 전체 채팅 | `session-id`, `start-token`, `agent`, `show-selector`, `hide-header` | `session-started`, `error` |
| `<wippy-chat-messages>` | 메시지 목록만 | `session-id` | — |
| `<wippy-chat-input>` | 작성기만 | `session-id` | — |
| `<wippy-session-selector>` | 세션 선택기 | `active-session-id` | `select` |

모든 엘리먼트는 인스턴스별 테마 속성 **`custom-css`**와 **`css-variables`**도 받습니다. [테마](#테마)에서 설명합니다.

## 로드 방식

채팅 엘리먼트는 [`<wippy-loading>`](../web-host/packages.md#wippy-feloading)처럼 제공됩니다. 작은 `@wippy-fe/chat.js` 셸이 네 태그를 모두 자동 등록합니다. srcdoc iframe 주입기는 이를 `loading.js`, `proxy.js`와 함께 호스트 `scripts` 배열에 포함하므로 iframe 전달 페이지는 패키지를 설치하거나 `customElements.define()`을 호출하지 않습니다.

Framework의 Web Fragment gateway는 `loading.js`와 `proxy-fragment.js`를 주입하지만 `chat.js`는 주입하지 않습니다. 이후 플랫폼 계약이 명시적 채팅 셸 옵트인을 추가하기 전까지 Fragment 전달 페이지는 `host.startChat()` 또는 `host.openSession()`을 사용해야 합니다. 호스트 문서에 직접 마운트한 웹 컴포넌트도 다른 자식 실행 영역이 태그를 등록했다고 가정하면 안 됩니다.

구현 의존성은 별도 `chat-internals.[hash].js` 청크로 코드 분할되며 **첫 마운트 때 지연 로드**됩니다. 청크를 내려받는 동안 엘리먼트는 `<wippy-loading>` 자리표시자를 표시하고, 로드에 실패하면 `<wippy-error>`를 표시합니다. 채팅 태그를 마운트하지 않는 페이지는 내부 코드를 로드하지 않습니다.

## `<wippy-chat>`

반응형 세션 제어에는 Web Host `1.0.51` 이상이 필요합니다. 엘리먼트 셸은 공개 `@wippy-fe/chat` 패키지가 아니라 Host가 주입한 자산입니다. 이전 Host 릴리스는 초기 마운트만 안정적으로 지원합니다.

헤더, 스크롤 가능한 메시지 목록, 작성기를 포함한 전체 채팅 표면입니다.

| 속성 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `session-id` | string | — | 기존 세션(세션 UUID)을 렌더링합니다. |
| `start-token` | string | — | 에이전트 시작 토큰입니다. `session-id`가 없으면 마운트할 때 **새** 세션을 시작합니다. |
| `agent` | string | — | 열린 세션이 없을 때 빈 상태에서 미리 선택할 에이전트 이름 또는 제목입니다. |
| `show-selector` | boolean | `false` | 헤더에 내장 세션 선택기를 렌더링합니다. |
| `hide-header` | boolean | `false` | 간결한 임베드용으로 에이전트/모델 헤더 표시줄을 숨깁니다. |

**이벤트**(엘리먼트에서 `CustomEvent`로 발생하며 `event.detail`을 읽음):

| 이벤트 | `detail` | 발생 시점 |
|---|---|---|
| `session-started` | `{ sessionId: string }` | 마운트 시 `start-token` 또는 사용자 동작으로 세션을 시작했을 때 |
| `error` | `{ message: string }` | 잘못된 `start-token` 등 세션 초기화가 실패했을 때 |

```html
<!-- Start a new session from an agent start token -->
<wippy-chat start-token="agent-start-token" agent="researcher"></wippy-chat>

<!-- Pin an existing session -->
<wippy-chat session-id="019eb2ae-1234-5678-abcd-ef1234567890"></wippy-chat>

<!-- Built-in selector, no header bar -->
<wippy-chat show-selector hide-header></wippy-chat>
```

```javascript
document.querySelector('wippy-chat')
  .addEventListener('session-started', (e) => {
    console.log('session:', e.detail.sessionId)
  })
```

### 다시 마운트하지 않는 반응형 제어

하나의 `<wippy-chat>` 엘리먼트를 마운트한 채 속성을 업데이트합니다. `session-id`가 바뀌면 그 세션을 제자리에서 엽니다. `session-id=""`로 설정하거나 이전에 제어하던 속성을 제거하면 명시적인 **새 채팅** 전환이 되어 고정 세션과 공유 활성 세션을 모두 지웁니다. 처음부터 `session-id`가 없던 엘리먼트는 선택기 제어 상태를 유지합니다. 첫 마운트에서 속성이 없는 것은 지우기 명령이 아닙니다.

`start-token`이 있으면 `session-id`를 지울 때 그 토큰으로 다시 시작합니다. 토큰을 바꿔도 제자리에서 시작합니다. 엘리먼트는 커스텀 엘리먼트 호스트마다 토큰을 한 번만 소비하므로 같은 엘리먼트를 다시 연결하거나 이동해도 유효한 시작을 재실행하지 않습니다. 더 최신 토큰, 제어 세션, 수동 선택 또는 연결 해제가 진행 중인 시작을 대체하면 오래된 결과가 현재 세션을 바꿀 수 없으며 늦게 만들어진 세션은 닫힙니다.

```javascript
const chat = document.querySelector('wippy-chat')

chat.setAttribute('session-id', existingSessionId)

// New Chat with an agent. No element replacement is required.
chat.setAttribute('start-token', agentStartToken)
chat.removeAttribute('session-id')
```

관리형 레이아웃 컴포넌트 resolver는 기존 커스텀 엘리먼트에서 props를 업데이트하고 제거합니다. `tagName`이 바뀔 때만 다시 마운트하므로 패널 업데이트 사이에도 채팅 입력, 스크롤 위치, 엘리먼트 소유 수명 주기 상태가 유지됩니다.

## `<wippy-chat-messages>`와 `<wippy-chat-input>`

메시지 목록과 작성기를 별도 엘리먼트로 제공하므로 직접 배치할 수 있습니다. 각각 하나의 `session-id`를 받습니다. 명시적 `session-id`가 없으면 `<wippy-session-selector>`가 설정한 [공유 활성 세션](#조합과-공유-세션)을 따릅니다. 둘 다 이벤트를 발생시키지 않습니다.

```html
<!-- Custom layout: messages above, composer below -->
<div style="display:flex; flex-direction:column; height:100%;">
  <wippy-chat-messages session-id="019eb2ae-…"></wippy-chat-messages>
  <wippy-chat-input    session-id="019eb2ae-…"></wippy-chat-input>
</div>
```

## `<wippy-session-selector>`

세션 선택기입니다. 다른 엘리먼트가 따르는 공유 활성 세션을 제어합니다.

| 속성 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `active-session-id` | string | — | 이 세션을 활성 상태로 강조합니다. |

**이벤트:**

| 이벤트 | `detail` | 발생 시점 |
|---|---|---|
| `select` | `{ sessionId: string }` | 사용자가 세션을 선택했을 때. 선택한 세션이 공유 활성 세션이 됩니다. |

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

**명시적 `session-id`가 없는** 엘리먼트는 manager의 공유 `activeSessionId`를 통해 `<wippy-session-selector>`의 선택을 따릅니다. 따라서 한 페이지의 선택기와 채팅 또는 선택기와 분리된 메시지 및 입력은 동기화됩니다. 선택기에서 세션을 고르면 다른 엘리먼트가 업데이트됩니다. 명시적 `session-id` 또는 `start-token`이 **있는** 엘리먼트는 고정되어 선택기를 무시합니다.

```html
<!-- Selector + chat: the chat follows the picked session -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>

<!-- Selector + split message list / composer, all following the selector -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat-messages></wippy-chat-messages>
<wippy-chat-input></wippy-chat-input>

<!-- Pinned chat alongside a selector-driven one -->
<wippy-chat session-id="019eb2ae-…"></wippy-chat>  <!-- ignores the selector -->
<wippy-chat></wippy-chat>                            <!-- follows the selector -->
```

## 테마

각 엘리먼트는 Shadow Root에서 렌더링되므로 호스트 페이지 스타일이 안팎으로 누출되지 않습니다. 두 메커니즘으로 테마를 적용합니다.

- **상속된 CSS 변수.** 테마 사용자 지정 속성(`--p-primary-*`, `--p-text-color` 등)은 호스트 테마에서 Shadow 경계를 넘어 상속되므로 채팅이 활성 팔레트와 어둡게/밝게 모드를 따릅니다. 선택자 기반 스타일(PrimeVue, markdown, Tailwind)은 `chat-elements.css` 시트에 번들되어 Shadow Root에 주입됩니다. `PrimeVuePlugin`은 기본 body/null Portal 대상을 소유 Shadow Root 안의 고정 오버레이 계층으로 리디렉션합니다. `appendTo: 'self'`를 일상적으로 설정하지 마세요. 이는 명시적인 인라인 배치 옵트인이며 스크롤되는 Dialog나 Drawer 콘텐츠 안에서 잘릴 수 있습니다. Toast는 Shadow 내부에 렌더링되지 않고 프록시를 통해 **호스트의 네이티브 toast**에 위임됩니다.
- **인스턴스별 재정의.** 모든 엘리먼트는 다음 두 속성을 받습니다.

| 속성 | 타입 | 효과 |
|---|---|---|
| `custom-css` | string | 엘리먼트 Shadow Root에 **마지막으로** 추가되는 원시 CSS이므로 순서상 우선합니다. |
| `css-variables` | object(JSON) | `:host`에 적용되는 인스턴스별 CSS 변수 재정의입니다. 키에서 앞의 `--`를 생략할 수 있습니다. |

두 속성을 모두 신뢰할 수 있는 애플리케이션 설정으로 취급하세요. 신뢰할 수 없는 사용자 입력을 원시 CSS나 변수 값에 복사하지 마세요. CSS는 삽입된 인터페이스를 변경하거나 가릴 수 있고 외부 리소스 요청을 시작할 수도 있습니다.

```html
<wippy-chat
  session-id="019eb2ae-…"
  custom-css=".message-item { max-width: 80%; }"
></wippy-chat>
```

facade를 존중하는 일반적인 경로는 `css-variables`를 생략하는 것입니다. 인스턴스별 색상 재정의는 의도적인 임베딩 격리를 위한 것이며 일상적인 스타일 변경용이 아닙니다.

의미 변수, 어둡게/밝게 전환, 호스트가 Shadow DOM CSS를 주입하는 방식을 포함한 전체 테마 모델은 [테마: 웹 컴포넌트](./web-component-theming.md)를 참조하세요.

## 런타임 연결

srcdoc iframe 자식 안에서 엘리먼트는 추가 설정 없이 작동합니다. 인증과 설정은 주입된 프록시 런타임에서 오고 REST와 WebSocket은 설정의 환경 URL을 사용합니다. 채팅 태그가 마운트되면 이미 등록된 셸이 내부 코드를 필요할 때 로드하고 자식의 기존 세션으로 연결합니다. Web Fragment 및 직접 호스트 컨텍스트의 가용성 제한은 [로드 방식](#로드-방식)에 설명되어 있습니다.

## 함께 보기

- [웹 컴포넌트(`view.component`)](./web-component.md) — 자체 커스텀 엘리먼트 만들기
- [@wippy-fe 패키지](../web-host/packages.md) — 호스트 import map과 주입된 엘리먼트 셸(`@wippy-fe/chat`, `@wippy-fe/loading`)
- [테마: 웹 컴포넌트](./web-component-theming.md) — Shadow DOM CSS와 의미 변수
- [프록시 API](./proxy-api.md) — `host.startChat`/`host.openSession` 및 나머지 `@wippy-fe/proxy`
- [프록시 및 격리](../web-host/proxy-isolation.md) — 호스트가 자식에 스크립트와 설정을 주입하는 방식
