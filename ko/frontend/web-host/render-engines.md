---
title: "렌더 엔진"
description: "view.page 애플리케이션이 srcdoc iframe 또는 Web Fragment에서 실행되는 방식과 선택 규칙 및 호환성 제한입니다."
---

# 렌더 엔진

이 페이지는 렌더 엔진 선택과 호환성에 대한 참조입니다. 운영자 및 패키지 설정을 설명하며 독립적인 배포 레시피는 아닙니다.

Wippy Web Host는 두 **페이지 렌더 엔진** 중 하나를 통해 마이크로 프런트엔드 앱(`view.page`)을 렌더링합니다. 엔진은 운영자 switch가 선택하는 전달 관심사이며 페이지별 override를 선택적으로 적용할 수 있습니다. 이식 가능한 앱은 Wippy proxy 및 router API를 사용하여 특정 엔진에 동작이 의존하지 않게 합니다.

| 엔진 | 페이지 렌더링 방식 | 격리 | 라우팅 |
|--------|--------------------|-----------|---------|
| **Iframe**(기본값) | `proxy.js`가 주입된 srcdoc `<iframe>` | 완전한 문서 격리 | Memory history만 사용(srcdoc에는 실제 URL이 없음) |
| **Web Fragment** | `proxy-fragment.js`와 함께 `<web-fragment>` shadow root에 반영되는 [`reframed`](https://web-fragments.dev) same-origin realm | realm 격리, 공유 DOM tree | 실제 `window.history`(URL router 동작) |

두 엔진 모두 이식 가능한 앱이 사용하는 Wippy 애플리케이션 서비스를 지원합니다. 인증 API, WebSocket, 호스트 중재 상태, confirm/bridge dialog, `@history`/`@visibility` event, title 전파, 오류 캡처, 플랫폼 CSS 및 테마 전달, content 모드 자동 높이, 중첩 `<w-artifact>` 삽입이 포함됩니다. 전달과 제어는 엔진별입니다. iframe CSS와 오류 캡처는 proxy 주입 flag를 따르지만 Fragment gateway는 플랫폼 CSS와 오류 캡처를 조건 없이 설치합니다. [CSS 주입](./css-injection.md)을 참고하십시오. 브라우저 history capability도 표와 같이 다릅니다.

두 엔진 모두에서 실행할 수 있는 앱에는 `@wippy-fe/router`의 `createAppRouter()`를 사용합니다. 현재 factory는 memory history를 사용하고 `AppConfig.context.route`에서 초기 경로를 받으며 `@history`를 통해 호스트와 동기화합니다. 직접 만든 `createWebHistory()` router는 Fragment 전용이며 iframe이나 iframe으로 fallback할 수 있는 `auto` 배포에 이식 가능하지 않습니다.

## Fragment 렌더링 방식

Fragment 엔진으로 선택된 `view.page`는 `<web-fragment src="/@fragment/{id}/">`로 마운트됩니다. `wippy/views`의 [`/@fragment` gateway](../../framework/views.md#웹-프래그먼트-게이트웨이)가 reframing 계약을 제공합니다. `reframed` client는 숨겨진 same-origin realm iframe(`wf:<id>`)을 만들고 gateway의 변환 HTML을 Fragment shadow root로 stream하며, realm 안에서 `proxy-fragment.js`(`@wippy-fe/proxy` adapter)를 실행해 `$W` proxy API를 제공합니다. adapter는 realm의 patched `window.parent`에 의존하지 않고 공유 `postMessage` 프로토콜을 캡처된 same-origin Host window로 전달합니다.

iframe 엔진에서 같은 페이지는 `proxy.js`가 주입된 srcdoc `<iframe>`입니다. [Proxy 및 격리](./proxy-isolation.md)를 참고하십시오.

## 엔진 선택

### 전역 switch(운영자)

전체 배포의 엔진은 facade `render_engine` 요구사항 → `hostConfig.renderEngine`입니다. 기본값은 `iframe`이고 정확한 문자열 `fragment`만 Fragment 엔진을 선택합니다. 오타를 포함한 다른 값은 `iframe`으로 취급됩니다.

```bash
wippy run -c -o wippy.facade:render_engine:default=fragment
```

parameter 설명은 [Facade → 렌더 엔진](../../framework/facade.md#render-engine)을 참고하십시오.

### 페이지별 override(앱 작성자)

페이지는 `package.json`의 `wippy` 블록에 있는 `wippy.renderEngine`으로 opt-in 또는 opt-out합니다.

| 값 | 동작 |
|-------|----------|
| `"auto"`(기본값) | 전역 switch를 따름 |
| `"iframe"` | switch와 관계없이 항상 srcdoc iframe으로 렌더링해 Fragment를 사용하지 않음 |
| `"fragment"` | Fragment 엔진을 우선. 전역 `fragment` 배포에서는 항상 사용. 전역 `iframe` 배포에서는 런타임 **기능 탐색**(세션별로 캐시되는 `GET /@fragment/{id}/`)이 게이트웨이와 프록시가 있음을 확인할 때만 사용하고, 그렇지 않으면 안전하게 iframe으로 대체 |

[마이크로 프런트엔드 앱 → 렌더 엔진](../frontend-registry/view-page.md#렌더-엔진)을 참고하십시오.

## Fragment 제한

일부 브라우저 API는 reframed realm 안에서 **잘못 동작하면서도 오류를 내지 않습니다.** 다음에 의존하는 페이지는 `wippy.renderEngine: "iframe"`으로 고정해야 합니다.

| API / 기능 | realm에서의 동작 | 영향 |
|---------------|---------------------|--------|
| `document.elementFromPoint` | 패널 크기와 **관계없이** `null` 반환 | pointer hit-testing 중단: drag & drop, sortable list, Popper/floating-ui, virtual scroller |
| `matchMedia`, `vh`/`vw` 단위, `position: fixed` | Fragment 패널이 아니라 **호스트** viewport를 기준으로 해석 | 전체 크기 패널에서 약 1px 오차, 작은 패널(sidebar/modal)에서는 실질적으로 잘못됨 |
| `window.scrollX/Y`, `scrollTo` | 항상 `0`인 숨겨진 realm window를 대상으로 함 | 스크롤 기반 UI가 잘못된 geometry를 읽음 |
| Web Workers, Canvas, WebGL, WASM | **정상 동작** | — |

`vh`/`vw`와 `matchMedia`가 이 목록에 있는 이유는 **window**를 질의하기 때문입니다. 할당된 *surface*를 기준으로 크기를 정하는 앱, 즉 `wippy-surface`의 container query와 `--wippy-surface-*` 변수를 사용하는 앱은 두 엔진에서 동일하게 해석되며 고정할 필요가 없습니다. 기존 앱 변환법은 [Surface 이식성](../micro-frontends/surface-portability.md)과 [Surface 마이그레이션](../micro-frontends/surface-migration.md)을 참고하십시오. `position: fixed`와 `elementFromPoint`에는 이식 가능한 형태가 없으므로 실제로 iframe 고정 사유입니다.

다음 두 detector가 작성 시점에 이를 드러냅니다. detector는 배포 실수가 아니라 *앱 코드 비호환성*을 탐지합니다.

- **빌드 시점**(`@wippy-fe/vite-plugin`): 페이지 소스를 검사하고 API 이름과 `wippy.renderEngine: "iframe"` 제안을 담은 빌드 **warning**을 냅니다.
- **개발 런타임**(Fragment proxy, DEV 전용): 해당 API를 patch하여 실제 호출 시 한 번 `console.warn`합니다.

## Fragment 활성화 요약

소비 애플리케이션에서 Fragment 엔진을 활성화하려면 호환되는 framework 모듈과 운영자 switch가 필요합니다. 추가 router 또는 parameter 연결은 필요 없습니다.

1. **Framework 모듈** — `render_engine` switch와 self-mounting Fragment gateway를 노출하는 현재 호환 `wippy/facade` 및 `wippy/views` 조합을 사용합니다. 현재 Wippy 모듈 문서에서 정확한 릴리스를 확인하십시오.
2. **Switch** — facade `render_engine`을 전역 `fragment`로 설정하거나 페이지별 `wippy.renderEngine`으로 opt-in합니다.

> `/@fragment` 게이트웨이는 현재 `wippy/views`가 직접 제공합니다. 모듈이 자체 최상위 라우터를 선언하고 기본값이 `app:gateway`인 `server` 요구사항에 연결합니다. 소비자는 Fragment 연결을 추가할 필요가 없고 Fragment 활성화 여부와 관계없이 iframe 엔진으로 정상 부팅합니다. `http.service` ID가 `app:gateway`와 다를 때만 `server` 매개변수를 재정의합니다. 전체가 iframe인 배포에서 페이지별로 Fragment를 선택하면 런타임 기능 검사가 게이트웨이와 `proxy-fragment.js`를 확인한 후 전환하며, 그렇지 않으면 iframe을 유지합니다. 전체 `render_engine: fragment` 전환은 운영자를 신뢰하며 별도로 검사하지 않습니다. [Views → Web Fragment 게이트웨이](../../framework/views.md#웹-프래그먼트-게이트웨이)를 참고하십시오.

프런트엔드 앱 자체에는 Fragment 전용 코드가 필요 없습니다. `proxy-fragment.js`는 앱이 번들하는 것이 아니라 CDN에서 제공되는 호스트 아티팩트입니다.

## 함께 보기

- [Facade](../../framework/facade.md) — `render_engine` 운영자 switch와 `hostConfig.renderEngine`
- [Views](../../framework/views.md) — self-mounting `/@fragment` gateway와 `server` binding
- [마이크로 프런트엔드 앱(view.page)](../frontend-registry/view-page.md) — 페이지별 `wippy.renderEngine` 필드
- [Proxy 및 격리](./proxy-isolation.md) — 공유 proxy API(두 엔진 모두)와 iframe 엔진
- [Web Host 개요](./overview.md) — 호스트가 페이지를 불러오고 렌더링하는 방식
