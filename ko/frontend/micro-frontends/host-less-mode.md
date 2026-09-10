---
title: "호스트리스 모드"
description: "모든 Wippy 마이크로 프론트엔드 앱과 웹 컴포넌트가 Wippy 웹 호스트 없이도 빌드하고, 실행하고, 테스트할 수 있게 해주는 스탠드얼론 인지 설계 계약에 대한 권위 있는 가이드…"
---

# 호스트리스 모드

모든 Wippy 마이크로 프론트엔드 앱과 웹 컴포넌트가 Wippy 웹 호스트가 감싸지 **않은** 상태에서도 빌드하고, 실행하고, 테스트할 수 있게 해주는 스탠드얼론 인지 설계 계약에 대한 권위 있는 가이드입니다.

> **주입의 기본 상태:** 개발 오버레이는 `themeConfig`, `primevue`, `markdown`, `iframe`이 **비활성화**된 상태로 시작하지만 `customCss`와 `customVariables`는 **활성화**되어 있습니다. 따라서 커스텀 오버라이드에만 의존하는 앱은 잘 동작하는 것처럼 보이지만, 플랫폼 테마 변수나 PrimeVue 스타일을 기대하는 앱은 해당 주입을 켤 때까지 스타일 없이 렌더링됩니다. 오버레이 FAB을 열고 → 필요한 주입을 활성화한 뒤 → "Auto-accept on reload"를 체크하면 리로드 후에도 유지됩니다.

---

## 목차

- [멘탈 모델 — 앱과 WC는 의도적으로 스탠드얼론을 인지한다](#mental-model--apps-and-wcs-are-intentionally-standalone-aware)
- [`@wippy/scripts` 전환점 — 하나의 태그, 두 개의 부트 경로](#the-wippyscripts-switchpoint--one-tag-two-boot-paths)
- [`dev-proxy.js`가 실제로 하는 일](#what-dev-proxyjs-actually-does)
- [개발 오버레이(설정 모달)](#the-dev-overlay-config-modal)
- [호스트 스텁 — 스탠드얼론 `host` API](#host-stubs--the-standalone-host-api)
- [웹 컴포넌트 — 호스트리스 플레이그라운드와 테스트](#web-components--host-less-playground-and-tests)
- [흔한 이탈과 발견 방법](#common-deviations-and-how-to-spot-them)
- [문제 해결](#troubleshooting)
- [관련 문서](#related-docs)

---

## 멘탈 모델 — 앱과 WC는 의도적으로 스탠드얼론을 인지한다

모든 Wippy 마이크로 프론트엔드 앱과 웹 컴포넌트는 작고 의도적인 제약 하나를 중심으로 만들어집니다:

> **런타임 계약은 프록시 API 표면이다. 그 외에는 없다.**

실제로 이것이 의미하는 바는:

- 앱이나 WC가 런타임에 건드리는 유일한 것은 프록시 API 표면입니다. 즉 `@wippy-fe/proxy`에서 임포트하는 동기 게터들(`host`, `api`, `on`, `config`, `state`, `ws`, `logger`)입니다. 앱과 WC 모두 같은 임포트를 사용하며, 내부적으로는 런타임이 내부 전역(`window.$W`, `window.__WIPPY_APP_API__` — 이들을 직접 읽지 마세요)으로 설치하는 동일한 `ProxyApiInstance`로 해석됩니다.
- 앱과 WC는 이웃 앱, 부모 모듈의 Lua 쪽, Wippy 웹 호스트, 다른 프로젝트 모듈에서
  코드를 임포트하지 **않습니다**. 각자 자기 폴더 안에서 삽니다. Vite는 모든 Rollup
  외부 모듈을 핀 고정된 대상 호스트의 `import-map.json`에서 도출합니다.
  `package.json`은 산출물이 실제로 임포트하는 npm 의존성과 peer 루트만 선언합니다.
- 동일한 `app.ts`(또는 WC의 `index.ts`)가 두 환경에서 올바로 부팅됩니다:
  1. **호스티드** — `proxy.js`, AppConfig, importmap, CSS를 주입하는 Wippy 웹 호스트 안.
  2. **호스트리스** — Vite 개발 서버, file://, 유닛 테스트 페이지, Storybook 스타일 플레이그라운드 등을 통해 `app.html`을 직접 실행.

모든 앱/WC를 "아주 작은 표준화된 I/O 표면을 가진 작은 프로그램"으로 생각할 수 있습니다. 호스트는 가능한 런타임 중 하나이고 스탠드얼론은 또 다른 하나입니다. 앱 코드는 자신이 어느 쪽에 있는지 알지 못합니다.

이는 우연이나 나중에 붙인 생각이 아닙니다. 이것이 다음을 가능하게 합니다:
- 전체 Wippy 백엔드를 띄우지 않고 로컬 FE 반복 작업.
- vitest + jsdom에서 WC를 독립적으로 유닛 테스트.
- Wippy 모듈 간 앱 공유 — 어느 모듈이 배포하든 모든 마이크로 프론트엔드 앱과 웹 컴포넌트가 동일한 툴체인으로 빌드됩니다.
- 고객별 오버레이 — 운영자가 FE 번들을 다시 빌드하지 않고 메타데이터(테마, importmap, env)를 패치.

---

## `@wippy/scripts` 전환점 — 하나의 태그, 두 개의 부트 경로

모든 정식 앱의 `app.html`에는 로드 시점에 부트 경로를 결정하는 **하나의** 스크립트 태그가 들어갑니다:

아래는 축약된 body/부트 예시입니다. [임포트 맵 스냅샷 알고리즘](./build-system.md#import-map-snapshot-algorithm)이
설명하는 완전하고 유효한 임포트 맵 응답을 넣고, 핀 고정된 웹 호스트 태그가 바뀌면
갱신하세요.

```html
<!-- URL에는 반드시 릴리스 태그 세그먼트가 포함되어야 합니다: https://web-host.wippy.ai/<release-tag>/dev-proxy.js -->
<script
    src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"
    data-role="@wippy/scripts"
></script>
```

전체 `app.html` 스캐폴드는 [마이크로 프론트엔드 앱](./micro-frontend-app.md)에 있습니다.

그 하나의 태그에 있는 두 어트리뷰트가 이중 모드 계약 전체를 담고 있습니다:

| 어트리뷰트 | 역할 | 사용 주체 |
|---|---|---|
| `data-role="@wippy/scripts"` | 호스트를 위한 표식. 존재하면 호스트는 iframe을 서빙하기 전에 이 `<script>` 엘리먼트를 제거하고, 표식 **앞에** 자체 `loading.js` + `proxy.js` + importmap + AppConfig를 주입합니다. 호스티드 모드에서는 이 엘리먼트가 사라집니다. | Wippy 웹 호스트 |
| `src="…/dev-proxy.js"` | 폴백 URL. 호스트가 없을 때 사용됩니다 — 브라우저가 `dev-proxy.js`를 직접 로드하고 그 스크립트가 페이지를 부트스트랩합니다. 호스티드 모드에서는 `src=` 어트리뷰트가 무의미합니다(`<script>` 엘리먼트가 더 이상 존재하지 않으므로). | 스탠드얼론 브라우저 로드 |

**환경에 맞는 URL을 고르세요.** **웹 호스트 URL은 경로에 항상 릴리스 태그 세그먼트를 요구합니다** — 호스트 루트 바로 아래의 `/dev-proxy.js`는 유효하지 않습니다. 특정 빌드(`/<release-tag>/dev-proxy.js`)를 지정해야 합니다. 이렇게 하면 모든 개발 모드 부트가 알려진 재현 가능한 번들에 고정되어 "호스트 CDN이 밤새 업데이트되어 내 프리뷰가 깨졌다" 부류의 사고를 방지합니다.

| 환경 | `src=` 값 예시 |
|---|---|
| 공개 CDN(표준) | `https://web-host.wippy.ai/<release-tag>/dev-proxy.js` |
| 자체 호스팅 Wippy 배포 | `https://<your-wippy-host>/<release-tag>/dev-proxy.js` |

태그는 파사드의 `fe_facade_url`이 사용하는 릴리스 버전과 일치해야 합니다. 명시적으로 핀 고정하세요 — 태그 세그먼트가 없는 `/dev-proxy.js`는 유효하지 않습니다. 같은 번들이 로컬 반복 작업, CI, 공유 가능한 프리뷰 링크에 모두 동작합니다.

즉, 같은 한 줄의 HTML이 호스트의 "여기에 스크립트를 주입하라" 앵커이자 *동시에* 호스트리스 폴백 부트가 되며, 조건 분기 로직은 전혀 필요 없습니다.

### importmap에는 무엇이 들어가는가?

개발 중에 `fe_facade_url` 및 `dev-proxy.js`와 동일한 태그를 사용하여 완전한 맵을 한 번 가져오세요:

```bash
curl.exe -fsS "https://web-host.wippy.ai/<release-tag>/import-map.json" -o import-map.json
```

`app.html`의 `<script type="importmap">` 엘리먼트 텍스트를 가져온 JSON 응답 그대로
설정하세요. 그 JSON 안에 주석, 생략 기호 자리표시자, 손으로 쓴 대체값을 넣지
마세요.
[빌드 및 의존성 계약](./build-system.md#import-map-snapshot-algorithm)이
스냅샷과 출처 요구 사항을 정의하며, 가져온 릴리스 응답이 정확한 `imports` 객체를
제공합니다.

관례:
- 현재 사용하지 않는 키를 포함해 **가져온 모든 키**를 Rollup 외부 모듈에 넣으세요.
- `app.html`에 동일한 완전 키/값 객체를 유지하세요. `esm.sh`로 재구성하지 마세요.
- 정확한 키가 없을 때에만 임포트한 스펙파이어를 번들에 포함하세요.
- 웹 호스트 태그가 바뀌거나 새 의존성이 추가되면, 그 스펙파이어가 외부 모듈이 될 수 있는지 확인하기 위해 다시 가져오세요.

스탠드얼론 `app.html`은 복사한 완전한 맵을 해석합니다. 호스티드 모드는 동일하게 핀 고정된 릴리스가 전달하는 맵을 사용합니다.

### dev-proxy에 `package.json` 노출하기 (정식 스캐폴드)

모든 Wippy 앱의 `package.json`에는 런타임 기본값을 결정하는 메타데이터가 들어 있습니다 — 프록시 주입(`wippy.proxy.injections.css.*`), 페이지별 테마 오버라이드(`wippy.configOverrides.customization`), iconify 아이콘 컬렉션 등. 호스티드 모드에서 호스트는 이를 레지스트리에서 읽습니다. 호스트리스 모드에서는 dev-proxy가 같은 기본값을 적용하기 위해 같은 데이터가 필요합니다.

정식 패턴은 일관된 현행 `@wippy-fe/vite-plugin` 계열(게시 시점 기준 `0.0.46`)의 `wippyPagePlugin()`을 `vite.config.ts`에 한 번 추가하는 것입니다. 플러그인은 빌드 시점에 `package.json`을 읽고 **두 가지** 일을 합니다:

1. `wippy` 블록의 **`file://` 참조를 해석**합니다(`"file://<relative>"` 형태의 모든 문자열 값이 참조된 파일의 UTF-8 내용으로 대체됩니다 — [build-system.md](./build-system.md)의 `*.do-not-link.<ext>` 명명 관례 참조).
2. 해석된 JSON으로 **두 개의 출력을 방출**합니다:
   - 호스트리스 / dev-proxy 부트를 위해 `<head>`에 주입되는 `<script type="application/json" data-role="@wippy/package">`.
   - wippy 호스티드 모드를 위해 실제 Vite 출력 디렉터리에 놓이는 `wippy-meta.json`.

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

**웹 컴포넌트**(`view.component`, ESM 전용 — 주입할 HTML 엔트리가 없음)에는 같은 패키지의 `wippyComponentPlugin()`을 사용하세요. 이는 실제 출력 디렉터리에 `wippy-meta.json`만 방출하며 `transformIndexHtml` 단계가 없습니다.

```ts
// 웹 컴포넌트용 vite.config.ts
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
export default defineConfig({ plugins: [wippyComponentPlugin()] })
```

> `wippyPackagePlugin`은 더 이상 권장되지 않는 호환 별칭으로 남아 있습니다. 새 페이지 코드는 `wippyPagePlugin()`을, 컴포넌트 전용 빌드는 `wippyComponentPlugin()`을 사용합니다.

플러그인은 빌드된 `app.html`의 `<head>` 최상단에 다음을 방출합니다:

```html
<script type="application/json" data-role="@wippy/package">
{ "name": "@wippy/your-app", "version": "1.0.0", "wippy": { "proxy": {...}, "configOverrides": {...} } }
</script>
```

dev-proxy.js는 부트 시점에
`document.querySelector('script[data-role="@wippy/package"]')`로 이를 동기적으로 읽고, `wippy.proxy.injections`로 프록시 설정 기본값을, `wippy.configOverrides.customization`으로 `appConfig.theming.global`을 시드합니다. data-role 문자열 `@wippy/package`는 `@wippy-fe/shared`에서 `WIPPY_PACKAGE_DATA_ROLE`로 익스포트되어 경계 양쪽이 같은 상수를 공유합니다.

이 형태를 택한 이유:
- **중복 없음.** `package.json`이 유일한 진실 원천입니다 — 플러그인이 빌드 시점에 읽으며 `src/`의 어떤 것도 이를 참조하지 않습니다.
- **fetch 없음.** 서빙되는 HTML에 인라인되어 있어, 어떤 앱 코드가 실행되기 전에 `dev-proxy.js`가 동기적으로 읽을 수 있습니다.
- **올바른 순서.** 어떤 스크립트 태그보다 앞선 `<head>` 최상단에 주입되므로, dev-proxy가 실행될 때 이미 DOM에 있습니다(dev-proxy는 동기 UMD 스크립트이고, 모듈 스크립트는 defer되어 나중에 실행됩니다).
- **`app.html` 편집 불필요.** 템플릿은 깨끗하게 유지되고, 주입은 플러그인이 소유합니다.
- **공유 패키지의 상수.** `'@wippy/package'` 문자열은 정확히 한 곳(`@wippy-fe/shared` → `WIPPY_PACKAGE_DATA_ROLE`)에 존재합니다. 앱은 이를 직접 참조하지 않고, dev-proxy와 플러그인이 모두 거기서 임포트합니다.
- **실제 호스트에서는 깔끔히 무시됨.** 호스트의 `processWebPage`는 서버 측에서 레지스트리로부터 `package.json`을 읽으므로, 인라인 JSON 태그는 무해한 메타데이터입니다.

dev-proxy는 `resolveDevConfig()` 중에 이 JSON을 읽어 개발 오버레이 기본값을 채웁니다. 스크립트 태그가 없으면(오래된 앱이거나 플러그인을 아직 추가하지 않은 경우) dev-proxy는 `getDefaultProxyConfig()`로 폴백합니다. 따라서 플러그인 추가는 순수하게 추가적인 변경입니다 — 없는 앱은 일반 기본값으로 계속 동작합니다.

> **왜 런타임 `window` 전역이 아니라 플러그인인가?** dev-proxy.js는 `<head>` 파싱 중 일찍 실행되는 비모듈 동기 스크립트로, 어떤 모듈 스크립트(여러분의 `app.ts` 포함)도 로드되기 전에 실행됩니다. 따라서 `app.ts`는 dev-proxy가 읽기 *전에* 전역을 설정할 수 없습니다. 빌드 타임 HTML 변환이 데이터를 미리 DOM에 넣어 두면, dev-proxy가 실행되는 즉시 사용할 수 있습니다.

> **왜 태그가 둘이 아니라 하나인가?** 두 번째 `<script>` 블록(예: `if (!window.__WIPPY__) load dev-proxy`)은 호스트의 주입이 끝난 뒤에야 실행되며, 표식이 사라졌다면 그 조건문은 붙을 곳이 없습니다. 단일 태그 패턴은 표식이 소스 HTML에 *항상* 존재하고, 호스트의 역할은 정확히 "이 표식을 지우고 대체하라"임을 뜻합니다. 스탠드얼론 상황은 아무도 그것을 지우지 않았을 때 정확히 발생합니다.

호스트 계약은 `wippy.path`가 지정한 HTML 파일에 추가 스크립트가 자동 주입될 `<script type="text/javascript" data-role="@wippy/scripts">` 엘리먼트가 반드시 포함되어야 한다고 요구합니다.

정식 app-template 앱들은 `src="…/dev-proxy.js"`가 채워진 상태로 제공됩니다. 그것이 권장되는 형태입니다: 앱이 호스트리스로 실행될 수 없는 경우(드물며, 정당화가 필요)가 아니라면 **항상 `src=` 폴백을 포함하세요**.

---

## `dev-proxy.js`가 실제로 하는 일

`dev-proxy.js`는 호스트리스 부트 번들이며 Wippy 웹 호스트 CDN의 `https://web-host.wippy.ai/<release-tag>/dev-proxy.js`에서 서빙됩니다.

그 역할은 호스트 없이도 `@wippy-fe/proxy` 게터들이 올바로 해석되게 만드는 것이며, 실제 호스트가 설치했을 것과 동일한 내부 전역(`window.$W`, `window.__WIPPY_APP_API__`)을 설치함으로써 이를 수행합니다. 앱과 WC 코드는 그 전역을 결코 건드리지 않습니다. 그냥 `@wippy-fe/proxy`에서 임포트하면 게터가 동작합니다. dev-proxy는 대략 다섯 단계로 이를 수행합니다:

1. **히스토리 가드 설치**(`installHistoryGuard()`) — `pushState` / `replaceState`를 스텁으로 대체해, vue-router가 iframe-srcdoc 컨텍스트 밖에서 브라우저 히스토리를 변경하려 들지 않게 합니다.
2. **설정 해석**(`src/proxy/dev/resolve-dev.ts`의 `resolveDevConfig()`):
   - `localStorage['@wippy-dev/config']`와 `localStorage['@wippy-dev/proxy-config']`를 읽습니다.
   - `localStorage['@wippy-dev/auto-accept'] === 'true'`이고 저장된 설정이 있으면 → 즉시 사용하고 오버레이를 모니터링 모드로 렌더링합니다.
   - 그렇지 않으면 → 오버레이를 *대기* 모드로 렌더링하고(FAB이 파랗게 깜박이며 "Accept config to continue loading" 말풍선 표시) 개발자가 Accept를 클릭할 때까지 부트를 막습니다.
3. **가짜 `ProxyApiInstance` 구성** — 다음에 연결됩니다:
   - 수락된 `ChildAppConfig`(`@wippy-fe/proxy`의 `config`가 반환하는 것).
   - `on(...)` 구독과 `@history` / `@visibility` 시뮬레이션을 위한 nanoevents 이미터.
   - 모든 메서드를 콘솔에 로그하는 `host` 스텁(`src/proxy/dev/host-stubs.ts`의 `createDevHostAPI()`).
   - `@wippy-fe/proxy`의 `api`를 뒷받침하는 실제 axios 인스턴스. 개발자가 입력한 URL로 구성됩니다(`env.APP_API_URL`의 기본값은 `${location.origin}/api`).
   - 프로덕션 프록시 형태를 그대로 흉내 내는 logger / state / ws 스텁.
4. **개발자가 선택한 프록시 설정에 따라 CSS 주입 적용**:
   - `themeConfig: true` → `@wippy-fe/theme`의 `theme-config.css`를 주입합니다.
   - `iframe`, `primevue`, `markdown` → 마찬가지로 `src/proxy/dev/css-inline.ts`의 인라인 CSS 번들을 주입합니다.
   - `customCss` / `customVariables` → `appConfig.theming.global.customCSS` / `cssVariables`를 적용합니다([micro-frontend-app-theming.md](./micro-frontend-app-theming.md#l3--per-page-config_overrides-in-registry-yaml)에 설명된 `@dark`/`@light` 블록 포함).
5. **`entry.iframe.ts`와 동일한 형태로 내부 프록시 전역 설치** — 그래야 `@wippy-fe/proxy` 게터들(`config`, `host`, `api`, `on`, `logger`, `state`, `ws`, `loadWebComponent`)이 해석됩니다. `@wippy-fe/proxy`에서 임포트하는 모든 앱 또는 WC 코드는 수정 없이 동작합니다. (전역 자체 — `window.$W` 등 — 는 내부용입니다. [프록시 및 격리 § 내부 구조](../web-host/proxy-isolation.md#internals--do-not-read-or-override) 참조.)

기본 `ChildAppConfig`(`config-store.ts`의 `getDefaultConfig()`):

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

이 중 무엇이든 모달에서(또는 `localStorage['@wippy-dev/config']`를 편집하여) 오버라이드할 수 있습니다.

---

## 개발 오버레이(설정 모달)

시각적으로 개발 오버레이는 다음을 렌더링하는 아주 작은 섀도우 DOM 웹 컴포넌트(`<wippy-dev-overlay>`)입니다:

- 우측 하단 모서리의 FAB(플로팅 액션 버튼) — 클릭하기 전까지 보이는 유일한 어포던스.
- 대기 모드의 **말풍선**: "Accept config to continue loading."
- FAB을 클릭하면 열리는 **패널**. 패널은 세 개의 섹션으로 구성됩니다:
  - **Monitor** — 현재 경로, 문서 제목, 뷰포트 크기의 실시간 표시. 앱이 다시 페치할 수 있도록 `@visibility(true)`를 발생시키는 "Trigger Refresh" 버튼.
  - **Configuration(접을 수 있음)**:
    - `App Config (JSON)` — 편집 가능한 JSON 형태의 전체 `ChildAppConfig`. Accept 시 검증합니다.
    - `Proxy Injections` — 모든 프록시 주입 플래그(`themeConfig`, `iframe`, `primevue`, `markdown`, `customCss`, `customVariables`, `tailwindConfig`, `resizeObserver`, `preventLinkClicks`, `iconifyIcons`, `refreshWhenVisible`, `historyPolyfill`, `errorCapture`)에 대한 체크박스.
    - `Options` — "Auto-accept on reload" 체크박스(자동 수락 플래그를 localStorage에 씁니다).
  - **Footer** — Reset(모든 `@wippy-dev/*` localStorage 키를 지움), Accept(설정 저장 + 부트 프로미스 해결).

사용하는 LocalStorage 키(`src/proxy/dev/config-store.ts`에 정의):

| 키 | 저장 내용 |
|---|---|
| `@wippy-dev/config` | 수락된 `ChildAppConfig` JSON |
| `@wippy-dev/proxy-config` | 수락된 부분 `ProxyConfig`(주입 플래그) |
| `@wippy-dev/auto-accept` | 리로드 시 수동 수락 단계를 건너뛰려면 `'true'` |

자동 수락은 "호스트리스 빌드로 반복 작업하기"를 거의 네이티브처럼 느끼게 해줍니다. 새로고침하면 앱이 마지막으로 알려진 설정으로 즉시 부팅되고, FAB은 계속 보여서 모니터링하거나 조정할 수 있습니다.

---

## 호스트 스텁 — 스탠드얼론 `host` API

`host` API(`import { host } from '@wippy-fe/proxy'`)는 앱이 호스트에게 무언가를 요청하는 표면입니다 — 토스트, 내비게이션, 세션 열기, 컨텍스트 설정, URL 포맷 등. 실제 호스트가 없으면 dev-proxy가 `src/proxy/dev/host-stubs.ts`의 스텁 계층으로 대체합니다:

| 메서드 | 스탠드얼론 동작 |
|---|---|
| `host.toast(message)` | 콘솔 로그만 |
| `host.confirm({ message })` | 브라우저 `window.confirm()` |
| `host.startChat(token, options)` | 콘솔 로그 |
| `host.openSession(uuid, options)` | 콘솔 로그 |
| `host.openArtifact(uuid, options)` | 콘솔 로그 |
| `host.navigate(url)` | 콘솔 로그 + 자식 라우터가 받을 수 있도록 `@history` 방출 + 오버레이 경로 표시 갱신 |
| `host.onRouteChanged(path)` | 콘솔 로그 + 오버레이 경로 표시 갱신 |
| `host.handleError(code, error)` | `console.error` |
| `host.setContext(context, sessionUUID, source)` | 콘솔 로그 |
| `host.formatUrl(rel)` | `${appConfig.routePrefix || ''}${rel}`를 반환 |
| `host.classifyLink(href)` | 실제 구현 — 수락된 설정의 `mountRoutes` / `routePrefix`를 사용 |
| `host.layout.*` | 타입 계약만 충족하는 무동작 스텁 |

스텁이 수다스러운 것은 의도적입니다. 콘솔 출력은 호스트의 실제 부수 효과를 대신하므로, 개발자는 호스트를 실제로 연결하지 않고도 *무슨 일이 일어났을지* 볼 수 있습니다. 앱의 정확성이 그 부수 효과에 의존한다면(예: `host.openSession`이 실제로 세션을 여는 것), 그 경로는 호스트에서 테스트하세요. 스텁은 그것을 해주지 않습니다.

---

## 웹 컴포넌트 — 호스트리스 플레이그라운드와 테스트

웹 컴포넌트도 동일한 이중 모드 설계를 공유하지만, iframe이 아니라 ES 모듈로 로드됩니다. WC의 프록시 계약은 `import { api, host, on, ... } from '@wippy-fe/proxy'`이며, 그 임포트는 런타임에 `window.__WIPPY_APP_API__`(실제 프록시 또는 dev-proxy가 설정)를 읽어 해석됩니다.

### 플레이그라운드 / 데모 HTML 페이지

```html
<!-- WC 프로젝트의 demo.html -->
<!DOCTYPE html>
<html>
<head>
    <!-- 이 축약된 예시에서는 필수인 완전한 import-map 스크립트를 생략했습니다. -->
    <script src="https://web-host.wippy.ai/webcomponents-1.0.44/dev-proxy.js" data-role="@wippy/scripts"></script>
</head>
<body>
    <my-component prop1="value"></my-component>
    <script type="module" src="./src/index.ts"></script>
</body>
</html>
```

동일한 전환점, 동일한 개발 오버레이입니다. WC의 `index.ts`가 `define(import.meta.url, ...)`를 호출하면 엘리먼트가 스스로 등록되고, dev-proxy가 호스트 스텁을 제공합니다.

`dev-proxy.js` 로드가 실패하거나(또는 포함하는 것을 잊었다면) `entry.web-component.ts`가 명시적인 오류를 던집니다:

> `@wippy-fe/proxy: Proxy globals not found. For dev/testing without the Wippy host, add <script src="dev-proxy.js"></script> to your HTML.`

그 오류는 호스트리스 부트 스크립트가 빠졌다는 정식 신호입니다.

### Vitest / jsdom 테스트

유닛 테스트에는 개발 오버레이가 필요 없습니다 — 테스트에는 상호작용할 UI가 없습니다. 패턴은 호스트가 붙였을 래퍼 객체를 직접 붙여서 **호스트 컨텍스트를 가짜로 만드는** 것입니다:

```ts
import { describe, expect, it } from 'vitest'
import { WippyElement } from './base-element'

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

`__wippyHost` 프로퍼티는 관리형 레이아웃 호스트가 사용하는 계약입니다. API나 프록시 전역이 필요한 테스트는 vitest 셋업 파일을 통해 dev-proxy를 마운트하거나, `window.__WIPPY_APP_API__`를 직접 스텁할 수 있습니다:

```ts
// vitest.setup.ts
;(window as any).__WIPPY_APP_API__ = {
  api: mockApi,
  host: mockHost,
  on: mockOn,
  // ...ProxyApiInstance의 나머지 필드
}
```

두 방식 모두 브라우저 dev-proxy와 같은 의미에서 "호스트리스"입니다. 프록시 계약이 실제 Wippy 서버가 아니라 테스트가 소유한 코드로 충족되는 것입니다.

---

## 흔한 이탈과 발견 방법

앱이나 WC가 스탠드얼론 인지 계약에서 벗어나면 증상은 예측 가능합니다:

| 증상 | 유력한 원인 | 해결 |
|---|---|---|
| `app.html`에 `src=` 없이 `<script data-role="@wippy/scripts"></script>`가 있음 | 페이지가 호스트리스로 부팅할 수 없습니다. 파일을 직접 열면 빈 페이지가 나옵니다 — 프록시 런타임이 설치되지 않아 `@wippy-fe/proxy` 임포트가 해석되지 않습니다. | 태그에 `src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"`를 추가하세요. URL에는 항상 릴리스 태그 세그먼트가 필요합니다. |
| `app.html`에 dev-proxy `<script src=…>`는 있으나 그 위에 **`<script type="importmap">`이 없음** | 브라우저가 외부 베어 스펙파이어를 해석할 수 없습니다. 첫 모듈 스크립트 로드가 `Failed to resolve module specifier`로 실패합니다. | `<release-tag>/import-map.json`을 가져와 완전한 `imports` 객체를 dev-proxy 앞의 `<head>`에 복사하고, 모든 키를 Rollup 외부 모듈로 사용하세요. |
| `app.html` 본문에 `<wippy-loading title="…">` 대신 커스텀 SVG 스피너나 `<div>Loading…</div>`가 있음 | 부트스트랩 이전 로더가 정식 Wippy 관용구와 맞지 않습니다. WC 생태계(스타일이 적용된 테마 인지 로더를 렌더링했을)가 완전히 부팅될 때까지 커스텀 마크업이 계속 보입니다. | `<wippy-loading title="Loading..."></wippy-loading>`로 교체하세요. `<wippy-loading>` 웹 컴포넌트는 `<body>`가 파싱되기 전에 `dev-proxy.js`가 등록하므로(`@wippy-fe/loading`을 동기적으로 임포트), 아주 이른 페이지 로드에서도 엘리먼트가 올바로 해석됩니다. |
| 형제 앱의 소스 파일에서 `import` | 모듈 경계를 넘어 공유 코드를 복사·붙여넣기 하고 있습니다. | 워크스페이스 패키지로 추출하거나 의도적으로 중복하세요. 앱 폴더를 가로질러 참조하지 마세요. |
| 하드코딩된 `fetch('/api/…')` 호출 | 프록시가 제공하는 axios 인스턴스를 우회하며, `env.APP_API_URL` 오버라이드를 반영하지 못합니다. | `useApi()`(앱) 또는 `import { api } from '@wippy-fe/proxy'`(WC)를 사용하세요. |
| 실시간 데이터를 위한 `new EventSource(...)` | 호스트의 인증/릴레이 브리지를 우회하며, 스탠드얼론 모드에는 대응물이 없습니다. | `on('your.topic', cb)`를 사용하세요 — 두 모드 모두에서 동작합니다(스탠드얼론에서는 직접 시뮬레이션하지 않는 한 토픽이 발생하지 않을 뿐입니다). |
| 테마 전환을 위한 `document.documentElement.setAttribute('data-theme', ...)` | `data-theme`는 Wippy 테마 프로토콜이 아닙니다. | Auto 모드나 호스트가 관리하는 `.w-theme-light` / `.w-theme-dark` 클래스를 사용하세요. 설정된 `@light` / `@dark` 값은 두 경로를 모두 지원합니다. [micro-frontend-app-theming.md](./micro-frontend-app-theming.md#l3--per-page-config_overrides-in-registry-yaml) 참조. |
| `app.ts`에서 `import '@wippy-fe/theme/theme-config.css'` | 불필요합니다 — 호스트가 `themeConfig: true` 프록시 주입으로 theme-config를 주입합니다. 호스트리스 모드에서는 dev-proxy가 주입합니다. | 임포트를 제거하세요. |
| api/ 모듈에 하드코딩된 API 기본 URL | 다른 환경을 대상으로 하는 호스트리스 모드에서 동작하지 않습니다. | `useApi()`를 통해 `appConfig.env.APP_API_URL`에서 읽으세요. |

---

## 문제 해결

**"Proxy globals not found" 오류.**
WC 번들은 실행되었지만 실제 프록시도 dev-proxy도 `window.__WIPPY_APP_API__`를 초기화하지 않았습니다. `<script src=".../dev-proxy.js" data-role="@wippy/scripts">`가 페이지에 있고 URL에 접근 가능한지 확인하세요. 프로덕션 호스트 모드에서 이 오류는 호스트가 proxy.js 주입에 실패했다는 뜻입니다 — 호스트 로그를 확인하세요.

**개발 오버레이가 전혀 나타나지 않음.**
오버레이는 `DOMContentLoaded` 이후 `document.body`에 추가되는 섀도우 DOM 커스텀 엘리먼트입니다. `<head>` 안에서 `dev-proxy.js`를 로드하는데 body가 없거나 `display: none`이면 오버레이가 렌더링될 수 없습니다. 스크립트를 body 하단으로 옮기거나 body를 보이게 하세요.

**잘못된 설정으로 자동 수락이 "고착됨".**
저장된 설정이 깨졌는데 자동 수락이 켜져 있다면 오버레이는 여전히(모니터링 모드로) 렌더링됩니다. FAB을 클릭 → Reset으로 모든 `@wippy-dev/*` localStorage 키를 지운 뒤 리로드하세요.

**개발 모드에서 테마가 잘못됨.**
기본적으로 `getDefaultProxyConfig()`는 `customCss`와 `customVariables`를 활성화하고 `themeConfig`, `iframe`, `primevue`, `markdown`은 비활성화합니다. 앱이 PrimeVue의 theme-config CSS를 기대한다면 패널에서 해당 체크박스를 켜세요. 자동 수락이 이를 기억합니다.

**호스티드와 스탠드얼론 간 importmap 불일치.**
핀 고정된 릴리스의 `import-map.json`을 다시 가져와 호스트리스 쪽의 완전한 `imports` 객체를 교체하고, 그로부터 Rollup 외부 모듈 키를 재생성하세요. 개별 항목을 패치하거나 선별된 부분집합을 유지하지 마세요.

**WC 테스트가 "host getter returned null"로 실패.**
테스트는 `connectedCallback`이 발생하기 *전에* `el.__wippyHost = fakeWrapper`를 설정해야 합니다. `document.body.appendChild(el)` 전에 설정하거나, 스위트가 사용하는 리졸버 패턴을 통해 래퍼를 가짜로 만드세요.

---

## 관련 문서

- [proxy-api.md](./proxy-api.md) — 전체 `@wippy-fe/proxy` 레퍼런스(호스티드와 호스트리스 모드에서 동일하게 동작)
- [micro-frontend-app.md](./micro-frontend-app.md) — 마이크로 프론트엔드 앱 만들기(부트 경로는 이 문서가 다루는 이중 모드 `app.html` 패턴입니다)
- [web-component.md](./web-component.md) — 웹 컴포넌트 만들기(`WippyVueElement`, `define()`, 호스트리스 플레이그라운드/테스트)
- [theming.md](./theming.md) — `config_overrides`를 통한 페이지별 테마 오버라이드(`theming.global.cssVariables` / `customCSS`로 dev-proxy에도 전달)
- [compliance-checklist.md](./compliance-checklist.md) — §9 호스트리스 모드 체크리스트와 전체 REJECT 규칙
