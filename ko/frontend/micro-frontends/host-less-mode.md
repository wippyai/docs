---
title: "호스트 없는 모드"
description: "Wippy Web Host 없이 Wippy 마이크로 프런트엔드 앱과 웹 컴포넌트를 실행하고 테스트합니다."
---

# 호스트 없는 모드

호스트 없는 모드에서는 Wippy Web Host가 감싸지 않아도 Wippy 마이크로 프런트엔드 앱 또는 웹 컴포넌트를 빌드하고 실행하고 테스트할 수 있습니다.

> **기본 주입 상태:** 개발 오버레이는 `themeConfig`, `primevue`, `markdown`, `iframe`을 **비활성화**하고 `customCss`, `customVariables`를 **활성화**한 상태로 시작합니다. 따라서 커스텀 재정의에만 의존하는 앱은 작동하는 것처럼 보이지만 플랫폼 테마 변수나 PrimeVue 스타일을 기대하는 앱은 해당 주입을 활성화하기 전까지 스타일 없이 렌더링됩니다. 오버레이 FAB를 열고 필요한 주입을 켠 다음 다시 로드해도 유지하려면 "Auto-accept on reload"를 선택하세요.

---

## 목차

- [개념 모델 — 앱과 WC는 의도적으로 독립 실행을 인식함](#개념-모델-앱과-wc는-의도적으로-독립-실행을-인식함)
- [`@wippy/scripts` 전환점 — 태그 하나, 부팅 경로 둘](#wippyscripts-전환점-태그-하나-부팅-경로-둘)
- [`dev-proxy.js`가 실제로 하는 일](#dev-proxyjs가-실제로-하는-일)
- [개발 오버레이(설정 모달)](#개발-오버레이설정-모달)
- [호스트 스텁 — 독립 실행 `host` API](#호스트-스텁-독립-실행-host-api)
- [웹 컴포넌트 — 호스트 없는 플레이그라운드와 테스트](#웹-컴포넌트-호스트-없는-플레이그라운드와-테스트)
- [일반적인 이탈과 발견 방법](#일반적인-이탈과-발견-방법)
- [문제 해결](#문제-해결)
- [관련 문서](#관련-문서)

---

## 개념 모델 — 앱과 WC는 의도적으로 독립 실행을 인식함

모든 Wippy 마이크로 프런트엔드 앱과 웹 컴포넌트는 하나의 런타임 제약을 따릅니다.

> **런타임 계약은 프록시 API 표면입니다.**

실제로는 다음을 의미합니다.

- 앱 또는 WC가 런타임에 접근하는 것은 `@wippy-fe/proxy`에서 가져온 동기 getter(`host`, `api`, `on`, `config`, `state`, `ws`, `logger`)인 프록시 API 표면뿐입니다. 앱과 WC는 같은 import를 사용하고 내부적으로 런타임이 내부 전역으로 설치한 동일한 `ProxyApiInstance`로 해석됩니다(`window.$W`, `window.__WIPPY_APP_API__`는 직접 읽지 마세요).
- 앱과 WC는 이웃 앱, 부모 모듈의 Lua 부분, Wippy Web Host 또는 다른 프로젝트 모듈의 코드를 import하지 않습니다. 자체 폴더에 존재합니다. Vite는 고정된 대상 호스트 `import-map.json`에서 모든 Rollup external을 가져오며, `package.json`에는 아티팩트가 실제로 import하는 npm 의존성과 peer 루트만 선언합니다.
- 같은 `app.ts` 또는 WC `index.ts`가 두 환경에서 올바르게 부팅됩니다.
  1. **호스팅:** `proxy.js`, AppConfig, importmap, CSS를 주입하는 Wippy Web Host 안
  2. **호스트 없음:** Vite 개발 서버, 단위 테스트 페이지, Storybook 계열 플레이그라운드 또는 다른 HTTP 개발 호스트를 통해 `app.html` 실행

각 앱 또는 WC는 표준화된 I/O 표면을 가진 작은 프로그램입니다. 호스트는 가능한 런타임 중 하나이고 독립 실행은 또 다른 런타임입니다. 애플리케이션 코드에서 둘을 구분할 필요가 없습니다.

이 설계는 다음을 지원합니다.

- 전체 Wippy 백엔드를 시작하지 않는 로컬 프런트엔드 반복 개발
- Vitest와 jsdom에서 격리된 WC 단위 테스트
- Wippy 모듈 간 앱 공유. 어느 모듈이 제공하든 모든 마이크로 프런트엔드 앱과 웹 컴포넌트가 같은 도구 체인으로 빌드됩니다.
- 프런트엔드 번들을 다시 빌드하지 않고 운영자가 메타데이터(테마, import map, 환경)를 패치하는 고객별 오버레이

---

## `@wippy/scripts` 전환점 — 태그 하나, 부팅 경로 둘

모든 정식 앱의 `app.html`에는 로드 시 부팅 경로를 결정하는 스크립트 태그가 **하나** 있습니다.

다음은 축약된 body/부팅 예제입니다. 고정 Web Host 태그가 바뀌면 함께 갱신하여 [Import-map 스냅샷 알고리즘](./build-system.md#import-map-스냅샷-알고리즘)에 설명된 완전하고 유효한 import-map 응답을 삽입하세요.

```html
<!-- URL MUST include a release-tag segment: https://web-host.wippy.ai/<release-tag>/dev-proxy.js -->
<script
    src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"
    data-role="@wippy/scripts"
></script>
```

전체 `app.html` 스캐폴드는 [마이크로 프런트엔드 앱](./micro-frontend-app.md)에 있습니다.

이 태그의 두 속성이 전체 이중 모드 계약을 전달합니다.

| 속성 | 역할 | 사용자 |
|---|---|---|
| `data-role="@wippy/scripts"` | 호스트용 마커입니다. 이 값이 있으면 호스트가 iframe을 제공하기 전 이 `<script>` 엘리먼트를 제거하고 그 위치보다 앞에 자체 `loading.js`, `proxy.js`, importmap, AppConfig를 주입합니다. 호스팅 모드에서는 엘리먼트가 사라집니다. | Wippy Web Host |
| `src="…/dev-proxy.js"` | 호스트가 없을 때 사용하는 대체 URL입니다. 브라우저가 `dev-proxy.js`를 직접 로드하면 이 스크립트가 페이지를 부팅합니다. 호스팅 모드에서는 `<script>` 자체가 없어지므로 `src=` 속성이 무관합니다. | 독립 브라우저 로드 |

**환경에 맞는 URL을 선택하세요.** Web Host URL 경로에는 릴리스 태그 세그먼트가 필요하며 facade의 `fe_facade_url`이 사용하는 릴리스와 일치해야 합니다. 호스트 루트 바로 아래의 `/dev-proxy.js`는 유효하지 않습니다. `/<release-tag>/dev-proxy.js`의 특정 빌드에 고정하세요. 같은 번들을 로컬 반복 개발, CI, 공유 가능한 미리 보기 링크에 사용할 수 있습니다.

| 환경 | `src=` 예시 값 |
|---|---|
| 공개 CDN(표준) | `https://web-host.wippy.ai/<release-tag>/dev-proxy.js` |
| 자체 호스팅 Wippy 배포 | `https://<your-wippy-host>/<release-tag>/dev-proxy.js` |

같은 HTML 엘리먼트가 호스트의 스크립트 주입 앵커이자 호스트 없는 대체 부팅입니다.

### importmap에는 무엇이 들어가는가?

`fe_facade_url` 및 `dev-proxy.js`와 같은 태그를 사용해 개발 중 전체 맵을 한 번 가져옵니다.

```bash
curl.exe -fsS "https://web-host.wippy.ai/<release-tag>/import-map.json" -o import-map.json
```

`app.html`의 `<script type="importmap">` 엘리먼트 텍스트를 가져온 JSON 응답 그대로 설정합니다. JSON 안에 주석, 생략 자리표시자 또는 수동 대체값을 넣지 마세요. [빌드 및 의존성 계약](./build-system.md#import-map-스냅샷-알고리즘)이 스냅샷과 출처 요구 사항을 정의하고, 가져온 릴리스 응답이 정확한 `imports` 객체를 제공합니다.

규칙은 다음과 같습니다.

- 현재 사용하지 않는 키를 포함해 **가져온 모든 키**를 Rollup external에 둡니다.
- 동일한 전체 키/값 객체를 `app.html`에 유지하고 `esm.sh`로 재구성하지 않습니다.
- import한 지정자의 정확한 키가 없을 때만 번들에 포함합니다.
- Web Host 태그가 바뀌거나 새 의존성을 추가하면 그 정확한 지정자를 external로 둘 수 있는지 확인하기 위해 다시 가져옵니다.

독립 실행 `app.html`은 복사한 전체 맵을 해석합니다. 호스팅 모드는 같은 고정 릴리스가 전달한 맵을 사용합니다.

### package.json을 dev-proxy에 노출하기(정식 스캐폴드)

모든 Wippy 앱의 `package.json`에는 프록시 주입(`wippy.proxy.injections.css.*`), 페이지별 테마 재정의(`wippy.configOverrides.customization`), Iconify 아이콘 모음 등 런타임 기본값을 결정하는 메타데이터가 있습니다. 호스팅 모드에서는 호스트가 레지스트리에서 이를 읽습니다. 호스트 없는 모드에서는 dev-proxy가 같은 기본값을 적용하려면 같은 데이터가 필요합니다.

정식 패턴은 일관된 현재 `@wippy-fe/vite-plugin` 계열(게시 시점 `0.0.56`)의 `wippyPagePlugin()`을 `vite.config.ts`에 한 번 추가하는 것입니다. 플러그인은 빌드 시 `package.json`을 읽고 두 가지 작업을 수행합니다.

1. `wippy` 블록의 **`file://` 참조를 해석**합니다. `"file://<relative>"` 형태의 문자열 값을 참조 파일의 UTF-8 내용으로 바꿉니다. [build-system.md](./build-system.md)의 `*.do-not-link.<ext>` 이름 규칙을 참조하세요.
2. 해석된 JSON으로 **출력 두 개를 생성**합니다.
   - 호스트 없는/dev-proxy 부팅을 위해 `<head>`에 주입되는 `<script type="application/json" data-role="@wippy/package">`
   - wippy 호스팅 모드를 위해 실제 Vite 출력 디렉터리에 생성되는 `wippy-meta.json`

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default defineConfig({
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
  // …
})
```

HTML 진입이 없는 ESM 전용 **웹 컴포넌트**(`view.component`)에는 같은 패키지의 `wippyComponentPlugin()`을 사용합니다. 실제 출력 디렉터리에 `wippy-meta.json`만 만들며 `transformIndexHtml` 단계는 없습니다.

```ts
// vite.config.ts for a web component
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
export default defineConfig({ plugins: [wippyComponentPlugin()] })
```

> `wippyPackagePlugin`은 더 이상 권장하지 않는 호환성 별칭으로 남아 있습니다. 새 페이지 코드는 `wippyPagePlugin()`을 사용하고 컴포넌트 전용 빌드는 `wippyComponentPlugin()`을 사용합니다.

플러그인은 빌드된 `app.html`의 `<head>` 맨 위에 다음을 출력합니다.

```html
<script type="application/json" data-role="@wippy/package">
{ "name": "@wippy/your-app", "version": "1.0.0", "wippy": { "proxy": {...}, "configOverrides": {...} } }
</script>
```

dev-proxy.js는 부팅 시 `document.querySelector('script[data-role="@wippy/package"]')`로 이를 동기식으로 읽고, `wippy.proxy.injections`로 프록시 설정 기본값을 초기화하며 `wippy.configOverrides.customization`으로 `appConfig.theming.global`을 초기화합니다. 데이터 역할 문자열 `@wippy/package`는 `@wippy-fe/shared`에서 `WIPPY_PACKAGE_DATA_ROLE`로 내보내 양쪽 경계가 같은 상수를 공유합니다.

이 형태는 다음 특성을 갖습니다.

- **단일 소스:** 플러그인이 빌드 시 `package.json`을 읽고 소스 파일은 이를 import하지 않습니다.
- **동기식 접근:** 애플리케이션 코드가 실행되기 전에 dev-proxy.js가 인라인 메타데이터를 사용할 수 있습니다.
- **정의된 순서:** 플러그인이 모든 스크립트 태그보다 앞인 `<head>` 위쪽에 메타데이터를 주입합니다. Dev-proxy는 동기 UMD 스크립트이고 모듈 스크립트는 지연됩니다.
- **플러그인 소유 템플릿 업데이트:** `app.html`의 수동 관리 블록 없이 플러그인이 메타데이터를 주입합니다.
- **공유 상수:** `@wippy-fe/shared`가 `'@wippy/package'` 값을 `WIPPY_PACKAGE_DATA_ROLE`로 내보내고 dev-proxy와 플러그인이 이를 가져옵니다.
- **호스팅 호환성:** 호스팅 처리는 레지스트리 서버 측에서 패키지 메타데이터를 읽습니다. 인라인 JSON 태그는 독립 개발 경로에서만 사용되고 그 외에는 비활성입니다.

Dev-proxy는 `resolveDevConfig()` 중 JSON을 읽어 개발 오버레이 기본값을 채웁니다. 스크립트 태그가 없으면 `getDefaultProxyConfig()`로 대체하므로 이전 앱은 일반 기본값으로 계속 작동합니다.

> **런타임 `window` 전역 대신 플러그인을 쓰는 이유:** Dev-proxy.js는 `<head>` 파싱 초기에 모듈 스크립트보다 먼저 실행되는 비모듈 동기 스크립트입니다. 따라서 `app.ts`는 dev-proxy가 읽기 **전에** 전역을 설정할 수 없습니다. 빌드 시점 HTML 변환은 dev-proxy가 실행되는 즉시 사용할 수 있도록 데이터를 DOM에 미리 배치합니다.

> **태그가 하나인 이유:** 두 번째 `<script>` 블록(예: `if (!window.__WIPPY__) load dev-proxy`)은 호스트 주입이 끝난 뒤에야 실행됩니다. 마커가 사라지면 조건문을 연결할 곳도 없습니다. 단일 태그 패턴에서는 마커가 소스 HTML에 항상 있고 호스트 작업은 정확히 "이 마커를 지우고 교체"입니다. 아무도 지우지 않았을 때가 곧 독립 실행입니다.

호스트 계약은 `wippy.path`로 지정된 HTML 파일에 추가 스크립트를 주입할 `<script data-role="@wippy/scripts">` 엘리먼트가 있기를 요구합니다. `data-role` 마커가 선택자이며 고전 스크립트가 HTML 기본값이므로 `type="text/javascript"`는 선택 사항입니다.

정식 앱 템플릿에는 `src="…/dev-proxy.js"` 값이 있습니다. 애플리케이션이 호스트 없이 실행될 수 없고 그 제한을 기록한 경우가 아니라면 **`src=` 대체값을 포함하세요.**

---

## `dev-proxy.js`가 실제로 하는 일

`dev-proxy.js`는 `https://web-host.wippy.ai/<release-tag>/dev-proxy.js`에서 제공되는 호스트 없는 부팅 번들입니다.

호스트 없이도 실제 호스트가 설치할 내부 전역(`window.$W`, `window.__WIPPY_APP_API__`)을 설치해 `@wippy-fe/proxy` getter가 올바르게 해석되도록 합니다. 앱과 WC 코드는 이 전역을 만지지 않고 `@wippy-fe/proxy`에서 가져오기만 하면 getter가 작동합니다. 대략 다음 다섯 단계로 처리합니다.

1. **히스토리 가드 설치**(`installHistoryGuard()`) — iframe-srcdoc 컨텍스트 밖에서 vue-router가 브라우저 히스토리를 변경하지 않도록 `pushState`/`replaceState`를 스텁 처리합니다.
2. **설정 해석**(`src/proxy/dev/resolve-dev.ts`의 `resolveDevConfig()`):
   - `localStorage['@wippy-dev/config']` 및 `localStorage['@wippy-dev/proxy-config']`을 읽습니다.
   - `localStorage['@wippy-dev/auto-accept'] === 'true'`이고 저장 설정이 있으면 즉시 사용하고 오버레이를 모니터링 모드로 렌더링합니다.
   - 그 외에는 오버레이를 *대기* 모드로 렌더링하고(FAB가 파란색으로 깜빡이고 "Accept config to continue loading" 말풍선 표시) 개발자가 Accept를 누를 때까지 부팅을 막습니다.
3. 다음에 연결된 가짜 `ProxyApiInstance`를 **구축**합니다.
   - 수락된 `ChildAppConfig`(`@wippy-fe/proxy`의 `config`가 반환)
   - `on(...)` 구독과 `@history`/`@visibility` 시뮬레이션용 nanoevents emitter
   - 모든 메서드를 콘솔에 기록하는 `host` 스텁(`src/proxy/dev/host-stubs.ts`의 `createDevHostAPI()`)
   - 개발자가 입력한 URL을 대상으로 설정한 `@wippy-fe/proxy`의 `api`를 지원하는 실제 axios 인스턴스(`env.APP_API_URL` 기본값은 `${location.origin}/api`)
   - 표준 logger와 프로덕션 형태의 state 및 WebSocket 호스트 메시지 브리지. 실제 호스트 응답자가 없으면 응답이 필요한 호출은 완료될 수 없고 아래 설명한 독립 스텁 계층은 `host` API에만 제공됩니다.
4. 개발자가 선택한 프록시 설정을 바탕으로 **CSS 주입**을 적용합니다.
   - `themeConfig: true` → `@wippy-fe/theme`의 `theme-config.css` 주입
   - `iframe`, `primevue`, `markdown` → `src/proxy/dev/css-inline.ts`의 해당 인라인 CSS 번들 주입
   - `customCss`/`customVariables` → `appConfig.theming.global.customCSS`/`cssVariables` 적용([마이크로 프런트엔드 앱 테마](./micro-frontend-app-theming.md#l3-per-page-config_overrides-in-registry-yaml)의 `@dark`/`@light` 블록 포함)
5. `entry.iframe.ts`와 같은 형태로 **내부 프록시 전역을 설치**하여 `@wippy-fe/proxy` getter(`config`, `host`, `api`, `on`, `logger`, `state`, `ws`, `loadWebComponent`)가 해석되게 합니다. `@wippy-fe/proxy`에서 가져오는 모든 앱 또는 WC 코드는 변경 없이 작동합니다. `window.$W` 등의 전역 자체는 내부 항목입니다. [프록시 및 격리의 내부 항목](../web-host/proxy-isolation.md#내부-전용-읽거나-재정의하지-않기)을 참조하세요.

`config-store.ts`의 `getDefaultConfig()`가 제공하는 기본 `ChildAppConfig`는 다음과 같습니다.

```ts
{
  $schema: '<built schema URL>',
  auth: { token: 'dev-token', expiresAt: '' },
  env: {
    APP_API_URL: `${location.origin}/api`,
    APP_AUTH_API_URL: `${location.origin}/api`,
    APP_WEBSOCKET_URL: `${location.origin.replace(/^http/, 'ws')}/ws`,
  },
  theming: { global: {} },
  context: { resourceId: '', resourceType: 'page' },
}
```

모달 또는 `localStorage['@wippy-dev/config']` 편집으로 어느 값이든 재정의할 수 있습니다.

---

## 개발 오버레이(설정 모달)

개발 오버레이는 다음을 렌더링하는 Shadow DOM 웹 컴포넌트(`<wippy-dev-overlay>`)입니다.

- 오른쪽 아래의 FAB(플로팅 액션 버튼). 클릭 전까지 보이는 유일한 어포던스입니다.
- 대기 모드의 **말풍선:** "Accept config to continue loading."
- FAB 클릭 시 열리는 **패널**. 다음 세 섹션이 있습니다.
  - **Monitor:** 현재 경로, 문서 제목, 뷰포트 크기의 실시간 표시. 앱이 데이터를 다시 가져올 수 있도록 `@visibility(true)`를 발생시키는 "Trigger Refresh" 버튼
  - **Configuration(접기 가능):**
    - `App Config (JSON)` — 편집 가능한 전체 `ChildAppConfig` JSON. Accept 시 검증
    - `Proxy Injections` — 모든 프록시 주입 플래그(`themeConfig`, `iframe`, `primevue`, `markdown`, `customCss`, `customVariables`, `tailwindConfig`, `resizeObserver`, `preventLinkClicks`, `iconifyIcons`, `refreshWhenVisible`, `historyPolyfill`, `errorCapture`) 체크박스
    - `Options` — "Auto-accept on reload" 체크박스(localStorage에 자동 수락 플래그 작성)
  - **Footer:** Reset(모든 `@wippy-dev/*` localStorage 키 제거), Accept(설정 저장 및 부팅 promise 해석)

`src/proxy/dev/config-store.ts`에 정의된 LocalStorage 키는 다음과 같습니다.

| 키 | 저장 내용 |
|---|---|
| `@wippy-dev/config` | 수락한 `ChildAppConfig` JSON |
| `@wippy-dev/proxy-config` | 수락한 부분 `ProxyConfig`(주입 플래그) |
| `@wippy-dev/auto-accept` | 다시 로드할 때 수동 수락 단계를 건너뛰려면 `'true'` |

자동 수락을 활성화하면 새로 고칠 때 마지막으로 수락한 설정으로 앱이 즉시 부팅됩니다. FAB는 모니터링과 변경을 위해 계속 사용할 수 있습니다.

---

## 호스트 스텁 — 독립 실행 `host` API

`host` API(`import { host } from '@wippy-fe/proxy'`)는 toast 표시, 내비게이션, 세션 열기, 컨텍스트 설정, URL 형식화 등을 호스트에 요청하는 앱 표면입니다. 실제 호스트가 없으면 dev-proxy가 `src/proxy/dev/host-stubs.ts`의 스텁 계층으로 대체합니다.

| 메서드 | 독립 실행 동작 |
|---|---|
| `host.toast(message)` | 콘솔 기록만 |
| `host.confirm({ message })` | 브라우저 `window.confirm()` |
| `host.startChat(token, options)` | 콘솔 기록 |
| `host.openSession(uuid, options)` | 콘솔 기록 |
| `host.openArtifact(uuid, options)` | 콘솔 기록 |
| `host.navigate(url)` | 콘솔 기록 + 자식 라우터가 받도록 `@history` 발생 + 오버레이 경로 표시 업데이트 |
| `host.onRouteChanged(path)` | 콘솔 기록 + 오버레이 경로 표시 업데이트 |
| `host.handleError(code, error)` | `console.error` |
| `host.setContext(context, sessionUUID, source)` | 콘솔 기록 |
| `host.formatUrl(rel)` | `${appConfig.routePrefix || ''}${rel}` 반환 |
| `host.classifyLink(href)` | 실제 구현. 수락 설정의 `mountRoutes`/`routePrefix` 사용 |
| `host.layout.*` | 타입 계약을 만족하는 no-op 스텁 |
| `host.surface` | 독립 실행 `host` 표면 설명자. 너비 0, 콘텐츠 크기, 선택적 표면 기능 없음 보고 |
| `host.bridge.post/on/request` | `post`는 기록, `on`은 no-op 구독, `request`는 브리지를 사용할 수 없어 거부 |
| `host.setThemeMode(mode)`/`host.getThemeMode()` | 선택 모드를 로컬에 저장 및 보고하고 테마 이벤트 발생 |
| `host.logout()` | 콘솔 기록만 |

스텁은 요청된 호스트 부작용을 콘솔에 기록합니다. `host.openSession`이 실제로 세션을 여는 것처럼 애플리케이션 정확성이 부작용에 의존한다면 호스트 아래에서 해당 경로를 테스트하세요. 스텁은 이를 수행하지 않습니다.

---

## 웹 컴포넌트 — 호스트 없는 플레이그라운드와 테스트

웹 컴포넌트도 같은 이중 모드 설계를 공유하지만 iframe 대신 ES 모듈로 로드됩니다. WC의 프록시 계약은 `import { api, host, on, ... } from '@wippy-fe/proxy'`이고 이 import는 실제 프록시 또는 dev-proxy가 설정한 `window.__WIPPY_APP_API__`를 읽어 런타임에 해석됩니다.

### 플레이그라운드/데모 HTML 페이지

```html
<!-- demo.html in your WC project -->
<!DOCTYPE html>
<html>
<head>
    <!-- Required complete import-map script omitted from this abbreviated example. -->
    <script src="https://web-host.wippy.ai/webcomponents-1.0.56/dev-proxy.js" data-role="@wippy/scripts"></script>
</head>
<body>
    <my-component prop1="value"></my-component>
    <script type="module" src="./src/index.ts"></script>
</body>
</html>
```

같은 전환점과 같은 개발 오버레이를 사용합니다. WC의 `index.ts`가 `define(import.meta.url, ...)`을 호출하여 엘리먼트를 자체 등록하고 dev-proxy가 호스트 스텁을 제공합니다.

`dev-proxy.js` 로드에 실패하거나 포함하지 않으면 `entry.web-component.ts`가 다음 명시적 오류를 발생시킵니다.

> `@wippy-fe/proxy: Proxy globals not found. For dev/testing without the Wippy host, add <script src="dev-proxy.js"></script> to your HTML.`

이 오류는 호스트 없는 부팅 스크립트가 누락되었다는 뜻입니다.

### 부분 Vitest/jsdom 테스트 발췌

단위 테스트에는 상호작용할 UI가 없으므로 개발 오버레이가 필요하지 않습니다. 호스트가 붙일 래퍼 객체를 직접 연결해 **호스트 컨텍스트를 모사**합니다.

아래 발췌는 `jsdom` 테스트 환경과 테스트 모듈보다 먼저 로드되는 설정 파일을 가정합니다. 해당 설정은 `window.__WIPPY_APP_API__`와 `window.__WIPPY_APP_CONFIG__`를 스텁 처리해야 하며, `ElementInternals`의 `states`가 없는 jsdom 버전에서는 `CustomStateSet` 표면도 제공해야 합니다. 이는 컴포넌트 수준 어설션이지 완전한 Vitest 프로젝트가 아닙니다.

```ts
import { describe, expect, it } from 'vitest'
import { WippyElement } from '@wippy-fe/webcomponent-core'

class TestEl extends WippyElement {
  static get wippyConfig() {
    return { propsSchema: { properties: {} }, hostCssKeys: [] }
  }
  protected onMount(): void {}
  protected onUnmount(): void {}
}

const TAG = 'wippy-test-el'
customElements.define(TAG, TestEl)

it('reads host wrapper attached by resolver as __wippyHost', () => {
  const el = document.createElement(TAG) as TestEl
  const fakeHost = { layout: { broadcast: () => {} } }
  ;(el as any).__wippyHost = fakeHost
  expect(el.host).toBe(fakeHost)
})
```

`__wippyHost` 속성은 관리형 레이아웃 호스트가 사용하는 계약입니다. API 또는 프록시 전역이 필요한 테스트는 Vitest 설정 파일로 dev-proxy를 마운트하거나 `window.__WIPPY_APP_API__`를 직접 스텁 처리할 수 있습니다.

```ts
// vitest.setup.ts
;(window as any).__WIPPY_APP_API__ = {
  api: mockApi,
  host: mockHost,
  on: mockOn,
  // ...other ProxyApiInstance fields
}
```

두 방식 모두 테스트 소유 코드가 Wippy 서버 대신 프록시 계약을 만족합니다.

---

## 일반적인 이탈과 발견 방법

앱 또는 WC가 독립 실행 인식 계약에서 벗어나면 증상이 예측 가능합니다.

| 증상 | 가능한 원인 | 해결 |
|---|---|---|
| `app.html`에 `src=` 없이 `<script data-role="@wippy/scripts"></script>`만 있음 | Wippy 주입 없이 HTTP 개발 호스트에서 페이지를 부팅할 수 없습니다. 프록시 런타임이 초기화되지 않아 애플리케이션 모듈이 `@wippy-fe/proxy`를 평가할 때 오류가 납니다. | 태그에 `src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"`를 추가합니다. URL에는 항상 릴리스 태그 세그먼트가 필요합니다. |
| `app.html`에 dev-proxy `<script src=…>`가 있지만 위에 **`<script type="importmap">`이 없음** | 브라우저가 external bare 지정자를 해석할 수 없어 첫 모듈 스크립트 로드가 `Failed to resolve module specifier`로 실패합니다. | `<release-tag>/import-map.json`을 가져와 전체 `imports` 객체를 dev-proxy보다 앞의 `<head>`에 복사하고 모든 키를 Rollup external로 사용합니다. |
| `app.html` body에 `<wippy-loading title="…">` 대신 커스텀 SVG spinner/`<div>Loading…</div>`가 있음 | 부트스트랩 전 loader가 정식 Wippy 관용구와 다릅니다. 완전히 부팅된 WC 생태계가 스타일 및 테마 인식 loader를 렌더링할 수 있는데도 커스텀 마크업이 계속 표시됩니다. | `<wippy-loading title="Loading..."></wippy-loading>`으로 바꿉니다. `<wippy-loading>` 웹 컴포넌트는 `<body>`를 파싱하기 전에 dev-proxy.js가 `@wippy-fe/loading`을 동기식으로 가져와 등록하므로 매우 이른 페이지 로드에도 정상 해석됩니다. |
| 형제 앱 소스 파일에서 `import` | 모듈 경계를 넘어 공유 코드를 복사하고 있습니다. | 워크스페이스 패키지로 추출하거나 의도적으로 복제하되 앱 폴더 사이를 직접 참조하지 않습니다. |
| 하드코딩된 `fetch('/api/…')` 호출 | 프록시가 제공한 axios 인스턴스를 우회하여 `env.APP_API_URL` 재정의를 받지 못합니다. | 앱은 `useApi()`, WC는 `import { api } from '@wippy-fe/proxy'`를 사용합니다. |
| 실시간 데이터에 `new EventSource(...)` | 호스트 인증/릴레이 브리지를 우회하며 독립 모드에는 대응 기능이 없습니다. | `on('your.topic', cb)`을 사용합니다. 두 모드에서 작동하며 독립 실행에서는 시뮬레이션하지 않으면 토픽이 발생하지 않을 뿐입니다. |
| 테마 전환에 `document.documentElement.setAttribute('data-theme', ...)` 사용 | `data-theme`은 Wippy 테마 프로토콜이 아닙니다. | 자동 모드 또는 호스트 관리 `.w-theme-light`/`.w-theme-dark` 클래스를 사용합니다. 설정된 `@light`/`@dark` 값이 두 경로를 지원합니다. [마이크로 프런트엔드 앱 테마](./micro-frontend-app-theming.md#l3-per-page-config_overrides-in-registry-yaml)를 참조하세요. |
| `app.ts`에서 `import '@wippy-fe/theme/theme-config.css'` | 중복입니다. 호스트가 `themeConfig: true` 프록시 주입으로 theme-config를 주입하고 호스트 없는 모드에서는 dev-proxy도 주입합니다. | import를 제거합니다. |
| API 모듈의 하드코딩된 API 기본 URL | 다른 환경을 대상으로 하는 호스트 없는 모드에서 작동하지 않습니다. | `useApi()`를 통해 `appConfig.env.APP_API_URL`에서 읽습니다. |

---

## 문제 해결

**"Proxy globals not found" 오류.**
WC 번들이 실행되었지만 실제 프록시와 dev-proxy 모두 `window.__WIPPY_APP_API__`를 초기화하지 않았습니다. 페이지에 `<script src=".../dev-proxy.js" data-role="@wippy/scripts">`가 있고 URL에 접근 가능한지 확인하세요. 프로덕션 호스트 모드에서는 호스트가 proxy.js를 주입하지 못했다는 뜻이므로 호스트 로그를 확인합니다.

**개발 오버레이가 나타나지 않음.**
오버레이는 `DOMContentLoaded` 후 `document.body`에 추가되는 Shadow DOM 커스텀 엘리먼트입니다. `<head>` 안에서 `dev-proxy.js`를 로드했는데 body가 없거나 `display: none`이면 렌더링할 수 없습니다. 스크립트를 body 끝으로 옮기거나 body 숨김을 해제하세요.

**잘못된 설정으로 자동 수락이 멈춤.**
저장 설정이 잘못되고 자동 수락이 켜져 있어도 오버레이는 모니터링 모드로 렌더링됩니다. FAB → Reset을 눌러 모든 `@wippy-dev/*` localStorage 키를 지운 뒤 다시 로드하세요.

**개발 모드 테마가 잘못됨.**
기본적으로 `getDefaultProxyConfig()`는 `customCss`, `customVariables`를 활성화하고 `themeConfig`, `iframe`, `primevue`, `markdown`을 비활성화합니다. 앱이 PrimeVue theme-config CSS를 기대한다면 패널에서 해당 체크박스를 켜세요. 자동 수락이 기억합니다.

**호스팅과 독립 실행의 importmap 불일치.**
고정 릴리스의 `import-map.json`을 다시 가져오고 호스트 없는 전체 `imports` 객체를 교체한 뒤 모든 키에서 Rollup external을 다시 생성합니다. 개별 항목을 패치하거나 선별된 부분집합을 관리하지 마세요.

**WC 테스트가 "host getter returned null"로 실패함.**
테스트는 `connectedCallback`이 발생하기 **전에** `el.__wippyHost = fakeWrapper`를 설정해야 합니다. `document.body.appendChild(el)` 전에 설정하거나 테스트 스위트가 사용하는 resolver 패턴으로 래퍼를 모사하세요.

---

## 관련 문서

- [프록시 API](./proxy-api.md) — 호스팅 및 호스트 없는 모드에서 동일하게 작동하는 전체 `@wippy-fe/proxy` 레퍼런스
- [마이크로 프런트엔드 앱](./micro-frontend-app.md) — 마이크로 프런트엔드 앱 만들기(이 문서에서 다룬 이중 모드 `app.html` 패턴)
- [웹 컴포넌트](./web-component.md) — 웹 컴포넌트 만들기(`WippyVueElement`, `define()`, 호스트 없는 플레이그라운드/테스트)
- [테마 작성](./theming.md) — `config_overrides`를 통한 페이지별 테마 재정의(dev-proxy에도 `theming.global.cssVariables`/`customCSS`로 전달)
- [컴플라이언스 체크리스트](./compliance-checklist.md) — 호스트 없는 모드의 전체 REJECT 규칙
