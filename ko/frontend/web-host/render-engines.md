# 렌더 엔진

Wippy Web Host는 마이크로 프런트엔드 앱(`view.page`)을 **두 가지 페이지 렌더 엔진** 중 하나로 렌더링합니다. 엔진은 운영자 스위치로 선택하는 전달 관심사이며, 페이지 단위 오버라이드를 선택적으로 지원합니다. 이식 가능한 앱은 Wippy proxy와 router API를 사용하므로 동작이 특정 엔진에 의존하지 않습니다.

| 엔진 | 페이지 렌더 방식 | 격리 | 라우팅 |
|--------|--------------------|-----------|---------|
| **Iframe** (기본값) | `proxy.js`가 주입된 srcdoc `<iframe>` | 완전한 문서 격리 | 메모리 히스토리만 (srcdoc에는 실제 URL이 없음) |
| **Web Fragment** | `proxy-fragment.js`와 함께 `<web-fragment>` shadow root로 반영되는 [`reframed`](https://web-fragments.dev) 동일 출처 realm | realm 격리, DOM 트리 공유 | 실제 `window.history` (URL 라우터 동작) |

두 엔진 모두 동일한 Wippy 애플리케이션 서비스를 제공합니다: 인증된 API, WebSocket, 호스트가 중개하는 상태, confirm/bridge 다이얼로그, `@history`/`@visibility` 이벤트, 타이틀 전파, 전역 오류 캡처, 호스트 CSS + 테마 주입(shadow 내부 다크 모드 포함), 콘텐츠 모드 자동 높이, 중첩된 `<w-artifact>` 임베드. 브라우저 히스토리 기능은 표에 나온 대로 의도적으로 다릅니다.

두 엔진 중 어느 쪽에서도 실행될 수 있는 앱에는 `@wippy-fe/router`의 `createAppRouter()`를 사용하십시오. 현재 팩토리는 메모리 히스토리를 사용하고, 초기 라우트를 `AppConfig.context.route`에서 받으며, `@history`를 통해 호스트와 동기화합니다. `createWebHistory()`를 직접 쓰는 라우터는 Fragment 전용이며, iframe으로 폴백될 수 있는 iframe 또는 `auto` 배포에는 이식되지 않습니다.

## 프래그먼트가 렌더링되는 방식

프래그먼트 엔진으로 선택된 `view.page`는 `<web-fragment src="/@fragment/{id}/">`로 마운트됩니다. `wippy/views`의 [`/@fragment` 게이트웨이](../../framework/views.md#web-fragments-gateway)가 reframing 계약을 서빙합니다. `reframed` 클라이언트는 숨겨진 동일 출처 realm iframe(`wf:<id>`)을 만들고, 게이트웨이가 변환한 HTML을 프래그먼트의 shadow root로 스트리밍하며, realm 내부에서 `proxy-fragment.js`(`@wippy-fe/proxy` 어댑터)를 실행해 `$W` 프록시 API를 제공합니다. realm이 호스트와 동일 출처이므로 프록시는 `postMessage`가 아니라 호스트와 직접 통신합니다.

동일한 페이지를 iframe 엔진에서 실행하면 `proxy.js`가 주입된 srcdoc `<iframe>`이 됩니다. [프록시와 격리](./proxy-isolation.md)를 참고하십시오.

## 엔진 선택

### 전역 스위치 (운영자)

배포 전체의 엔진은 파사드 `render_engine` requirement → `hostConfig.renderEngine`입니다. 기본값은 `iframe`이며, 정확히 `fragment` 문자열일 때만 배포가 프래그먼트 엔진을 사용합니다(오타를 포함한 다른 모든 값은 `iframe`으로 처리됩니다).

```bash
wippy run -c -o wippy.facade:render_engine:default=fragment
```

파라미터는 [파사드 → 렌더 엔진](../../framework/facade.md#render-engine)을 참고하십시오.

### 페이지 단위 오버라이드 (앱 작성자)

페이지는 `package.json`의 `wippy` 블록에 있는 `wippy.renderEngine`으로 참여하거나 빠집니다:

| 값 | 동작 |
|-------|----------|
| `"auto"` (기본값) | 전역 스위치를 따릅니다. |
| `"iframe"` | 항상 srcdoc iframe으로 렌더링합니다. 스위치와 무관하게 프래그먼트에서 빠집니다. |
| `"fragment"` | 프래그먼트 엔진을 선호합니다. 전역 `fragment` 배포에서는 항상 사용합니다. 전역 `iframe` 배포에서는 런타임 **케이퍼빌리티 프로브**(`GET /@fragment/{id}/`, 세션 단위 캐시)가 게이트웨이와 프록시의 존재를 확인한 경우에만 사용하고, 그렇지 않으면 iframe으로 폴백합니다(페일 세이프). |

[마이크로 프런트엔드 앱 → 렌더 엔진](../frontend-registry/view-page.md#render-engine)을 참고하십시오.

## 프래그먼트 제약

일부 브라우저 API는 reframed realm 내부에서 **잘못되게, 그리고 조용히** 동작합니다. 이러한 API에 의존하는 페이지는 `wippy.renderEngine: "iframe"`으로 고정해야 합니다.

| API / 기능 | realm에서의 동작 | 영향 |
|---------------|---------------------|--------|
| `document.elementFromPoint` | **패널 크기와 무관하게** `null`을 반환 | 포인터 히트 테스트 손상: 드래그 앤 드롭, 정렬 가능한 리스트, Popper/floating-ui, 가상 스크롤러 |
| `matchMedia`, `vh`/`vw` 단위, `position: fixed` | 프래그먼트 패널이 아니라 **호스트** 뷰포트를 기준으로 해석 | 전체 크기 패널에서는 약 1px 차이, 작은 패널(사이드바/모달)에서는 실질적으로 잘못됨 |
| `window.scrollX/Y`, `scrollTo` | 숨겨진 realm 윈도를 대상으로 함(항상 `0`) | 스크롤 기반 UI가 잘못된 지오메트리를 읽음 |
| Web Worker, Canvas, WebGL, WASM | **정상 동작** | — |

`vh`/`vw`와 `matchMedia`가 여기 등장하는 이유는 이들이 **윈도**에 대해 묻기 때문입니다. 대신 자신에게 할당된 *서피스*를 기준으로 크기를 정하는 앱, 즉 `wippy-surface`에 대한 컨테이너 쿼리와 `--wippy-surface-*` 변수를 사용하는 앱은 두 엔진에서 동일하게 해석되며 고정이 필요 없습니다. [서피스 이식성](../micro-frontends/surface-portability.md)을 참고하고, 기존 앱을 변환하려면 [서피스 마이그레이션](../micro-frontends/surface-migration.md)을 참고하십시오. `position: fixed`와 `elementFromPoint`는 이식 가능한 형태가 없으며 고정할 진짜 이유로 남습니다.

두 개의 검출기가 작성 시점에 이를 드러냅니다(이들은 배포 실수가 아니라 *앱 코드의 비호환성*을 검출합니다):

- **빌드 타임** (`@wippy-fe/vite-plugin`): 페이지 소스를 스캔해 해당 API를 지목하고 `wippy.renderEngine: "iframe"`을 제안하는 빌드 **경고**를 냅니다.
- **개발 런타임** (프래그먼트 프록시, DEV 전용): 해당 API에 패치를 적용해 실제 호출 시 한 번 `console.warn`을 출력합니다.

## 프래그먼트 활성화 — 설정 요약

소비 앱에서 프래그먼트 엔진을 활성화하려면 최신 프레임워크 모듈과 운영자 스위치가 필요하며, 라우터나 파라미터 배선은 필요하지 않습니다:

1. **프레임워크 모듈** — `render_engine` 스위치와 자체 마운트되는 프래그먼트 게이트웨이를 노출하는 호환 가능한 최신 `wippy/facade`와 `wippy/views` 조합을 사용합니다. 정확한 릴리스는 최신 Wippy 모듈 문서에서 확인하십시오.
2. **스위치** — 파사드 `render_engine`을 `fragment`로 설정(전역)하거나, `wippy.renderEngine`으로 페이지 단위로 참여시킵니다.

> `/@fragment` 게이트웨이는 최신 `wippy/views`가 스스로 제공합니다. 모듈이 자체 최상위 라우터를 선언하고 이를 기본값 `app:gateway`인 `server` requirement에 바인딩합니다. 소비자는 프래그먼트 배선이 필요 없으며, 프래그먼트 활성화 여부와 무관하게 iframe 엔진으로 정상 부팅합니다. `http.service` id가 `app:gateway`와 다를 때만 `server` 파라미터를 오버라이드하십시오. 그 외에는 iframe인 배포에서 페이지가 페이지 단위로 프래그먼트에 참여하면, 런타임 케이퍼빌리티 프로브가 게이트웨이와 `proxy-fragment.js`를 확인한 뒤 전환하고, 확인되지 않으면 iframe 엔진에 머무릅니다. 전역 `render_engine: fragment` 스위치는 운영자를 신뢰하며 프로브하지 않습니다. [Views → Web Fragments 게이트웨이](../../framework/views.md#web-fragments-gateway)를 참고하십시오.

프런트엔드 앱 자체에는 프래그먼트 전용 코드가 필요 없습니다. `proxy-fragment.js`는 CDN에서 서빙되는 호스트 아티팩트이며 앱이 번들링하는 대상이 아닙니다.

## 함께 보기

- [파사드](../../framework/facade.md) — `render_engine` 운영자 스위치와 `hostConfig.renderEngine`
- [Views](../../framework/views.md) — 자체 마운트되는 `/@fragment` 게이트웨이와 그 `server` 바인딩
- [마이크로 프런트엔드 앱 (view.page)](../frontend-registry/view-page.md) — 페이지 단위 `wippy.renderEngine` 필드
- [프록시와 격리](./proxy-isolation.md) — 공유 프록시 API(두 엔진 공통)와 iframe 엔진
- [Web Host 개요](./overview.md) — 호스트가 페이지를 로드하고 렌더링하는 방식
